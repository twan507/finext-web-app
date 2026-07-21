# Chat Page Redesign — Implementation Plan (`/chat` ring + UI/UX)

> **HISTORICAL — COMPLETED / EVOLVED:** Redesign đã hoàn thành; lịch sử hội thoại hiện còn được persist server-side, nên code `/chat` tại HEAD ghi đè phạm vi phiên bên dưới.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox (`- [ ]`).

**Goal:** Biến `/chat` thành khung "ring" kiểu ChatGPT/Claude (panel lịch sử + khu chat, thoát 1400px, full-height) trong appbar+rail Finext, + làm lại render bảng/typography.

**Architecture:** Thêm 1 nhánh `/chat` vào `LayoutContent` (full-width như `/charts`). `useChatStore` refactor 1→nhiều hội thoại (mức phiên). `PageContent` dựng ring: `ConversationSidebar` (cuộn riêng) + khu chat (cột 760px + composer dính đáy). `MessageBubble` render bảng đẹp (tabular-nums, canh phải cột số, viền nhẹ).

**Tech Stack:** Next.js 15.5 · React 19 · TS strict · MUI 7.1 · react-markdown@10 + remark-gfm@4 (đã có) · KHÔNG dep mới.

## Global Constraints
- **Verify = `cd finext-nextjs && npx tsc --noEmit` (0 lỗi).** KHÔNG chạy next build / browser — owner tự test UI. FE không có test runner.
- Không dep mới. TS strict (không `any` không comment). Component ≤150 dòng — tách nếu dài. Prettier: singleQuote, tabWidth 2, trailingComma none, arrowParens always.
- MUI sx units: `width:1`=100%, `m:1`=8px; pixel phải quote `'1px'`.
- Bám theme Finext (dùng `theme.palette` + `theme/tokens`), dark+light đều đẹp. `--up`=success, `--down`=error.
- Diff chung tối thiểu: `LayoutContent` chỉ thêm 1 nhánh, không refactor phần khác.
- Nhánh: `feat/chat-fe-v1`. Co-Authored-By trailer OK.

## Contract types (dùng xuyên tasks — Task 2 định nghĩa)
```ts
interface ToolChip { name: string; label: string; running: boolean; ok?: boolean; ms?: number }
type MessagePart = { kind: 'text'; text: string } | ({ kind: 'tool' } & ToolChip)
interface ChatMessage { id: string; role: 'user'|'assistant'; content: string; parts: MessagePart[]; status: 'streaming'|'done'|'error'|'interrupted' }
interface Conversation { id: string; title: string; createdAt: number; messages: ChatMessage[] }
// useChatStore() trả: { conversations, activeId, messages, phase, asOf, error, send, stop, retry, newConversation, selectConversation }
```

## File Structure
| File | Trách nhiệm |
|---|---|
| `app/(main)/LayoutContent.tsx` (sửa ~1019) | +nhánh `/chat` full-width full-height no-footer |
| `hooks/useChatStore.ts` (sửa) | 1→nhiều hội thoại + activeId + newConversation/selectConversation |
| `app/(main)/chat/components/ConversationSidebar.tsx` (mới) | panel lịch sử: new chat + list gom thời gian + collapse |
| `app/(main)/chat/components/MessageBubble.tsx` (sửa) | bảng đẹp lại + typography |
| `app/(main)/chat/PageContent.tsx` (sửa) | ring: sidebar + khu chat (760px + composer dính đáy) |
| `app/(main)/chat/components/MessageList.tsx` (sửa) | cột 760px căn giữa (bỏ padding cũ) |

---

### Task 1: LayoutContent — chế độ full-width cho `/chat`

**Files:** Modify `finext-nextjs/app/(main)/LayoutContent.tsx:1019`

**Interfaces:** Produces: `/chat` render trong container full-width, `height: calc(100dvh - appBarHeight)`, `overflow: hidden`, không footer/maxWidth (PageContent tự quản scroll trong).

- [ ] **Step 1:** Sửa điều kiện nhánh fullscreen (dòng 1019) từ:
```tsx
        {currentPathname.startsWith('/charts') ? (
```
thành:
```tsx
        {currentPathname.startsWith('/charts') || currentPathname.startsWith('/chat') ? (
```
(Nhánh này đã: full-width, `height: calc(100dvh - appBarHeight - env(titlebar-area-height))`, `overflow: hidden`, `pb` mobile — đúng nhu cầu khu chat. Không đổi gì khác.)

- [ ] **Step 2:** Verify `cd finext-nextjs && npx tsc --noEmit` → 0 lỗi.
- [ ] **Step 3:** Commit
```bash
git add "finext-nextjs/app/(main)/LayoutContent.tsx"
git commit -m "feat(chat): /chat uses full-width full-height layout mode (escape 1400px)"
```

