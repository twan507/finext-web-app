# Chat FE V1 Slice — Design (`/chat`)

> **HISTORICAL — IMPLEMENTED:** Slice này đã được triển khai và sau đó mở rộng thêm persistence, URL hội thoại, quota, feedback, thinking toggle và chat bubble. Code trang /chat và **docs/finext_agent/04-frontend-assistant.md** là nguồn hiện tại.

> **Trạng thái:** design đã chốt hướng (owner: "làm thế nào tối ưu nhất"), chờ review spec trước khi lên plan.
> **Ngày:** 2026-07-15.
> **Đây là gì:** lát cắt V1 của **Bước 4** ([`04-frontend-assistant.md`](../../finext_agent/04-frontend-assistant.md)) — làm mặt tiền chat **trước** Bước 3 (persistence/quota), tận dụng contract stream đã đóng băng.
> **Nguồn sự thật render:** [spec 2026-07-14](2026-07-14-agent-v1-slice-and-chat-render-design.md) §D4 (markdown + bảng + widget). Spec này KHÔNG lặp lại, chỉ tham chiếu.

---

## 1. Quyết định chốt trong slice này

| # | Quyết định | Giá trị |
|---|-----------|---------|
| 1 | Route | **`/chat`** (owner đổi từ `/assistant` — roadmap §5) |
| 2 | Nav label | **"Finext AI"** (mặc định roadmap) |
| 3 | Mô hình hội thoại | **Client-held multi-turn**: FE giữ transcript trong `useChatStore`, gửi lại mỗi lượt qua field `history`. KHÔNG lưu server (đó là Bước 3). |
| 4 | Consent modal NĐ 13/2023 | **IN** — cờ đồng ý lưu `localStorage`, chưa đồng ý thì composer disabled. Không cần backend. |

**Vì sao client-held multi-turn (không phải single-turn, không phải chờ Bước 3):** cho ra chat hội thoại dùng được ngay (hỏi tiếp "nó"/"mã đó"), chạm backend tối thiểu (~6 dòng), và **không phí công** — store/parser/render/component dựng ở đây đúng bằng thứ Bước 4 đầy đủ cần; Bước 3 sau này chỉ *cộng thêm* persistence lên trên (nạp history vào cùng store, POST feedback, xử lý 429). Mất hội thoại khi reload = chấp nhận ở v1 (roadmap 04 §6 R3).

---

## 2. Backend delta (toàn bộ phần chạm backend)

Endpoint `POST /api/v1/chat/stream` hiện **stateless single-turn** ([`routers/chat.py`](../../../finext-fastapi/app/routers/chat.py) L53 chỉ forward 1 message). Thêm field `history` để client mang transcript theo:

```diff
# app/schemas/chat.py
+from typing import Literal
+
+class ChatTurn(BaseModel):
+    role: Literal["user", "assistant"]
+    content: str = Field(min_length=1, max_length=8000)
+
 class ChatStreamRequest(BaseModel):
     message: str = Field(min_length=1, max_length=4000)
     conversation_id: str | None = None
+    history: list[ChatTurn] = Field(default_factory=list, max_length=20)  # client-held, v1 slice
```

```diff
# app/routers/chat.py  (_produce)
-        messages=[{"role": "user", "content": body.message}],
+        messages=[*(t.model_dump() for t in body.history), {"role": "user", "content": body.message}],
```

`max_length=20` (≤20 lượt) chặn chi phí token vô hạn khi hội thoại dài — cắt cứng ở v1, auto-summarize là ngoài scope (09 §8). Contract SSE 6 event **KHÔNG đổi**.

---

## 3. Kiến trúc FE & tận dụng lại

| Tận dụng (không xây lại) | Ở đâu |
|---|---|
| `apiClient` + refresh-token flow → **+1 nhánh** `responseType: 'stream'` (trả `Response` thô) | `services/apiClient.ts` |
| Guard `OptionalAuthWrapper requireAuth` + skeleton 2 giai đoạn | pattern `/market-phase` |
| Store pattern Zustand-like | pattern `useChartStore` |
| Ngôn ngữ thiết kế FINEXT AI (`AmbientCard`, `AiCommentBody`, glass card, token màu tăng/giảm) | `app/(main)/market-phase/components/` |
| `react-markdown` + `remark-gfm` (đã duyệt 2026-07-14) · `apexcharts` (sẵn có) | deps |

**Vì sao stream đi qua `apiClient._sendRequest`, KHÔNG dùng `EventSource`/Next route handler:** hưởng nguyên refresh-token flow — 401 throw TRƯỚC khi stream mở, retry với token mới, chưa mất byte (04 §2).

### File structure (theo 04 §2, đổi `/assistant`→`/chat`, bỏ phần deferred)
```
finext-nextjs/
├── services/
│   ├── apiClient.ts          # +1 nhánh stream
│   └── chatClient.ts         # MỚI: streamChat(body, signal) → AsyncGenerator<ChatEvent> (6 type)
├── hooks/useChatStore.ts     # MỚI: messages + streaming{phase,partial,toolLabel} + send/stop/retry/newChat
└── app/(main)/chat/
    ├── page.tsx              # metadata
    ├── PageContent.tsx       # client — guard + consent gate + layout
    └── components/           # mỗi cái ≤150 dòng
        MessageList · MessageBubble · ToolChip · Composer(+nút dừng)
        ConsentModal · EmptyState · AsOfChip · ChatSkeleton
```

