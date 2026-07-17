'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { streamChat, type ChatEvent } from '../services/chatClient';

export interface ToolChip {
  name: string;
  label: string;
  running: boolean;
  ok?: boolean;
  ms?: number;
}
export type MessagePart = { kind: 'text'; text: string } | ({ kind: 'tool' } & ToolChip);
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parts: MessagePart[];
  status: 'streaming' | 'done' | 'error' | 'interrupted';
}
export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
}
export type ChatPhase = 'idle' | 'waiting' | 'streaming' | 'tool';

export interface UseChatStoreReturn {
  conversations: Conversation[];
  activeId: string;
  messages: ChatMessage[];
  phase: ChatPhase;
  asOf: string | null;
  error: string | null;
  thinking: boolean;
  toggleThinking: () => void;
  send: (text: string) => void;
  stop: () => void;
  retry: () => void;
  newConversation: () => void;
  selectConversation: (id: string) => void;
}

const THINKING_KEY = 'finext-chat-thinking';

const IDLE_MS = 45000;
const FLUSH_MS = 80;
type HistoryTurn = { role: 'user' | 'assistant'; content: string };
const capHistory = (h: HistoryTurn[]): HistoryTurn[] => h.slice(-20).map((t) => ({ role: t.role, content: t.content.slice(0, 8000) }));

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function flattenText(parts: MessagePart[]): string {
  return parts.reduce((acc, p) => (p.kind === 'text' ? acc + p.text : acc), '');
}
function titleFrom(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length > 42 ? t.slice(0, 42) + '…' : t;
}
function newConv(): Conversation {
  return { id: uid(), title: 'Cuộc trò chuyện mới', createdAt: Date.now(), messages: [] };
}

export default function useChatStore(): UseChatStoreReturn {
  const [conversations, setConversations] = useState<Conversation[]>(() => [newConv()]);
  const [activeId, setActiveId] = useState<string>(() => conversations[0]?.id ?? '');
  const [phase, setPhase] = useState<ChatPhase>('idle');
  const [asOf, setAsOf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "Suy nghĩ sâu": init false (SSR-safe), hydrate từ localStorage sau mount để tránh mismatch.
  const [thinking, setThinking] = useState(false);

  const conversationsRef = useRef<Conversation[]>(conversations);
  conversationsRef.current = conversations;
  const activeIdRef = useRef<string>(activeId);
  activeIdRef.current = activeId;
  const thinkingRef = useRef<boolean>(thinking); // đọc giá trị mới nhất lúc gửi
  thinkingRef.current = thinking;

  const controllerRef = useRef<AbortController | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const convIdRef = useRef<string>(''); // hội thoại đang stream
  const partsRef = useRef<MessagePart[]>([]);
  const pendingRef = useRef<string>('');
  const lastFlushRef = useRef<number>(0);
  const assistantIdRef = useRef<string>('');

  const messages = conversations.find((c) => c.id === activeId)?.messages ?? [];

  useEffect(() => {
    try {
      if (localStorage.getItem(THINKING_KEY) === '1') setThinking(true);
    } catch {
      // localStorage không khả dụng — bỏ qua, giữ default false
    }
  }, []);

  const toggleThinking = useCallback(() => {
    setThinking((v) => {
      const next = !v;
      try {
        localStorage.setItem(THINKING_KEY, next ? '1' : '0');
      } catch {
        // localStorage không khả dụng — vẫn đổi state trong phiên
      }
      return next;
    });
  }, []);

  // Patch message assistant TRONG hội thoại đang stream (convIdRef) — không phụ thuộc active view.
  const patchAssistant = useCallback((patch: (m: ChatMessage) => ChatMessage) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convIdRef.current ? { ...c, messages: c.messages.map((m) => (m.id === assistantIdRef.current ? patch(m) : m)) } : c,
      ),
    );
  }, []);

  const flush = useCallback(
    (force: boolean) => {
      const now = Date.now();
      if (!force && now - lastFlushRef.current < FLUSH_MS) return;
      lastFlushRef.current = now;
      const parts = partsRef.current.map((p) => ({ ...p }));
      patchAssistant((m) => ({ ...m, parts, content: flattenText(parts) }));
    },
    [patchAssistant],
  );

  const clearIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
  }, []);

  const runStream = useCallback(
    async (convId: string, history: HistoryTurn[], message: string) => {
      const controller = new AbortController();
      controllerRef.current = controller;
      convIdRef.current = convId;
      const assistantId = uid();
      assistantIdRef.current = assistantId;
      partsRef.current = [];
      pendingRef.current = '';
      lastFlushRef.current = 0;

      setError(null);
      setPhase('waiting');
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, messages: [...c.messages, { id: assistantId, role: 'assistant', content: '', parts: [], status: 'streaming' }] } : c,
        ),
      );

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
            pendingRef.current = '';
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
        for await (const ev of streamChat({ history, message, thinking: thinkingRef.current }, controller.signal)) {
          resetIdle();
          reduce(ev);
        }
      } catch {
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
      const convId = activeIdRef.current;
      const active = conversationsRef.current.find((c) => c.id === convId);
      if (!active) return;
      const history = capHistory(active.messages.filter((m) => m.status !== 'error' && m.content.trim() !== '').map((m) => ({ role: m.role, content: m.content })));
      const isFirst = active.messages.length === 0;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, title: isFirst ? titleFrom(trimmed) : c.title, messages: [...c.messages, { id: uid(), role: 'user', content: trimmed, parts: [], status: 'done' }] }
            : c,
        ),
      );
      void runStream(convId, history, trimmed);
    },
    [phase, runStream],
  );

  const stop = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    if (phase !== 'idle') return;
    const convId = activeIdRef.current;
    const active = conversationsRef.current.find((c) => c.id === convId);
    if (!active) return;
    const lastUser = [...active.messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== convId) return c;
        const msgs = c.messages.slice();
        while (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
        return { ...c, messages: msgs };
      }),
    );
    const history = capHistory(
      active.messages
        .filter((m) => m.role === 'user' || (m.status === 'done' && m.content.trim() !== ''))
        .filter((m) => m.id !== lastUser.id)
        .map((m) => ({ role: m.role, content: m.content })),
    );
    void runStream(convId, history, lastUser.content);
  }, [phase, runStream]);

  const newConversation = useCallback(() => {
    controllerRef.current?.abort();
    clearIdle();
    const c = newConv();
    setConversations((prev) => [c, ...prev]);
    setActiveId(c.id);
    setError(null);
    setPhase('idle');
    setAsOf(null);
  }, [clearIdle]);

  const selectConversation = useCallback(
    (id: string) => {
      if (id === activeIdRef.current) return;
      controllerRef.current?.abort();
      clearIdle();
      setActiveId(id);
      setError(null);
      setPhase('idle');
      setAsOf(null);
    },
    [clearIdle],
  );

  return { conversations, activeId, messages, phase, asOf, error, thinking, toggleThinking, send, stop, retry, newConversation, selectConversation };
}
