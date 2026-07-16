# Chat FE V1 Slice — Implementation Plan (`/chat`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Chat hội thoại "Finext AI" chạy được trên web tại `/chat` — gõ câu hỏi → stream câu trả lời (tool chip + markdown + bảng + widget) → hỏi tiếp trong phiên; dừng/thử lại được.

**Architecture:** FE giữ transcript trong `useChatStore`, gửi lại mỗi lượt qua field `history` mới của endpoint `POST /api/v1/chat/stream` (đã có, JWT). Stream đi qua `apiClient` (+1 nhánh `responseType:'stream'`) để hưởng refresh-token flow; `chatClient.ts` parse SSE thành `AsyncGenerator<ChatEvent>`. Render 2 tầng trong `MessageBubble`: `react-markdown`+`remark-gfm` + WidgetRenderer whitelist. Không persistence (Bước 3), không mount HTML từ model.

**Tech Stack:** Next.js 15.5 App Router · React 19 · TypeScript 5.7 strict · MUI 7.1 + Emotion · `react-markdown`+`remark-gfm` (cài mới, đã duyệt) · `apexcharts`+`react-apexcharts` (sẵn có).

## Global Constraints

- **Verify FE = `cd finext-nextjs && npx tsc --noEmit` (0 lỗi).** KHÔNG chạy `next build` / dựng browser / Playwright — owner tự test UI (quy ước dự án). FE KHÔNG có test runner.
- **Verify backend = `cd finext-fastapi && uv run pytest <file> -v`** (asyncio_mode=auto — `async def test_*` chạy trực tiếp, không cần decorator).
- **Chỉ dep mới được phép:** `react-markdown` + `remark-gfm` (owner duyệt 2026-07-14). Dep khác → DỪNG, hỏi owner.
- TypeScript `strict`: không `any` không kèm comment lý do; không `@ts-ignore` không giải thích. Component ≤150 dòng — tách nếu dài.
- Style prettier repo: `singleQuote: true, tabWidth: 2, trailingComma: none, arrowParens: always`. Dùng design token `theme/tokens` (`getResponsiveFontSize`, `fontWeight`, `transitions`, `layoutTokens`) như `/market-phase`.
- **MUI sx units:** `width:1`=100%, `m:1`=8px. Dùng pixel phải quote `'1px'`. Sai → overflow viewport.
- Diff tối thiểu vào code chung: `apiClient`/`types.ts` chỉ THÊM, không refactor. Không xóa commented code.
- **Không bao giờ mount HTML do model viết.** `react-markdown` mặc định không render raw HTML — giữ nguyên (không thêm `rehype-raw`).
- K-hygiene: UI không tự ý in ký hiệu DB thô; chỉ render đúng text model trả. (FE không sinh nội dung phân tích.)

## Contract SSE (đóng băng — nguồn: `app/agent/loop.py`, `app/routers/chat.py`)

Wire: mỗi frame `data: {json}\n\n`; heartbeat `: hb\n\n` (bỏ qua). Thứ tự: `meta` → (`token`|`tool_start`|`tool_end`)* → `done`|`error`.

| event | payload | ghi chú |
|---|---|---|
| `meta` | `{conversation_id, message_id, as_of}` | `as_of` = `null` ở slice này |
| `token` | `{text}` | nối vào bubble đang stream |
| `tool_start` | `{name, label}` | KHÔNG có id — chip khớp theo `name` |
| `tool_end` | `{name, ok, ms}` | đổi chip running→✓/✗ theo `name` |
| `done` | `{usage, truncated}` | kết thúc bình thường |
| `error` | `{message}` | giữ text đã nhả + nút Thử lại |

## File Structure

