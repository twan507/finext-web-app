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
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools: ToolChip[];
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

export default function useChatStore(): UseChatStoreReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<ChatPhase>('idle');
  const [asOf, setAsOf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  // Throttle flush cho content bubble đang stream.
  const pendingRef = useRef<string>('');
  const lastFlushRef = useRef<number>(0);
  const assistantIdRef = useRef<string>('');

  const patchAssistant = useCallback((patch: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === assistantIdRef.current ? patch(m) : m)));
  }, []);

  const flushContent = useCallback(
    (force: boolean) => {
      const now = Date.now();
      if (!force && now - lastFlushRef.current < FLUSH_MS) return;
      lastFlushRef.current = now;
      const text = pendingRef.current;
      patchAssistant((m) => ({ ...m, content: text }));
    },
    [patchAssistant],
  );

  const clearIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
  }, []);

  const runStream = useCallback(
    async (history: { role: 'user' | 'assistant'; content: string }[], message: string) => {
      const controller = new AbortController();
      controllerRef.current = controller;
      const assistantId = uid();
      assistantIdRef.current = assistantId;
      pendingRef.current = '';
      lastFlushRef.current = 0;

      setError(null);
      setPhase('waiting');
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', tools: [], status: 'streaming' },
      ]);

      const resetIdle = () => {
        clearIdle();
        idleTimerRef.current = setTimeout(() => controller.abort(), IDLE_MS);
      };

      const reduce = (ev: ChatEvent) => {
        switch (ev.type) {
          case 'meta':
            setAsOf(ev.as_of);
            break;
          case 'token':
            pendingRef.current += ev.text;
            setPhase('streaming');
            flushContent(false);
            break;
          case 'tool_start':
            setPhase('tool');
            patchAssistant((m) => ({
              ...m,
              tools: [...m.tools, { name: ev.name, label: ev.label, running: true }],
            }));
            break;
          case 'tool_end':
            patchAssistant((m) => {
              const i = m.tools.findIndex((t) => t.running && t.name === ev.name);
              if (i === -1) return m;
              const tools = m.tools.slice();
              tools[i] = { ...tools[i], running: false, ok: ev.ok, ms: ev.ms };
              return { ...m, tools };
            });
            break;
          case 'error':
            flushContent(true);
            setError(ev.message);
            patchAssistant((m) => ({ ...m, status: 'error' }));
            break;
          case 'done':
            flushContent(true);
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
        flushContent(true);
        patchAssistant((m) => (m.status === 'streaming' ? { ...m, status: 'interrupted' } : m));
        const aborted = controller.signal.aborted;
        setError((e) => e ?? (aborted ? 'Kết nối bị gián đoạn. Bạn thử lại nhé.' : 'Không lấy được phản hồi. Bạn thử lại nhé.'));
      } finally {
        clearIdle();
        controllerRef.current = null;
        setPhase('idle');
      }
    },
    [clearIdle, flushContent, patchAssistant],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || phase !== 'idle') return;
      const history = capHistory(
        messagesRef.current.filter((m) => m.status !== 'error' && m.content.trim() !== '').map((m) => ({ role: m.role, content: m.content }))
      );
      setMessages((prev) => [...prev, { id: uid(), role: 'user', content: trimmed, tools: [], status: 'done' }]);
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
