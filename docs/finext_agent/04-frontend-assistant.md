# 04 — Bước 4: Frontend `/chat`

> **Vai trò trong lộ trình:** mặt tiền của agent. Nguyên tắc: **diff tối thiểu vào code chung** (`apiClient` chỉ thêm 1 nhánh), mọi thứ mới nằm gọn trong `services/chatClient.ts` + `app/(main)/chat/`. Chat phải trông cùng ngôn ngữ thiết kế FINEXT AI đã có ở `/phase`.
> **Phụ thuộc:** chỉ cần contract stream (02 §3) đã chốt — làm song song với backend, test bằng endpoint echo giả của bước 2.
> **Snapshot as-built 2026-07-21:** lát cắt client-held ngày 2026-07-15 đã được mở rộng đầy đủ. Hiện có `/chat`, `/chat/[id]`, persistence/sidebar/history/ghim/đổi tên/xoá/feedback/quota, thinking toggle và chat bubble theo ngữ cảnh trang. Spec V1 slice chỉ còn là lịch sử triển khai.

---

## 1. Hiện Trạng

| Hạng mục | Trạng thái |
|----------|-----------|
| `apiClient` + refresh-token flow | ✅ `sendStreamRequest()` trả `Response` thô và vẫn đi qua refresh-token flow |
| Ngôn ngữ thiết kế glass/ambient của `/phase` | ✅ cùng định hướng thị giác; chat dùng component MUI/Markdown riêng, không import trực tiếp `AmbientCard` hay `AiCommentBody` |
| Guard: `OptionalAuthWrapper requireAuth` + skeleton loading 2 giai đoạn | ✅ pattern market-phase |
| Store pattern (Zustand-like: `useChartStore`...) | ✅ copy pattern |
| `chatClient.ts`, `chatConversations.ts`, `chatQuota.ts`, `useChatStore`, page/components | ✅ |
| Nav item + route | ✅ "Finext AI" → `/chat`; mỗi hội thoại có `/chat/[id]` |
| Chat bubble theo ngữ cảnh | ✅ chỉ mount store sau lần mở đầu; ẩn ở `/chat`, `/profile`, news/report và các trang không hỗ trợ |

## 2. Cấu Trúc

```
finext-nextjs/
├── services/
│   ├── apiClient.ts            # +1 nhánh responseType 'stream' (trả Response thô chưa đọc body)
│   ├── chatClient.ts           # POST SSE parser + event union
│   ├── chatConversations.ts    # REST history/pin/rename/delete/feedback
│   └── chatQuota.ts            # REST quota
├── hooks/useChatStore.ts
├── components/chatBubble/      # cửa sổ chat theo ngữ cảnh trang
└── app/(main)/chat/
    ├── page.tsx                # metadata
    ├── PageContent.tsx         # client — guard + layout
    └── components/             # component chat chuyên biệt; một số file hiện >150 dòng
        MessageList · MessageBubble · ToolChip · Composer(+nút dừng)
        ConversationSidebar · AsOfChip · ChatSkeleton · WidgetRenderer
```

- Route `/chat`, nav "Finext AI" (owner chốt 2026-07-15). Guard `OptionalAuthWrapper requireAuth` như market-phase.
- **Vì sao stream đi qua `_sendRequest` của `apiClient`:** hưởng nguyên refresh-token flow — 401 throw TRƯỚC khi stream mở → retry với token mới, chưa mất byte nào. Đây là lý do không dùng `EventSource` (GET-only, không gửi được Authorization + body) và không thêm Next.js route handler (giữ provider/RBAC ở FastAPI, tránh thêm một proxy hop). Lưu ý triển khai hiện tại vẫn nạp chung `.env.production` vào container Next.js; xem file 05 §3.

## 3. Parser Stream (thiết kế từ spec cũ — giữ nguyên, đã đúng)

`streamChat(body, signal)` = async generator: đọc `res.body.getReader()`, buffer split `\n\n`, mỗi frame lấy dòng `data:` → JSON → yield `ChatEvent`. Union hiện có 9 type: `meta`, `token`, `tool_start`, `tool_end`, `title`, `message_saved`, `done`, `quota_warn`, `error`. Comment `: hb` tự rơi qua.

Vòng đời + phòng thủ:
- `AbortController.abort()` khi user bấm dừng; store cố ý **không abort khi component unmount** để stream có thể chạy xong và lưu DB khi chuyển từ bubble sang `/chat`.
- **Idle watchdog ~45s** reset khi parser yield một `ChatEvent`, không phải theo byte thô. `chatClient` bỏ comment `: hb` trước khi store thấy, nên khoảng 45 giây chỉ có heartbeat mà không có event dữ liệu vẫn bị abort + báo lỗi. Đây là gap hiện hành giữa heartbeat server và watchdog FE.
- `error` giữa chừng → GIỮ text đã nhả + nút "Thử lại" (retry gửi lại message cuối).

## 4. Store & Hiển Thị Tool Chip (điểm đổi so spec cũ — theo mô hình query)

`useChatStore`: quản lý conversations/activeId/messages, phase `idle|waiting|streaming|tool`, as-of, lỗi/limit notice/quota warning, thinking toggle và lazy-load history. Actions gồm send/stop/retry/new/select/delete/pin/rename/feedback.