| File | Trách nhiệm |
|---|---|
| `finext-fastapi/app/schemas/chat.py` (sửa) | +`ChatTurn`, +`history` field |
| `finext-fastapi/app/routers/chat.py` (sửa) | +`_messages_from()` helper, forward history |
| `finext-fastapi/tests/routers/test_chat_messages.py` (mới) | test schema + helper |
| `finext-nextjs/services/core/types.ts` (sửa) | +`'stream'` vào `responseType` |
| `finext-nextjs/services/apiClient.ts` (sửa) | +nhánh stream, +`sendStreamRequest()` |
| `finext-nextjs/services/chatClient.ts` (mới) | `ChatEvent` types + `streamChat()` parser |
| `finext-nextjs/hooks/useChatStore.ts` (mới) | state machine hội thoại |
| `finext-nextjs/app/(main)/chat/components/MessageBubble.tsx` (mới) | render markdown + widget |
| `finext-nextjs/app/(main)/chat/components/WidgetRenderer.tsx` (mới) | whitelist widget |
| `finext-nextjs/app/(main)/chat/components/widgets/*.tsx` (mới) | StatTiles/BarList/GroupedBars/LineChart |
| `finext-nextjs/app/(main)/chat/components/{MessageList,ToolChip,Composer,EmptyState,ConsentModal,AsOfChip,ChatSkeleton}.tsx` (mới) | UI kit |
| `finext-nextjs/app/(main)/chat/PageContent.tsx` + `page.tsx` (mới) | shell + guard + wire |
| `finext-nextjs/app/(main)/LayoutContent.tsx` (sửa) | +nav item "Finext AI" |

---

### Task 1: Backend — forward conversation history

**Files:**
- Modify: `finext-fastapi/app/schemas/chat.py`
- Modify: `finext-fastapi/app/routers/chat.py:39-55` (`_produce`)
- Test: `finext-fastapi/tests/routers/test_chat_messages.py`

**Interfaces:**
- Produces: `ChatStreamRequest.history: list[ChatTurn]`; `ChatTurn{role: 'user'|'assistant', content: str}`; `_messages_from(body) -> list[dict[str,str]]` (history rồi message hiện tại).

- [ ] **Step 1: Write failing test**

Create `finext-fastapi/tests/routers/test_chat_messages.py`:
```python
from app.routers.chat import _messages_from
from app.schemas.chat import ChatStreamRequest


def test_messages_from_appends_current_after_history():
    body = ChatStreamRequest(
        message="giá bây giờ?",
        history=[
            {"role": "user", "content": "HPG thế nào?"},
            {"role": "assistant", "content": "HPG đang tăng."},
        ],
    )
    assert _messages_from(body) == [
        {"role": "user", "content": "HPG thế nào?"},
        {"role": "assistant", "content": "HPG đang tăng."},
        {"role": "user", "content": "giá bây giờ?"},
    ]


def test_messages_from_empty_history_is_single_turn():
    body = ChatStreamRequest(message="FPT giá bao nhiêu?")
    assert _messages_from(body) == [{"role": "user", "content": "FPT giá bao nhiêu?"}]


def test_history_role_is_constrained():
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        ChatStreamRequest(message="x", history=[{"role": "system", "content": "y"}])
```

- [ ] **Step 2: Run — expect FAIL** (`ImportError: cannot import name '_messages_from'`)

Run: `cd finext-fastapi && uv run pytest tests/routers/test_chat_messages.py -v`

- [ ] **Step 3: Implement schema** — `app/schemas/chat.py`:
```python
from typing import Literal

from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatStreamRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None  # persistence ở session sau — v1 slice chưa lưu
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)  # client-held transcript
```

- [ ] **Step 4: Implement helper + forward** — `app/routers/chat.py`:

Add near top (after `STREAM_END`):
```python
def _messages_from(body: ChatStreamRequest) -> list[dict[str, str]]:
    """Ghép history (client giữ) + message hiện tại thành messages cho run_agent."""
    return [*(t.model_dump() for t in body.history), {"role": "user", "content": body.message}]
```
In `_produce`, replace the `messages=[...]` arg:
```python
        await run_agent(
            adapter=build_adapter(),
            gateway=gateway,
            ctx=ctx,
            system=system,
            messages=_messages_from(body),
            emit=emit,
        )
```

- [ ] **Step 5: Run — expect PASS** (3 passed). Also run full suite to confirm no regression: `cd finext-fastapi && uv run pytest -q` (expect 205+ passed).

- [ ] **Step 6: Commit**
```bash
git add finext-fastapi/app/schemas/chat.py finext-fastapi/app/routers/chat.py finext-fastapi/tests/routers/test_chat_messages.py
git commit -m "feat(chat): forward client-held history to run_agent"
```