---

### Task 2: Store — refactor nhiều hội thoại (mức phiên)

**Files:** Modify (rewrite) `finext-nextjs/hooks/useChatStore.ts`

**Interfaces:** Produces `Conversation`, `UseChatStoreReturn` (xem Contract types). `messages` = messages của hội thoại active. Stream vẫn patch đúng hội thoại đang chạy dù user chuyển view (dùng `convIdRef`); nhưng chuyển hội thoại / new = **abort** stream hiện tại (v1 đơn giản).

- [ ] **Step 1:** Rewrite toàn bộ `hooks/useChatStore.ts`:
```ts
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
  send: (text: string) => void;
  stop: () => void;
  retry: () => void;
  newConversation: () => void;
  selectConversation: (id: string) => void;
  newChat: () => void; // alias newConversation — giữ PageContent cũ compile giữa các task
}

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
  const first = useRef<Conversation>(newConv());
  const [conversations, setConversations] = useState<Conversation[]>(() => [first.current]);
  const [activeId, setActiveId] = useState<string>(first.current.id);
  const [phase, setPhase] = useState<ChatPhase>('idle');
  const [asOf, setAsOf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const conversationsRef = useRef<Conversation[]>(conversations);
  conversationsRef.current = conversations;
  const activeIdRef = useRef<string>(activeId);
  activeIdRef.current = activeId;

  const controllerRef = useRef<AbortController | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const convIdRef = useRef<string>(''); // hội thoại đang stream
  const partsRef = useRef<MessagePart[]>([]);
  const pendingRef = useRef<string>('');
  const lastFlushRef = useRef<number>(0);
  const assistantIdRef = useRef<string>('');

  const messages = conversations.find((c) => c.id === activeId)?.messages ?? [];

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
        for await (const ev of streamChat({ history, message }, controller.signal)) {
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

  return { conversations, activeId, messages, phase, asOf, error, send, stop, retry, newConversation, selectConversation, newChat: newConversation };
}
```

- [ ] **Step 2:** Verify `npx tsc --noEmit` → **0 lỗi**. Alias `newChat: newConversation` giữ cho `PageContent.tsx` cũ (đang gọi `store.newChat`) vẫn compile; `messages/retry/send/stop/asOf/error/phase` vẫn còn nên MessageList/Composer cũ không vỡ. Task 5 sẽ rewrite PageContent dùng `newConversation/selectConversation/conversations`.

- [ ] **Step 3:** Commit
```bash
git add finext-nextjs/hooks/useChatStore.ts
git commit -m "feat(chat): store supports multiple in-session conversations"
```

---

### Task 3: ConversationSidebar (panel lịch sử)

**Files:** Create `finext-nextjs/app/(main)/chat/components/ConversationSidebar.tsx` (≤150 dòng)

**Interfaces:**
- Consumes: `Conversation` (Task 2).
- Produces: `ConversationSidebar({ conversations, activeId, collapsed, onNew, onSelect, onToggle }: { conversations: Conversation[]; activeId: string; collapsed: boolean; onNew: () => void; onSelect: (id: string) => void; onToggle: () => void })`.

- [ ] **Step 1:** Tạo component. Khi `collapsed` → render dải hẹp chỉ nút mở + nút new (icon). Khi mở (272px):
  - Header: nút "Cuộc trò chuyện mới" (`AddCommentOutlined` + chữ) full-width, hover viền accent; + nút collapse (`ChevronLeftOutlined`).
  - Danh sách cuộn riêng (`overflow-y:auto`): gom theo mốc thời gian bằng helper `bucketOf(createdAt)` → 'Hôm nay' | 'Hôm qua' | '7 ngày trước' | 'Cũ hơn' (so `Date.now()`), giữ thứ tự conversations (đã newest-first từ store). Mỗi bucket có eyebrow (chữ hoa nhỏ, letter-spacing). Item = title, cắt ellipsis 1 dòng, click `onSelect(id)`, active → nền `alpha(primary,0.14)`.
  - Nền `theme.palette.background.paper` (hoặc `alpha(text,0.02)`), viền phải `divider`. Full height của khu.
  Dùng `theme/tokens` (`getResponsiveFontSize`, `fontWeight`) + MUI. `bucketOf` so sánh mốc ngày địa phương (đầu ngày hôm nay/hôm qua). Vì mọi conv là "Hôm nay" trong phiên, grouping vẫn phải đúng khi có nhiều mốc.

- [ ] **Step 2:** Verify `npx tsc --noEmit` → 0 lỗi (component độc lập, chỉ nhận props).
- [ ] **Step 3:** Commit
```bash
git add "finext-nextjs/app/(main)/chat/components/ConversationSidebar.tsx"
git commit -m "feat(chat): ConversationSidebar (history panel, session-level)"
```