---

## 4. Phạm vi — IN / DEFERRED

| ✅ IN slice này | ⏸ DEFERRED (Bước 3 — persistence) |
|---|---|
| Stream: gõ → `meta` → tool chip (`tool_start`/`tool_end`) → token nhả dần → `done` | ConversationSidebar / danh sách hội thoại |
| Multi-turn trong phiên (history client-held) | `loadConversation` từ DB / xem lại hội thoại cũ |
| Dừng giữa chừng (`AbortController`) giữ text · idle watchdog 45s | Feedback 👍👎 → `POST /chat/messages/{id}/feedback` |
| `error` giữa stream → giữ text + nút "Thử lại" (gửi lại message cuối) | Quota 60/ngày → xử lý 429 |
| Render: markdown + bảng GFM + widget (stat_tiles/bar_list/grouped_bars CSS · line=apexcharts) — spec 07-14 §D4 | Lưu qua reload (reload = chat mới) |
| Empty-state: 3-4 suggested prompt **tĩnh** (bấm là gửi) | Suggested prompt sinh từ briefing ngày |
| Nút copy · disclaimer dưới composer · consent modal (localStorage) | `agent_user_profile` / bộ nhớ cá nhân hoá |
| `AsOfChip` (component sẵn, **dormant** vì `meta.as_of=null` ở slice này) | |
| "New chat" xóa store (bắt đầu hội thoại mới) | |

---

## 5. Vòng đời stream & phòng thủ (04 §3)

`streamChat(body, signal)` = async generator: `res.body.getReader()` + `TextDecoder(..., {stream:true})` (⚠ tiếng Việt cắt giữa multibyte), buffer split `\n\n`, mỗi frame lấy dòng `data: ` → JSON → yield `ChatEvent`. Comment `: hb` (heartbeat) tự rơi qua vì không có `data: `.

- `AbortController.abort()` khi user bấm dừng / rời trang → server hủy LLM call (ngừng tốn token — đã có ở `chat.py` L92).
- **Idle watchdog ~45s** không nhận byte nào → coi như đứt → abort + báo lỗi (fetch không timeout mặc định).
- `error` frame → giữ text đã nhả + nút "Thử lại".

## 6. Render (tham chiếu spec 07-14 §D4 — KHÔNG lặp lại luật ở đây)

2 tầng trong `MessageBubble`: (1) `react-markdown`+`remark-gfm` — thư viện mặc định KHÔNG render raw HTML → luật cấm-HTML enforce miễn phí; (2) widget renderer cho code fence `lang=finext-widget` (JSON `{v:1,type,...}`). JSON hỏng/type lạ/`v`≠1 → fallback code block xám, không crash. Fence chưa đóng khi đang stream → skeleton "Đang dựng biểu đồ…". Throttle re-render ~100ms + memo block đã xong (04 §6 R1).

---

## 7. Global constraints (mọi task kế thừa)

- **KHÔNG thêm dependency mới.** `react-markdown`+`remark-gfm` đã duyệt 2026-07-14; `apexcharts` sẵn có. Bất kỳ dep nào khác → hỏi owner (quy ước dự án).
- TypeScript `strict: true` — không `any` không kèm comment lý do; không `@ts-ignore` không giải thích.
- Component ≤150 dòng (CLAUDE.md) — tách nếu dài.
- **Verify = `tsc --noEmit` = 0 lỗi.** KHÔNG tự chạy `next build` / dựng browser / Playwright — **owner tự test UI** (quy ước dự án).
- Diff tối thiểu vào code chung: `apiClient` chỉ thêm 1 nhánh, không refactor xung quanh.

## 8. Điều kiện hoàn thành slice (con của 04 §7, bỏ phần persistence)

- [ ] `tsc --noEmit` = 0 lỗi.
- [ ] Backend: `history` forward vào `run_agent`; pytest cũ vẫn pass + test mới cho multi-turn history.
- [ ] E2E với endpoint thật: gõ → chip tool → chữ nhả dần → done; hỏi tiếp "nó/mã đó" đúng ngữ cảnh; bấm dừng giữ text.
- [ ] Render giàu: bảng GFM đúng theme dark/light; 4 widget type từ fixture; JSON hỏng → fallback xám; fence chưa đóng → skeleton.
- [ ] Lỗi: `error` giữa stream → giữ text + nút thử lại; idle 45s → tự báo đứt.
- [ ] Consent modal chặn đúng lần đầu (localStorage); empty state hiện suggested prompts; copy hoạt động.
- [ ] Mobile pass tay: bàn phím che composer (`100dvh` + scroll container riêng), chip không vỡ layout.

## 9. Ngoài scope slice (nhắc để khỏi trôi)
Persistence 3 collection · quota/429 · feedback-DB · profile/memory · sidebar history · suggested prompt từ briefing · resumable stream. Tất cả thuộc Bước 3 ([`03`](../../finext_agent/03-persistence-quota-cost.md)/[`08`](../../finext_agent/08-database-design-memory.md)).
