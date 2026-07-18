'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { streamChat, type ChatEvent } from '../services/chatClient';
import {
  deleteConversationApi,
  fetchConversationDetail,
  fetchConversations,
  renameConversationApi,
  sendFeedbackApi,
  setPinnedApi,
  type ConversationSummaryDTO,
  type MessageDTO,
} from '../services/chatConversations';

export interface ToolChip {
  name: string;
  label: string;
  running: boolean;
  ok?: boolean;
  ms?: number;
}
export type MessagePart = { kind: 'text'; text: string } | ({ kind: 'tool' } & ToolChip);
export interface ChatMessage {
  id: string; // id cục bộ (client)
  serverId?: string; // _id message backend — có sau 'message_saved' (live) / khi tải lại; cần cho 👍👎
  role: 'user' | 'assistant';
  content: string;
  parts: MessagePart[];
  status: 'streaming' | 'done' | 'error' | 'interrupted';
  feedback?: 1 | -1; // 👍 / 👎 đã chọn
}
export interface Conversation {
  id: string; // id cục bộ (client) — bằng serverId với hội thoại đã lưu, hoặc uid() với hội thoại mới chưa gửi
  serverId: string | null; // _id backend (null = chưa persist); gửi lên để nối đúng hội thoại + tải lại
  title: string;
  createdAt: number;
  messages: ChatMessage[];
  loaded: boolean; // đã tải messages từ backend chưa (lazy-load khi mở hội thoại cũ)
  pinned: boolean; // ghim → hiện nhóm "Đã ghim" ở đầu + miễn nhiễm prune
}
export type ChatPhase = 'idle' | 'waiting' | 'streaming' | 'tool';

export interface UseChatStoreReturn {
  conversations: Conversation[];
  activeId: string;
  messages: ChatMessage[];
  phase: ChatPhase;
  asOf: string | null;
  error: string | null;
  limitNotice: { message: string; detail: boolean } | null; // thanh nhỏ trên ô chat khi chạm limit (detail=có link xem chi tiết)
  thinking: boolean;
  historyLoading: boolean;
  msgLoading: boolean;
  toggleThinking: () => void;
  send: (text: string) => void;
  stop: () => void;
  retry: () => void;
  newConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  togglePin: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  sendFeedback: (messageServerId: string, rating: 1 | -1) => void;
  clearLimitNotice: () => void;
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
  return { id: uid(), serverId: null, title: 'Cuộc trò chuyện mới', createdAt: Date.now(), messages: [], loaded: true, pinned: false };
}
// Map DTO backend → Conversation (chưa tải messages: loaded=false, lazy khi mở).
function toConversation(c: ConversationSummaryDTO): Conversation {
  return { id: c.id, serverId: c.id, title: c.title, createdAt: Date.parse(c.updated_at) || Date.now(), messages: [], loaded: false, pinned: !!c.pinned };
}
// Map message backend → ChatMessage. Assistant render qua parts (1 text part = content markdown+widget);
// user render qua content (parts rỗng). tool chip không hiện lại khi done nên không cần tái dựng.
function toChatMessage(m: MessageDTO): ChatMessage {
  const rating = m.feedback?.rating;
  return {
    id: m.id,
    serverId: m.id,
    role: m.role,
    content: m.content,
    parts: m.role === 'assistant' ? [{ kind: 'text', text: m.content }] : [],
    status: m.interrupted ? 'interrupted' : 'done',
    feedback: rating === 1 ? 1 : rating === -1 ? -1 : undefined,
  };
}