Tool chip: FE chỉ render `label` server gửi trong `tool_start`; nhiều call song song được cập nhật bằng `tool_end`. Khi tải lịch sử, store hiện **không tái dựng chip** từ `tool_calls`; assistant cũ chỉ render content đã lưu.

## 5. Render Assistant — ✅ ĐÃ CHỐT 2026-07-14: markdown + bảng + widget

> Nguồn sự thật: [spec 2026-07-14](../superpowers/specs/2026-07-14-agent-v1-slice-and-chat-render-design.md) §D4.
> Nguyên tắc: **model tả Ý (JSON spec), FE vẽ HÌNH (component whitelist). Không bao giờ mount HTML do model viết.**

2 tầng render trong `MessageBubble`:

1. **Markdown:** `react-markdown` + `remark-gfm` (dep mới — owner đã duyệt 2026-07-14). Bảng GFM style theo theme.
   Thư viện mặc định KHÔNG render raw HTML → luật cấm-HTML được enforce miễn phí, không cần sanitizer.
2. **Widget:** custom renderer cho code fence lang=`finext-widget`, body JSON phải có `template`.
   Whitelist hiện có 12 template: `kpi`, `line`, `area`, `bar`, `bar_h`, `grouped_bar`, `pie`, `heatmap`, `scatter`, `treemap`, `radar`, `gauge`. Chart dùng ECharts lazy-load; KPI dùng MUI. Không có template `candle`.

Luật render: JSON hỏng / `template` lạ → fallback code block xám, không crash; có React error boundary ·
màu tăng/giảm + format số VN theo convention app · fence chưa đóng khi đang stream → skeleton "Đang dựng biểu đồ…",
widget chỉ mount khi fence đóng · contract SSE 02 §3 không đổi (widget đi in-band trong `token` text), backend
không biết widget tồn tại — widget spec là hợp đồng **PACK ↔ FE**.

UX hiện có: optimistic user bubble · auto-scroll · copy/retry · feedback 👍👎 · `AsOfChip` (đang ẩn vì backend meta hiện trả null) · disclaimer dưới composer · sidebar desktop/drawer mobile · URL riêng hội thoại · limit/quota warning · thinking toggle lưu localStorage.

Bổ sung as-built từ audit:
- **Không có consent modal riêng:** user đã đồng ý Chính sách nội dung + Bảo mật khi tạo tài khoản; `/policies/privacy` có mục Finext AI.
- **Empty state/chat bubble:** prompt gợi ý lấy từ pool tĩnh theo route/tab, không sinh từ briefing server.
- **Feedback:** 👍/👎 gọi `PATCH /chat/messages/{id}/feedback`; backend nhận `reason` tùy chọn nhưng UI hiện chưa hỏi chip lý do.
- **Nút copy** chỉ hiện khi assistant message đã `done`.

## 6. Rủi Ro & Xử Lý

| # | Rủi ro | Xử lý |
|---|--------|-------|
| R1 | `react-markdown` re-parse toàn message mỗi chunk → có thể giật khi message dài | Runtime chưa có throttle/memo chuyên dụng; nếu đo thấy jank thì throttle cập nhật ~100ms và memo block hoàn chỉnh. Widget đã chỉ mount khi fence đóng |
| R2 | Frame SSE bị cắt giữa multibyte UTF-8 (tiếng Việt!) → ký tự lỗi | `TextDecoder(..., {stream: true})` đã xử lý đúng — nhưng phải có test case chuỗi tiếng Việt cắt giữa byte |
| R3 | User refresh trang giữa stream → mất phần đang nhả | assistant partial **không được lưu**; user message đã persist nên có thể retry. Resume stream chưa có. |
| R4 | Mobile: bàn phím che composer, viewport nhảy | dùng `100dvh` + scroll container riêng cho MessageList; test sớm trên điện thoại thật vì nhóm NĐT dùng mobile nhiều |
| R5 | Hai tab cùng mở chat | backend hiện không có semaphore per-user; cả hai có thể chạy và cùng tiêu quota |
| R6 | Model xuất widget sai schema thường xuyên → user thấy nhiều code block xám | Fallback xám đã có; metric tỷ lệ fallback chưa có. Nếu cao, bổ sung đo rồi sửa PACK/ví dụ schema thay vì nới whitelist FE |

## 7. Điều Kiện Hoàn Thành Bước 4

- [x] `/chat` + `/chat/[id]`, parser 9 event, history CRUD, quota, feedback, thinking toggle và chat bubble đã có.
- [x] Markdown/GFM + 12 template widget; JSON/template lỗi fallback xám, fence dở hiện skeleton.
- [x] Idle watchdog 45 giây, stop/retry/copy và error state có trong store/UI.
- [x] Privacy policy + consent ở đăng ký; không có modal chat theo quyết định hiện hành.
- [ ] `as_of` chip chưa nhận được mốc vì backend meta đang trả null.
- [ ] UI chưa thu lý do 👎 dù backend schema hỗ trợ `reason`.
- [ ] Mobile/production visual QA vẫn là bước kiểm tay khi deploy.