---

### Task 4: MessageBubble — bảng đẹp lại + typography

**Files:** Modify `finext-nextjs/app/(main)/chat/components/MessageBubble.tsx` (phần `MarkdownBody` `components`)

**Interfaces:** Không đổi props. Chỉ đổi cách render markdown (nhất là `table`).

- [ ] **Step 1:** Trong `MessageBubble.tsx`, thêm helper trước `MarkdownBody`:
```tsx
// Rút text thô từ children của 1 ô để đoán cột số.
function cellText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(cellText).join('');
  if (typeof node === 'object' && 'props' in (node as any)) return cellText((node as any).props?.children);
  return '';
}
// Ô số: chỉ chứa số + dấu +/−/%/,/. /khoảng trắng và có ít nhất 1 chữ số.
function isNumericCell(node: React.ReactNode): boolean {
  const t = cellText(node).trim();
  return t !== '' && /\d/.test(t) && /^[+\-−(]?[\d.,%\s)]+$/.test(t);
}
```

- [ ] **Step 2:** Thay `table`/`thead`/`th`/`td` trong object `components` của `MarkdownBody` bằng:
```tsx
          table: ({ children }) => (
            <Box sx={{ my: 1.75, border: `1px solid ${alpha(theme.palette.divider, 0.6)}`, borderRadius: 2, overflowX: 'auto', boxShadow: theme.palette.mode === 'dark' ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.06)' }}>
              <Table size="small" sx={{ '& td, & th': { borderColor: alpha(theme.palette.divider, 0.6) } }}>{children}</Table>
            </Box>
          ),
          thead: ({ children }) => <TableHead sx={{ '& th': { bgcolor: alpha(theme.palette.text.primary, 0.04) } }}>{children}</TableHead>,
          tbody: ({ children }) => <TableBody>{children}</TableBody>,
          tr: ({ children }) => <TableRow sx={{ '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.025) } }}>{children}</TableRow>,
          th: ({ children, style }) => (
            <TableCell sx={{ fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'text.secondary', whiteSpace: 'nowrap', textAlign: (style?.textAlign as 'left' | 'right' | 'center') ?? (isNumericCell(children) ? 'right' : 'left'), py: 1.25 }}>
              {children}
            </TableCell>
          ),
          td: ({ children, style }) => {
            const numeric = isNumericCell(children);
            const align = (style?.textAlign as 'left' | 'right' | 'center') ?? (numeric ? 'right' : 'left');
            return (
              <TableCell sx={{ textAlign: align, fontVariantNumeric: 'tabular-nums', whiteSpace: numeric ? 'nowrap' : 'normal', py: 1.25 }}>{children}</TableCell>
            );
          },
```
(Giữ `a`/`code` như cũ. Thêm `import type React from 'react'` nếu cần cho type — file đã 'use client'; dùng `React.ReactNode`.)

- [ ] **Step 3:** Typography nhẹ trong `MarkdownBody` wrapper `Box` sx — đổi để thoáng hơn:
```tsx
    <Box sx={{ fontSize: getResponsiveFontSize('md'), lineHeight: 1.72, '& p': { my: 1 }, '& ul, & ol': { my: 1, pl: 3 }, '& li': { mb: 0.5 }, '& h3': { fontSize: '1.05rem', fontWeight: 700, mt: 2.5, mb: 1, letterSpacing: '-0.01em' }, '& h2': { fontSize: '1.15rem', fontWeight: 700, mt: 2.5, mb: 1 }, '& strong': { fontWeight: 650 } }}>
```

- [ ] **Step 4:** Verify `npx tsc --noEmit` → 0 lỗi.
- [ ] **Step 5:** Commit
```bash
git add "finext-nextjs/app/(main)/chat/components/MessageBubble.tsx"
git commit -m "feat(chat): richer markdown tables (tabular-nums, right-aligned numeric cols, subtle borders)"
```

---

### Task 5: PageContent ring + MessageList 760px + wire

**Files:** Modify `finext-nextjs/app/(main)/chat/PageContent.tsx`; Modify `finext-nextjs/app/(main)/chat/components/MessageList.tsx`

**Interfaces:** Consumes store (Task 2: `conversations/activeId/messages/phase/asOf/error/send/stop/retry/newConversation/selectConversation`), `ConversationSidebar` (Task 3).

- [ ] **Step 1:** `MessageList.tsx` — kẹp cột 760px căn giữa (khu chat full-width). Đổi container ngoài:
```tsx
    <Box ref={scrollRef} onScroll={onScroll} sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <Box sx={{ maxWidth: 760, mx: 'auto', px: { xs: 2, md: 3 }, py: 3 }}>
        {messages.map((m, idx) => { /* giữ nguyên map hiện tại */ })}
      </Box>
    </Box>
```
(Giữ nguyên logic map + AssistantBlock + auto-scroll. `scrollRef` giờ là container ngoài `flex:1 overflowY:auto`; inner box là cột 760.)

