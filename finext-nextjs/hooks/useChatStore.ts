'use client';

import { useCallback, useRef, useState } from 'react';
import { streamChat, type ChatEvent } from '../services/chatClient';

export interface ToolChip {
  name: string;
  label: string;
  running: boolean;
  ok?: boolean;
  ms?: number;
}

// Message assistant = chuỗi PHẦN theo THỜI GIAN: text ↔ tool ↔ text. Giữ đúng thứ tự model nhả ra
// (câu mở đầu → tra cứu → phân tích), thay vì gom tool riêng render lên đầu.
export type MessagePart = { kind: 'text'; text: string } | ({ kind: 'tool' } & ToolChip);

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string; // text phẳng (mọi text-part nối lại) — dùng cho history gửi backend + nút Sao chép
  parts: MessagePart[];
  status: 'streaming' | 'done' | 'error' | 'interrupted';
}
export type ChatPhase = 'idle' | 'waiting' | 'streaming' | 'tool';

export interface UseChatStoreReturn {
  messages: ChatMessage[];
  phase: ChatPhase;
  asOf: string | null;
  error: string | null;
  send: (text: string) => void;
  stop: () => void;
  retry: () => void;
  newChat: () => void;
}

const IDLE_MS = 45000;
const FLUSH_MS = 80; // throttle re-render khi token nhả nhanh (04 §6 R1)

type HistoryTurn = { role: 'user' | 'assistant'; content: string };

// Backend cap: history ≤20 item, content ≤8000 ký tự/turn (schemas/chat.py). Ép client-side
// để tránh 422 phá hội thoại sau nhiều lượt.
const capHistory = (h: HistoryTurn[]): HistoryTurn[] => h.slice(-20).map((t) => ({ role: t.role, content: t.content.slice(0, 8000) }));

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function flattenText(parts: MessagePart[]): string {
  return parts.reduce((acc, p) => (p.kind === 'text' ? acc + p.text : acc), '');
}

export default function useChatStore(): UseChatStoreReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<ChatPhase>('idle');
  const [asOf, setAsOf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  // Xây parts cho message assistant đang stream; pendingRef = text-part cuối (từ khi có tool gần nhất).
  const partsRef = useRef<MessagePart[]>([]);
  const pendingRef = useRef<string>('');
  const lastFlushRef = useRef<number>(0);
  const assistantIdRef = useRef<string>('');

  const patchAssistant = useCallback((patch: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === assistantIdRef.current ? patch(m) : m)));
  }, []);

  const flush = useCallback(
    (force: boolean) => {
      const now = Date.now();
      if (!force && now - lastFlushRef.current < FLUSH_MS) return;
      lastFlushRef.current = now;
      const parts = partsRef.current.map((p) => ({ ...p })); // copy để React thấy đổi
      patchAssistant((m) => ({ ...m, parts, content: flattenText(parts) }));
    },
    [patchAssistant],
  );

  const clearIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
  }, []);

  const runStream = useCallback(
    async (history: HistoryTurn[], message: string) => {
      const controller = new AbortController();
      controllerRef.current = controller;
      const assistantId = uid();
      assistantIdRef.current = assistantId;
      partsRef.current = [];
      pendingRef.current = '';
      lastFlushRef.current = 0;

      setError(null);
      setPhase('waiting');
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', parts: [], status: 'streaming' }]);

      const resetIdle = () => {
        clearIdle();
        idleTimerRef.current = setTimeout(() => controller.abort(), IDLE_MS);
      };

      const reduce = (ev: ChatEvent) => {
        switch (ev.type) {
          case 'meta':
            setAsOf(ev.as_of);
            break;
          case 'token': {
            if (!ev.text) break;
            pendingRef.current += ev.text;
            setPhase('streaming');
            const parts = partsRef.current;
            const last = parts[parts.length - 1];
            if (last && last.kind === 'text') last.text = pendingRef.current;
            else parts.push({ kind: 'text', text: pendingRef.current });
            flush(false);
            break;
          }
          case 'tool_start':
            setPhase('tool');
            pendingRef.current = ''; // đóng text-part hiện tại; token sau mở text-part mới (DƯỚI tool)
            partsRef.current.push({ kind: 'tool', name: ev.name, label: ev.label, running: true });
            flush(true);
            break;
          case 'tool_end': {
            const parts = partsRef.current;
            for (let i = parts.length - 1; i >= 0; i--) {
              const p = parts[i];
              if (p.kind === 'tool' && p.running && p.name === ev.name) {
                parts[i] = { kind: 'tool', name: p.name, label: p.label, running: false, ok: ev.ok, ms: ev.ms };
                break;
              }
            }
            flush(true);
            break;
          }
          case 'error':
            flush(true);
            setError(ev.message);
            patchAssistant((m) => ({ ...m, status: 'error' }));
            break;
          case 'done':
            flush(true);
            patchAssistant((m) => ({ ...m, status: 'done' }));
            break;
        }
      };

      try {
        resetIdle();
        for await (const ev of streamChat({ history, message }, controller.signal)) {
          resetIdle();
          reduce(ev);
        }
      } catch {
        // abort (dừng tay / idle 45s) hoặc network/HTTP 500/422 — giữ text đã nhả, đánh dấu interrupted.
        // LUÔN set error để bong bóng rỗng tự giải thích, không im lặng.
        flush(true);
        patchAssistant((m) => (m.status === 'streaming' ? { ...m, status: 'interrupted' } : m));
        const aborted = controller.signal.aborted;
        setError((e) => e ?? (aborted ? 'Kết nối bị gián đoạn. Bạn thử lại nhé.' : 'Không lấy được phản hồi. Bạn thử lại nhé.'));
      } finally {
        clearIdle();
        controllerRef.current = null;
        setPhase('idle');
      }
    },
    [clearIdle, flush, patchAssistant],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || phase !== 'idle') return;
      const history = capHistory(
        messagesRef.current.filter((m) => m.status !== 'error' && m.content.trim() !== '').map((m) => ({ role: m.role, content: m.content }))
      );
      setMessages((prev) => [...prev, { id: uid(), role: 'user', content: trimmed, parts: [], status: 'done' }]);
      void runStream(history, trimmed);
    },
    [phase, runStream],
  );

  const stop = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    if (phase !== 'idle') return;
    // Bỏ assistant lỗi cuối (nếu có), gửi lại user message cuối.
    const msgs = messagesRef.current;
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    setMessages((prev) => {
      const out = prev.slice();
      while (out.length && out[out.length - 1].role === 'assistant') out.pop();
      return out;
    });
    const history = capHistory(
      messagesRef.current
        .filter((m) => m.role === 'user' || (m.status === 'done' && m.content.trim() !== ''))
        .filter((m) => m.id !== lastUser.id)
        .map((m) => ({ role: m.role, content: m.content }))
    );
    void runStream(history, lastUser.content);
  }, [phase, runStream]);

  const newChat = useCallback(() => {
    controllerRef.current?.abort();
    clearIdle();
    setMessages([]);
    setError(null);
    setPhase('idle');
    setAsOf(null);
  }, [clearIdle]);

  return { messages, phase, asOf, error, send, stop, retry, newChat };
}