---

### Task 2: FE — apiClient stream seam + chatClient parser

**Files:**
- Modify: `finext-nextjs/services/core/types.ts:10`
- Modify: `finext-nextjs/services/apiClient.ts` (add stream branch in `_sendRequest` res.ok block; export `sendStreamRequest`)
- Create: `finext-nextjs/services/chatClient.ts`

**Interfaces:**
- Produces:
  - `type ChatEvent` (union 6, khớp bảng Contract SSE).
  - `interface ChatStreamBody { message: string; history: { role: 'user' | 'assistant'; content: string }[]; conversation_id?: string }`
  - `function streamChat(body: ChatStreamBody, signal: AbortSignal): AsyncGenerator<ChatEvent>`
  - `sendStreamRequest(props): Promise<Response>` (apiClient).
- Consumes: `_sendRequestWithRefresh` (private, apiClient), `IRequest`.

- [ ] **Step 1: Add `'stream'` to responseType** — `types.ts:10`:
```ts
  responseType?: 'json' | 'blob' | 'text' | 'stream';
```

- [ ] **Step 2: apiClient stream branch** — trong `_sendRequest`, ngay TRƯỚC `if (responseType === 'json')` (bên trong block `if (res.ok)`):
```ts
            if (responseType === 'stream') {
                // Trả Response thô, CHƯA đọc body — chatClient sẽ getReader(). 401 đã throw trước
                // khi tới đây nên _sendRequestWithRefresh vẫn refresh + retry được.
                return { status: res.status, data: res as any, message: 'Stream response' } as StandardApiResponse<TResponseData>;
            }
```

- [ ] **Step 3: Export `sendStreamRequest`** — cuối `apiClient.ts`:
```ts
// ========== Streaming Request (SSE-over-POST) ==========
// Đi qua _sendRequestWithRefresh để hưởng refresh-token flow; trả Response thô cho caller tự đọc stream.
export const sendStreamRequest = async (props: Omit<IRequest, 'responseType'>): Promise<Response> => {
    const res = await _sendRequestWithRefresh<Response>({ ...props, responseType: 'stream' });
    if (!res.data) {
        throw { statusCode: 503, message: 'Không mở được luồng dữ liệu.' } as ApiErrorResponse;
    }
    return res.data;
};
```
(Bảo đảm `ApiErrorResponse` đã import — đã có ở dòng 3.)