- [ ] **Step 2:** `PageContent.tsx` — dựng ring. Rewrite `ChatApp` + `PageContent`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import OptionalAuthWrapper from 'components/auth/OptionalAuthWrapper';
import { useAuth } from 'components/auth/AuthProvider';
import useChatStore from '../../../hooks/useChatStore';
import ConversationSidebar from './components/ConversationSidebar';
import MessageList from './components/MessageList';
import Composer from './components/Composer';
import EmptyState from './components/EmptyState';
import ConsentModal from './components/ConsentModal';
import AsOfChip from './components/AsOfChip';
import ChatSkeleton from './components/ChatSkeleton';

const CONSENT_KEY = 'finext-chat-consent';

function ChatApp() {
  const store = useChatStore();
  const { session } = useAuth();
  const [consented, setConsented] = useState<boolean | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (!session) return;
    setConsented(localStorage.getItem(CONSENT_KEY) === '1');
  }, [session]);
  const accept = () => {
    localStorage.setItem(CONSENT_KEY, '1');
    setConsented(true);
  };
  const streaming = store.phase !== 'idle';
  const hasMessages = store.messages.length > 0;

  return (
    <Box sx={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <ConversationSidebar
        conversations={store.conversations}
        activeId={store.activeId}
        collapsed={collapsed}
        onNew={store.newConversation}
        onSelect={store.selectConversation}
        onToggle={() => setCollapsed((v) => !v)}
      />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {hasMessages && (
          <Box sx={{ px: 3, pt: 1.5 }}>
            <Box sx={{ maxWidth: 760, mx: 'auto' }}>
              <AsOfChip asOf={store.asOf} />
            </Box>
          </Box>
        )}
        {hasMessages ? (
          <MessageList messages={store.messages} onRetry={store.retry} error={store.error} />
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex' }}>
            <EmptyState onPick={store.send} />
          </Box>
        )}
        <Composer disabled={consented !== true || streaming} streaming={streaming} onSend={store.send} onStop={store.stop} />
      </Box>
      {session && <ConsentModal open={consented === false} onAccept={accept} />}
    </Box>
  );
}

export default function PageContent() {
  return (
    <Box sx={{ height: '100%', minHeight: 0 }}>
      <OptionalAuthWrapper requireAuth loadingFallback={<ChatSkeleton />}>
        <ChatApp />
      </OptionalAuthWrapper>
    </Box>
  );
}
```
Lưu ý: LayoutContent (Task 1) đã cho container `height: calc(100dvh - appBarHeight)` `overflow:hidden`. PageContent dùng `height:'100%'` để lấp đầy; ring `display:flex` chiếm cả chiều cao; MessageList tự cuộn; Composer dính đáy. Bỏ `calc(100dvh-140px)` cũ.

- [ ] **Step 3:** Composer — bọc cột 760px căn giữa. Trong `Composer.tsx`, bọc nội dung trong `<Box sx={{ maxWidth: 760, mx: 'auto', width: '100%' }}>` và thêm viền trên + nền cho vùng composer (`borderTop: 1px divider`, `px: {xs:2, md:3}`, `py: 1.5`). (Đọc Composer.tsx hiện tại, chỉ bọc + thêm khung ngoài, giữ textarea/nút/disclaimer.)

- [ ] **Step 4:** Verify `npx tsc --noEmit` → 0 lỗi (đóng mọi lỗi consumer từ Task 2).
- [ ] **Step 5:** Commit
```bash
git add "finext-nextjs/app/(main)/chat/PageContent.tsx" "finext-nextjs/app/(main)/chat/components/MessageList.tsx" "finext-nextjs/app/(main)/chat/components/Composer.tsx"
git commit -m "feat(chat): ring layout (history sidebar + 760px chat column + pinned composer)"
```

---

## Điều kiện hoàn thành (khớp spec §7)
- [ ] `/chat` full-width thoát 1400px, full-height, không footer; appbar+rail Finext còn.
- [ ] Panel lịch sử: new/chuyển/gom thời gian; cuộn riêng; thu gọn được.
- [ ] Nhiều hội thoại trong phiên (chuyển qua lại giữ nội dung).
- [ ] Bảng: số canh phải tabular, viền nhẹ, header mờ, bảng rộng cuộn ngang trong khung.
- [ ] Cột 760px; composer dính đáy; stream cuộn riêng.
- [ ] `npx tsc --noEmit` = 0. Owner test browser (layout/scroll/bảng/đổi hội thoại/mobile).

## Ngoài scope: persistence · feedback-DB · quota · suggested prompt từ briefing (Bước 3).