export default function useChatStore(initialConversationId?: string): UseChatStoreReturn {
  const [conversations, setConversations] = useState<Conversation[]>(() => [newConv()]);
  const [activeId, setActiveId] = useState<string>(() => conversations[0]?.id ?? '');
  const [phase, setPhase] = useState<ChatPhase>('idle');
  const [asOf, setAsOf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitNotice, setLimitNotice] = useState<{ message: string; detail: boolean } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true); // tải danh sách hội thoại lúc mount
  const [msgLoading, setMsgLoading] = useState(false); // tải messages 1 hội thoại khi mở
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
  const listLoadedRef = useRef<boolean>(false); // chỉ tải danh sách 1 lần
  const msgLoadIdRef = useRef<string | null>(null); // id hội thoại đang tải messages (chống race)
  const pendingOpenRef = useRef<string | null>(initialConversationId ?? null); // serverId cần mở theo URL /chat/{id}

  const messages = conversations.find((c) => c.id === activeId)?.messages ?? [];

  useEffect(() => {
    try {
      if (localStorage.getItem(THINKING_KEY) === '1') setThinking(true);
    } catch {
      // localStorage không khả dụng — bỏ qua, giữ default false
    }
  }, []);

  // Tải danh sách hội thoại từ backend 1 lần lúc mount → nối vào sau conv rỗng ban đầu (đứng đầu).
  useEffect(() => {
    if (listLoadedRef.current) return;
    listLoadedRef.current = true;
    setHistoryLoading(true);
    fetchConversations()
      .then((list) => {
        const mapped = list.map(toConversation);
        setConversations((prev) => {
          const seen = new Set(prev.map((c) => c.serverId).filter(Boolean));
          return [...prev, ...mapped.filter((c) => !seen.has(c.serverId))];
        });
      })
      .catch(() => {
        // chưa đăng nhập / lỗi mạng → giữ local, không phá UI
      })
      .finally(() => setHistoryLoading(false));
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
    async (convId: string, serverId: string | null, history: HistoryTurn[], message: string) => {
      const controller = new AbortController();
      controllerRef.current = controller;
      convIdRef.current = convId;
      const assistantId = uid();
      assistantIdRef.current = assistantId;
      partsRef.current = [];
      pendingRef.current = '';
      lastFlushRef.current = 0;

      setError(null);
      setLimitNotice(null);
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
            // Backend gán conversation_id thật → gắn vào conv đang stream để lượt sau nối đúng + tải lại được.
            if (ev.conversation_id) {
              setConversations((prev) =>
                prev.map((c) => (c.id === convIdRef.current && !c.serverId ? { ...c, serverId: ev.conversation_id, loaded: true } : c)),
              );
            }
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
          case 'title':
            // Tiêu đề AI (hội thoại mới) → gắn vào conv theo serverId đã nhận ở 'meta'.
            if (ev.title) {
              setConversations((prev) => prev.map((c) => (c.serverId === ev.conversation_id ? { ...c, title: ev.title } : c)));
            }
            break;
          case 'message_saved':
            // Gắn _id thật của câu trả lời vừa lưu (dùng cho 👍👎).
            if (ev.message_id) patchAssistant((m) => ({ ...m, serverId: ev.message_id }));
            break;
          case 'done':
            flush(true);
            patchAssistant((m) => ({ ...m, status: 'done' }));
            break;
        }
      };

      try {
        resetIdle();
        for await (const ev of streamChat({ history, message, conversation_id: serverId ?? undefined, thinking: thinkingRef.current }, controller.signal)) {
          resetIdle();
          reduce(ev);
        }
      } catch (err: unknown) {
        flush(true);
        const status = (err as { statusCode?: number } | null)?.statusCode;
        if (status === 429 || status === 503) {
          // Chạm limit / server quá tải → bỏ bong bóng assistant rỗng, hiện thanh thông báo nhỏ trên ô chat.
          setConversations((prev) =>
            prev.map((c) => (c.id === convId ? { ...c, messages: c.messages.filter((m) => m.id !== assistantId) } : c)),
          );
          const msg = (err as { message?: string } | null)?.message;
          setLimitNotice({ message: msg || 'Bạn đã hết lượt trò chuyện.', detail: status === 429 });
        } else {
          patchAssistant((m) => (m.status === 'streaming' ? { ...m, status: 'interrupted' } : m));
          const aborted = controller.signal.aborted;
          setError((e) => e ?? (aborted ? 'Kết nối bị gián đoạn. Bạn thử lại nhé.' : 'Không lấy được phản hồi. Bạn thử lại nhé.'));
        }
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
      const serverId = active.serverId;
      const history = capHistory(active.messages.filter((m) => m.status !== 'error' && m.content.trim() !== '').map((m) => ({ role: m.role, content: m.content })));
      const isFirst = active.messages.length === 0;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, title: isFirst ? titleFrom(trimmed) : c.title, messages: [...c.messages, { id: uid(), role: 'user', content: trimmed, parts: [], status: 'done' }] }
            : c,
        ),
      );
      void runStream(convId, serverId, history, trimmed);
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
    void runStream(convId, active.serverId, history, lastUser.content);
  }, [phase, runStream]);

  const newConversation = useCallback(() => {
    const cur = conversationsRef.current;
    const active = cur.find((c) => c.id === activeIdRef.current);
    // Đã ở 1 chat rỗng chưa lưu → không tạo thêm (tránh nhiều "Cuộc trò chuyện mới").
    if (active && active.messages.length === 0 && !active.serverId) return;
    controllerRef.current?.abort();
    clearIdle();
    const c = newConv();
    // Dọn các conv rỗng chưa lưu khác khi mở chat mới.
    setConversations((prev) => [c, ...prev.filter((x) => x.serverId || x.messages.length > 0)]);
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
      setLimitNotice(null);
      setPhase('idle');
      setAsOf(null);
      // Hội thoại cũ (có serverId) chưa tải messages → lazy-load từ backend.
      const conv = conversationsRef.current.find((c) => c.id === id);
      if (conv && conv.serverId && !conv.loaded) {
        msgLoadIdRef.current = id;
        setMsgLoading(true);
        fetchConversationDetail(conv.serverId)
          .then((detail) => {
            if (!detail) return;
            setConversations((prev) =>
              prev.map((c) => (c.id === id ? { ...c, loaded: true, title: detail.title, messages: detail.messages.map(toChatMessage) } : c)),
            );
          })
          .catch(() => {
            // lỗi tải → để trống; user chọn lại để thử lại
          })
          .finally(() => {
            if (msgLoadIdRef.current === id) setMsgLoading(false);
          });
      }
    },
    [clearIdle],
  );

  // Mở hội thoại theo URL /chat/{id}: chờ danh sách tải xong (có serverId đó) rồi mở đúng 1 lần.
  useEffect(() => {
    const pid = pendingOpenRef.current;
    if (!pid) return;
    const conv = conversations.find((c) => c.serverId === pid);
    if (conv) {
      pendingOpenRef.current = null;
      selectConversation(conv.id);
    }
  }, [conversations, selectConversation]);

  const togglePin = useCallback((id: string) => {
    const conv = conversationsRef.current.find((c) => c.id === id);
    if (!conv || !conv.serverId) return; // chỉ ghim được hội thoại đã lưu
    const next = !conv.pinned;
    void setPinnedApi(conv.serverId, next).catch(() => {});
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, pinned: next } : c)));
  }, []);

  const clearLimitNotice = useCallback(() => setLimitNotice(null), []);

  const sendFeedback = useCallback((messageServerId: string, rating: 1 | -1) => {
    if (!messageServerId) return;
    void sendFeedbackApi(messageServerId, rating).catch(() => {});
    setConversations((prev) =>
      prev.map((c) => ({ ...c, messages: c.messages.map((m) => (m.serverId === messageServerId ? { ...m, feedback: rating } : m)) })),
    );
  }, []);

  const renameConversation = useCallback((id: string, title: string) => {
    const clean = title.trim().slice(0, 120);
    const conv = conversationsRef.current.find((c) => c.id === id);
    if (!conv || !clean || clean === conv.title) return;
    if (conv.serverId) void renameConversationApi(conv.serverId, clean).catch(() => {});
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: clean } : c)));
  }, []);

  const deleteConversation = useCallback((id: string) => {
    const cur = conversationsRef.current;
    const conv = cur.find((c) => c.id === id);
    if (!conv) return;
    if (conv.serverId) void deleteConversationApi(conv.serverId).catch(() => {});
    const wasActive = id === activeIdRef.current;
    const remaining = cur.filter((c) => c.id !== id);
    if (wasActive) {
      // Xoá hội thoại đang mở → về 1 chat mới rỗng (predictable, tránh mở nhầm conv cũ chưa lazy-load).
      controllerRef.current?.abort();
      clearIdle();
      const fresh = newConv();
      setConversations([fresh, ...remaining.filter((x) => x.serverId || x.messages.length > 0)]);
      setActiveId(fresh.id);
      setError(null);
      setPhase('idle');
      setAsOf(null);
    } else {
      setConversations(remaining.length ? remaining : [newConv()]);
    }
  }, [clearIdle]);

  return {
    conversations,
    activeId,
    messages,
    phase,
    asOf,
    error,
    limitNotice,
    thinking,
    historyLoading,
    msgLoading,
    toggleThinking,
    send,
    stop,
    retry,
    newConversation,
    selectConversation,
    deleteConversation,
    togglePin,
    renameConversation,
    sendFeedback,
    clearLimitNotice,
  };
}