- [ ] **Step 4: Create `services/chatClient.ts`**:
```ts
import { sendStreamRequest } from './apiClient';

export type ChatEvent =
  | { type: 'meta'; conversation_id: string; message_id: string; as_of: string | null }
  | { type: 'token'; text: string }
  | { type: 'tool_start'; name: string; label: string }
  | { type: 'tool_end'; name: string; ok: boolean; ms: number }
  | { type: 'done'; usage: Record<string, number>; truncated: boolean }
  | { type: 'error'; message: string };

export interface ChatStreamBody {
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  conversation_id?: string;
}

const KNOWN_TYPES = new Set(['meta', 'token', 'tool_start', 'tool_end', 'done', 'error']);

function parseFrame(frame: string): ChatEvent | null {
  // Mỗi frame là các dòng; lấy dòng bắt đầu 'data: '. Comment ': hb' → bỏ qua (không có data:).
  for (const line of frame.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    try {
      const obj = JSON.parse(payload);
      if (obj && typeof obj.type === 'string' && KNOWN_TYPES.has(obj.type)) {
        return obj as ChatEvent;
      }
    } catch {
      // frame hỏng — bỏ qua, không phá stream
    }
  }
  return null;
}

/** Stream chat từ backend. Ném lỗi khi abort (signal) hoặc network — store bắt để giữ text + Thử lại. */
export async function* streamChat(body: ChatStreamBody, signal: AbortSignal): AsyncGenerator<ChatEvent> {
  const res = await sendStreamRequest({
    url: '/api/v1/chat/stream',
    method: 'POST',
    body,
    nextOption: { signal },
  });
  if (!res.body) throw new Error('empty-stream-body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8'); // {stream:true} ở mỗi decode — an toàn multibyte tiếng Việt
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const ev = parseFrame(frame);
        if (ev) yield ev;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

- [ ] **Step 5: Verify** — `cd finext-nextjs && npx tsc --noEmit` → 0 lỗi.

- [ ] **Step 6: Commit**
```bash
git add finext-nextjs/services/core/types.ts finext-nextjs/services/apiClient.ts finext-nextjs/services/chatClient.ts
git commit -m "feat(chat): apiClient stream seam + chatClient SSE parser"
```

---

### Task 3: FE — useChatStore (state machine)

**Files:**
- Create: `finext-nextjs/hooks/useChatStore.ts`

**Interfaces:**
- Consumes: `streamChat`, `ChatEvent`, `ChatStreamBody` (Task 2).
- Produces:
  - `interface ToolChip { name: string; label: string; running: boolean; ok?: boolean; ms?: number }`
  - `interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; tools: ToolChip[]; status: 'streaming' | 'done' | 'error' | 'interrupted' }`
  - `type ChatPhase = 'idle' | 'waiting' | 'streaming' | 'tool'`
  - `interface UseChatStoreReturn { messages: ChatMessage[]; phase: ChatPhase; asOf: string | null; error: string | null; send: (text: string) => void; stop: () => void; retry: () => void; newChat: () => void }`
  - `default export function useChatStore(): UseChatStoreReturn`

- [ ] **Step 1: Implement** — pattern hook giống `hooks/useChartStore.ts` (useState + useRef + useCallback). Full code:
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
        // abort (dừng tay / idle 45s) hoặc network — giữ text đã nhả, đánh dấu interrupted.
        flushContent(true);
        patchAssistant((m) => (m.status === 'streaming' ? { ...m, status: 'interrupted' } : m));
        if (controllerRef.current?.signal.aborted) {
          setError((e) => e ?? 'Kết nối bị gián đoạn. Bạn thử lại nhé.');
        }
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
      const history = messagesRef.current
        .filter((m) => m.status !== 'error' && m.content.trim() !== '')
        .map((m) => ({ role: m.role, content: m.content }));
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
    const history = messagesRef.current
      .filter((m) => m.role === 'user' || (m.status === 'done' && m.content.trim() !== ''))
      .filter((m) => m.id !== lastUser.id)
      .map((m) => ({ role: m.role, content: m.content }));
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
```

- [ ] **Step 2: Verify** — `cd finext-nextjs && npx tsc --noEmit` → 0 lỗi.

- [ ] **Step 3: Commit**
```bash
git add finext-nextjs/hooks/useChatStore.ts
git commit -m "feat(chat): useChatStore state machine (send/stop/retry/newChat + idle watchdog)"
```

---

### Task 4: FE — MessageBubble + markdown render (cài deps)

**Files:**
- Create: `finext-nextjs/app/(main)/chat/components/MessageBubble.tsx`

**Interfaces:**
- Consumes: `ChatMessage`, `ToolChip` (Task 3); `WidgetRenderer` (Task 5 — tạm để markdown-only, Task 5 cắm widget vào).
- Produces: `MessageBubble({ message }: { message: ChatMessage })`.

- [ ] **Step 1: Cài deps (đã duyệt)**
```bash
cd finext-nextjs && npm install react-markdown remark-gfm
```
Expected: thêm vào `dependencies`, không lỗi peer (React 19 OK với react-markdown v9+).

- [ ] **Step 2: Implement MessageBubble (markdown-only ở task này)** — `app/(main)/chat/components/MessageBubble.tsx`:
```tsx
'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize } from 'theme/tokens';
import type { ChatMessage } from '../../../../hooks/useChatStore';

function MarkdownBody({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <Box sx={{ fontSize: getResponsiveFontSize('md'), lineHeight: 1.7, '& p': { my: 0.75 }, '& ul, & ol': { my: 0.75, pl: 3 } }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <TableContainer sx={{ my: 1.5, border: `1px solid ${alpha(theme.palette.divider, 0.2)}`, borderRadius: 1, overflowX: 'auto' }}>
              <Table size="small">{children}</Table>
            </TableContainer>
          ),
          thead: ({ children }) => <TableHead>{children}</TableHead>,
          tbody: ({ children }) => <TableBody>{children}</TableBody>,
          tr: ({ children }) => <TableRow>{children}</TableRow>,
          th: ({ children }) => <TableCell sx={{ fontWeight: 600, bgcolor: alpha(theme.palette.primary.main, 0.06) }}>{children}</TableCell>,
          td: ({ children }) => <TableCell>{children}</TableCell>,
          a: ({ children, href }) => (
            <Box component="a" href={href} target="_blank" rel="noopener noreferrer" sx={{ color: 'primary.main', textDecoration: 'underline' }}>
              {children}
            </Box>
          ),
          code: ({ children }) => (
            <Box component="code" sx={{ px: 0.5, py: 0.1, borderRadius: 0.5, bgcolor: alpha(theme.palette.text.primary, 0.08), fontSize: '0.9em' }}>
              {children}
            </Box>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </Box>
  );
}

function MessageBubbleBase({ message }: { message: ChatMessage }) {
  const theme = useTheme();
  const isUser = message.role === 'user';
  return (
    <Box sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', mb: 2 }}>
      <Box
        sx={{
          maxWidth: isUser ? '80%' : '100%',
          px: isUser ? 2 : 0,
          py: isUser ? 1.25 : 0,
          borderRadius: 2,
          bgcolor: isUser ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
        }}
      >
        {isUser ? (
          <Typography sx={{ fontSize: getResponsiveFontSize('md'), whiteSpace: 'pre-wrap' }}>{message.content}</Typography>
        ) : (
          <MarkdownBody text={message.content} />
        )}
      </Box>
    </Box>
  );
}

// memo: message dài + stream token → chỉ re-render bubble có content đổi.
export default memo(MessageBubbleBase);
```
Ghi chú: tool chip + trạng thái error/interrupted + copy sẽ được `MessageList` (Task 6) bọc quanh bubble; task này chỉ lo nội dung. Widget sẽ thay `MarkdownBody` bằng render tách fence ở Task 5.

- [ ] **Step 3: Verify** — `cd finext-nextjs && npx tsc --noEmit` → 0 lỗi.

- [ ] **Step 4: Commit**
```bash
git add finext-nextjs/package.json finext-nextjs/package-lock.json finext-nextjs/app/(main)/chat/components/MessageBubble.tsx
git commit -m "feat(chat): MessageBubble markdown render + react-markdown/remark-gfm"
```

---

### Task 5: FE — WidgetRenderer (finext-widget whitelist)

**Files:**
- Create: `finext-nextjs/app/(main)/chat/components/WidgetRenderer.tsx`
- Create: `finext-nextjs/app/(main)/chat/components/widgets/StatTiles.tsx`
- Create: `finext-nextjs/app/(main)/chat/components/widgets/BarList.tsx`
- Create: `finext-nextjs/app/(main)/chat/components/widgets/GroupedBars.tsx`
- Create: `finext-nextjs/app/(main)/chat/components/widgets/LineChart.tsx`
- Modify: `finext-nextjs/app/(main)/chat/components/MessageBubble.tsx` (tách fence → xen kẽ markdown + widget)

**Widget contract (PACK ↔ FE — schema FE định nghĩa, pack owner phải khớp; spec 07-14 §D4):**
```ts
// finext-widget fenced JSON, luôn có {v:1, type}
type Widget =
  | { v: 1; type: 'stat_tiles'; title?: string; tiles: { label: string; value: string; sub?: string; tone?: 'up' | 'down' | 'flat' }[] } // ≤6
  | { v: 1; type: 'bar_list'; title?: string; items: { label: string; value: number; note?: string }[] } // ≤20; value ± → xanh/đỏ, độ dài |value|/max
  | { v: 1; type: 'grouped_bars'; title?: string; series: string[]; groups: { label: string; values: number[] }[] } // series ≤3, groups ≤20
  | { v: 1; type: 'line'; title?: string; categories?: string[]; series: { name: string; points: number[] }[] }; // series ≤3, points ≤60
```
**Luật render (spec 07-14 §D4):** `v`≠1 / `type` lạ / JSON hỏng → fallback code block xám (không crash). Vượt cap → cắt + note nhỏ. Màu tăng=xanh (`success.main`) / giảm=đỏ (`error.main`). Fence CHƯA đóng khi stream → skeleton "Đang dựng biểu đồ…".

- [ ] **Step 1: Widget sub-components** (mỗi file ≤150 dòng, MUI/CSS thuần; `LineChart` dùng `react-apexcharts` dynamic import). Cài đặt:

`widgets/StatTiles.tsx` — grid ≤6 ô: `value` to (getResponsiveFontSize('h3')), `label` nhỏ text.secondary, màu theo `tone`. Dùng `Box display:grid gridTemplateColumns: repeat(auto-fit,minmax(120px,1fr))`.

`widgets/BarList.tsx` — mỗi item 1 hàng: nhãn trái, thanh ngang width `${Math.abs(value)/max*100}%`, màu `value>=0?success:error`, số phải. `max = Math.max(...items.map(i=>Math.abs(i.value)), 1)`.

`widgets/GroupedBars.tsx` — mỗi group 1 khối: nhãn + ≤3 thanh cạnh nhau (màu theo index series từ palette), legend series ở đầu.

`widgets/LineChart.tsx`:
```tsx
'use client';
import dynamic from 'next/dynamic';
import { useTheme } from '@mui/material';
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });
export default function LineChart({ categories, series }: { categories?: string[]; points... }) { /* map sang ApexOptions type:'line', theme.mode */ }
```
(Dùng đúng type `ApexOptions`; `theme.palette.mode` cho dark/light; height 260.)

- [ ] **Step 2: WidgetRenderer** — `WidgetRenderer.tsx`: nhận `json: string`, `parse` → validate `v===1 && type ∈ whitelist` → cắt cap → render sub-component; lỗi → `<Box component="pre">` xám. Áp cap: `tiles.slice(0,6)`, `items.slice(0,20)`, `groups.slice(0,20)`, `series.slice(0,3)`, `points.slice(0,60)`; nếu bị cắt hiện `<Typography variant="caption">…đã rút gọn</Typography>`.

- [ ] **Step 3: Tách fence trong MessageBubble** — thay `MarkdownBody` bằng bộ tách: regex `/```finext-widget\n([\s\S]*?)```/g` chia text thành đoạn markdown và block widget xen kẽ; render `MarkdownBody` cho đoạn text, `WidgetRenderer` cho block. Fence MỞ chưa đóng (` ```finext-widget ` không có ` ``` ` kết) khi `status==='streaming'` → render skeleton "Đang dựng biểu đồ…" (MUI `Skeleton variant="rounded" height={200}`), CHƯA mount widget. Full helper:
```tsx
function splitWidgets(text: string): { kind: 'md' | 'widget' | 'pending'; body: string }[] {
  const out: { kind: 'md' | 'widget' | 'pending'; body: string }[] = [];
  const re = /```finext-widget\s*\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: 'md', body: text.slice(last, m.index) });
    out.push({ kind: 'widget', body: m[1] });
    last = re.lastIndex;
  }
  const rest = text.slice(last);
  const openIdx = rest.indexOf('```finext-widget');
  if (openIdx !== -1) {
    if (openIdx > 0) out.push({ kind: 'md', body: rest.slice(0, openIdx) });
    out.push({ kind: 'pending', body: '' }); // fence chưa đóng → skeleton
  } else if (rest) {
    out.push({ kind: 'md', body: rest });
  }
  return out;
}
```
`MarkdownBody` phải strip block widget khỏi text nó nhận (đã tách rồi nên chỉ nhận đoạn `md`).

- [ ] **Step 4: Verify** — `cd finext-nextjs && npx tsc --noEmit` → 0 lỗi.

- [ ] **Step 5: Commit**
```bash
git add "finext-nextjs/app/(main)/chat/components"
git commit -m "feat(chat): WidgetRenderer whitelist (stat_tiles/bar_list/grouped_bars/line) + fence split"
```

---

### Task 6: FE — Chat UI kit (MessageList, ToolChip, Composer, EmptyState, ConsentModal, AsOfChip, ChatSkeleton)

**Files (mỗi file ≤150 dòng):**
- Create: `finext-nextjs/app/(main)/chat/components/ToolChip.tsx`
- Create: `finext-nextjs/app/(main)/chat/components/MessageList.tsx`
- Create: `finext-nextjs/app/(main)/chat/components/Composer.tsx`
- Create: `finext-nextjs/app/(main)/chat/components/EmptyState.tsx`
- Create: `finext-nextjs/app/(main)/chat/components/ConsentModal.tsx`
- Create: `finext-nextjs/app/(main)/chat/components/AsOfChip.tsx`
- Create: `finext-nextjs/app/(main)/chat/components/ChatSkeleton.tsx`

**Interfaces:**
- Consumes: `ChatMessage`, `ToolChip` type, `UseChatStoreReturn` (Task 3); `MessageBubble` (Task 4/5).
- Produces:
  - `ToolChip({ tool }: { tool: ToolChipType })` — chip: running → spinner + label; xong → ✓/✗ + "· {ms}ms".
  - `MessageList({ messages, onRetry }: { messages: ChatMessage[]; onRetry: () => void })` — render mỗi message: user bubble / assistant (tool chips xếp chồng trên + MessageBubble + hàng action: copy, và nếu `status==='error'|'interrupted'` → nút "Thử lại" gọi `onRetry`). Auto-scroll pin-to-bottom (ngừng pin khi user cuộn lên — dùng ref + scroll listener).
  - `Composer({ disabled, streaming, onSend, onStop }: { disabled: boolean; streaming: boolean; onSend: (t: string) => void; onStop: () => void })` — textarea auto-grow (Enter gửi, Shift+Enter xuống dòng), nút gửi; khi `streaming` → nút đổi thành "Dừng" gọi `onStop`. Disclaimer 1 dòng dưới composer: *"Thông tin tham khảo, không phải khuyến nghị đầu tư. AI có thể nhầm lẫn — kiểm tra số liệu quan trọng."*
  - `EmptyState({ onPick }: { onPick: (t: string) => void })` — tiêu đề "Finext AI" + 4 prompt chip TĨNH: `['VN-Index hôm nay thế nào?', 'FPT giá bao nhiêu?', 'So sánh HPG và HSG', 'Nhóm ngành nào đang mạnh?']`, bấm → `onPick`.
  - `ConsentModal({ open, onAccept }: { open: boolean; onAccept: () => void })` — MUI Dialog non-dismissable, 3 điểm NĐ 13/2023 (file 09 §2: dữ liệu dùng để trả lời, không tư vấn cá nhân hoá pháp lý, có thể sai), nút "Tôi đồng ý".
  - `ChatSkeleton()` — khung skeleton bám cấu trúc (KHÔNG spinner), cho `OptionalAuthWrapper loadingFallback`.

- [ ] **Step 1: Implement 7 components** theo interface trên. ToolChip mirror style chip market-phase (glass, `alpha`); Composer dùng MUI `InputBase`/`TextField multiline`; auto-scroll: `useRef<HTMLDivElement>` + `useEffect` scroll bottom khi messages đổi & `pinnedRef.current`. Copy dùng `navigator.clipboard.writeText`.

- [ ] **Step 2: Verify** — `cd finext-nextjs && npx tsc --noEmit` → 0 lỗi.

- [ ] **Step 3: Commit**
```bash
git add "finext-nextjs/app/(main)/chat/components"
git commit -m "feat(chat): UI kit (MessageList/ToolChip/Composer/EmptyState/ConsentModal/AsOfChip/ChatSkeleton)"
```

---

### Task 7: FE — Page shell + wire store

**Files:**
- Create: `finext-nextjs/app/(main)/chat/page.tsx`
- Create: `finext-nextjs/app/(main)/chat/PageContent.tsx`

**Interfaces:**
- Consumes: mọi component Task 6 + `useChatStore` (Task 3) + `OptionalAuthWrapper`.

- [ ] **Step 1: `page.tsx`** (mirror `market-phase/page.tsx`):
```tsx
import type { Metadata } from 'next';
import { Suspense } from 'react';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Finext AI',
  description: 'Trợ lý AI Finext — hỏi đáp về thị trường, cổ phiếu, nhóm ngành bằng ngôn ngữ tự nhiên.',
  openGraph: { title: 'Finext AI | Finext', description: 'Trợ lý AI phân tích thị trường chứng khoán Việt Nam.' },
};

export default function ChatPage() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: `PageContent.tsx`** — `'use client'`; `OptionalAuthWrapper requireAuth` (loadingFallback = `<ChatSkeleton />`); consent gate qua `localStorage` key `finext-chat-consent`; layout full-height (`height: 'calc(100dvh - <header>)'` scroll container riêng cho MessageList, Composer dính đáy); wire `useChatStore`. Cấu trúc:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import OptionalAuthWrapper from 'components/auth/OptionalAuthWrapper';
import useChatStore from '../../../hooks/useChatStore';
import MessageList from './components/MessageList';
import Composer from './components/Composer';
import EmptyState from './components/EmptyState';
import ConsentModal from './components/ConsentModal';
import AsOfChip from './components/AsOfChip';
import ChatSkeleton from './components/ChatSkeleton';

const CONSENT_KEY = 'finext-chat-consent';

function ChatApp() {
  const store = useChatStore();
  const [consented, setConsented] = useState(true);
  useEffect(() => { setConsented(localStorage.getItem(CONSENT_KEY) === '1'); }, []);
  const accept = () => { localStorage.setItem(CONSENT_KEY, '1'); setConsented(true); };
  const streaming = store.phase !== 'idle';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 140px)', minHeight: 0 }}>
      <AsOfChip asOf={store.asOf} />
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {store.messages.length === 0 ? <EmptyState onPick={store.send} /> : <MessageList messages={store.messages} onRetry={store.retry} />}
      </Box>
      <Composer disabled={!consented || streaming} streaming={streaming} onSend={store.send} onStop={store.stop} />
      <ConsentModal open={!consented} onAccept={accept} />
    </Box>
  );
}

export default function PageContent() {
  return (
    <Box sx={{ py: 2 }}>
      <OptionalAuthWrapper requireAuth loadingFallback={<ChatSkeleton />}>
        <ChatApp />
      </OptionalAuthWrapper>
    </Box>
  );
}
```
(Điều chỉnh `140px` theo chiều cao header thật nếu lệch — owner test.)

- [ ] **Step 3: Verify** — `cd finext-nextjs && npx tsc --noEmit` → 0 lỗi.

- [ ] **Step 4: Commit**
```bash
git add "finext-nextjs/app/(main)/chat/page.tsx" "finext-nextjs/app/(main)/chat/PageContent.tsx"
git commit -m "feat(chat): /chat page shell + consent gate + wire store"
```

---

### Task 8: FE — Nav item "Finext AI"

**Files:**
- Modify: `finext-nextjs/app/(main)/LayoutContent.tsx:16-27` (import icon), `:50-55` (nav array)

- [ ] **Step 1: Thêm icon import** — trong block `@mui/icons-material` (dòng 16-27) thêm:
```ts
  AutoAwesomeOutlined,
```

- [ ] **Step 2: Thêm nav item** — vào `navigationStructure` (đầu mảng, sau market-phase):
```ts
  { text: 'Finext AI', href: '/chat', icon: <AutoAwesomeOutlined /> },
```

- [ ] **Step 3: Verify** — `cd finext-nextjs && npx tsc --noEmit` → 0 lỗi.

- [ ] **Step 4: Commit**
```bash
git add "finext-nextjs/app/(main)/LayoutContent.tsx"
git commit -m "feat(chat): add Finext AI nav item -> /chat"
```

---

## Điều kiện hoàn thành (khớp slice spec §8)

- [ ] Backend: pytest Task 1 pass + full suite không regression.
- [ ] `npx tsc --noEmit` = 0 lỗi sau mỗi task FE.
- [ ] Owner test browser: gõ → chip tool → chữ nhả dần → done; hỏi tiếp "nó/mã đó" đúng ngữ cảnh; Dừng giữ text; bảng GFM + 4 widget render; JSON hỏng → fallback xám; fence chưa đóng → skeleton; error → giữ text + Thử lại; idle 45s tự đứt; consent chặn lần đầu; empty state prompts; mobile bàn phím OK.

## Ngoài scope (Bước 3): persistence · sidebar/history · feedback-DB · quota/429 · suggested prompt từ briefing · `agent_user_profile`.
