# 04 — Bước 4: Frontend `/assistant`

> **Vai trò trong lộ trình:** mặt tiền của agent. Nguyên tắc: **diff tối thiểu vào code chung** (`apiClient` chỉ thêm 1 nhánh), mọi thứ mới nằm gọn trong `services/chatClient.ts` + `app/(main)/assistant/`. Chat phải trông cùng ngôn ngữ thiết kế FINEXT AI đã có ở `/market-phase`.
> **Phụ thuộc:** chỉ cần contract stream (02 §3) đã chốt — làm song song với backend, test bằng endpoint echo giả của bước 2.

---

## 1. Hiện Trạng

| Hạng mục | Trạng thái |
|----------|-----------|
| `apiClient` + refresh-token flow | ✅ — thêm `responseType: 'stream'` (diff ~10 dòng, đã có thiết kế sẵn trong spec cũ §6.1, dùng lại nguyên) |
| Ngôn ngữ thiết kế: `AmbientCard`, `AiCommentBody` (highlight số/%, lede, dropCap), glass card | ✅ tái dùng từ `/market-phase` |
| Guard: `OptionalAuthWrapper requireAuth` + skeleton loading 2 giai đoạn | ✅ pattern market-phase |
| Store pattern (Zustand-like: `useChartStore`...) | ✅ copy pattern |
| `chatClient.ts`, `useChatStore`, page + components | ❌ chưa có |
| Nav item + tên hiển thị | ❓ đề xuất "Finext AI", owner chốt |

## 2. Cấu Trúc

```
finext-nextjs/
├── services/
│   ├── apiClient.ts            # +1 nhánh responseType 'stream' (trả Response thô chưa đọc body)
│   └── chatClient.ts           # MỚI ~70 dòng: streamChat() AsyncGenerator<ChatEvent>
├── hooks/useChatStore.ts       # MỚI
└── app/(main)/assistant/
    ├── page.tsx                # metadata
    ├── PageContent.tsx         # client — guard + layout
    └── components/             # mỗi cái ≤150 dòng theo quy ước
        MessageList · MessageBubble · ToolChip · Composer(+nút dừng)
        ConversationSidebar · AsOfChip · AssistantSkeleton
```

- Route `/assistant`, nav "Finext AI" (❓ owner chốt label). Guard `OptionalAuthWrapper requireAuth` như market-phase.
- **Vì sao stream đi qua `_sendRequest` của `apiClient`:** hưởng nguyên refresh-token flow — 401 throw TRƯỚC khi stream mở → retry với token mới, chưa mất byte nào. Đây là lý do KHÔNG dùng `EventSource` (GET-only, không gửi được Authorization + body) và KHÔNG đi qua Next.js route handler (API key sang container nextjs + vòng qua RBAC FastAPI).

## 3. Parser Stream (thiết kế từ spec cũ — giữ nguyên, đã đúng)

`streamChat(body, signal)` = async generator: đọc `res.body.getReader()`, buffer split `\n\n`, mỗi frame lấy dòng `data: ` → JSON → yield `ChatEvent` (union 6 type khớp contract 02 §3). Comment `: hb` tự rơi qua (không có `data: `).

Vòng đời + phòng thủ:
- `AbortController.abort()` khi user bấm dừng / rời trang → server hủy LLM call (ngừng tốn tiền).
- **Idle watchdog ~45s** không nhận byte nào (kể cả heartbeat) → coi như đứt → abort + báo lỗi (fetch không có timeout mặc định).
- `error` giữa chừng → GIỮ text đã nhả + nút "Thử lại" (retry gửi lại message cuối).

## 4. Store & Hiển Thị Tool Chip (điểm đổi so spec cũ — theo mô hình query)

`useChatStore`: `{conversations, activeId, messages, streaming: {phase: idle|waiting|streaming|tool, partial, toolLabel}, error}` + actions `send/stop/retry/newConversation/loadConversation`.

Tool chip: FE **chỉ render `label` server gửi** trong `tool_start` (server sinh generic — 02 §4.3). FE không có bảng map tool nào → thêm/bớt collection trong DB không đụng FE. Nhiều tool call song song → xếp chồng chip, `tool_end` đổi ✓/✗ + ms. Khi xem lại hội thoại cũ: render chip từ `tool_calls` metadata đã lưu.

## 5. Render Assistant — ✅ ĐÃ CHỐT 2026-07-14: markdown + bảng + widget

> Nguồn sự thật: [spec 2026-07-14](../superpowers/specs/2026-07-14-agent-v1-slice-and-chat-render-design.md) §D4.
> Nguyên tắc: **model tả Ý (JSON spec), FE vẽ HÌNH (component whitelist). Không bao giờ mount HTML do model viết.**

2 tầng render trong `MessageBubble`:

1. **Markdown:** `react-markdown` + `remark-gfm` (dep mới — owner đã duyệt 2026-07-14). Bảng GFM style theo theme.
   Thư viện mặc định KHÔNG render raw HTML → luật cấm-HTML được enforce miễn phí, không cần sanitizer.
2. **Widget:** custom renderer cho code fence lang=`finext-widget`, body là JSON `{v:1, type, ...}`.
   Types v1: `stat_tiles` (≤6 ô) · `bar_list` (≤20 bar ±, dương xanh/âm đỏ) · `grouped_bars` (≤20 nhóm × ≤3 series)
   — cả 3 là MUI/CSS thuần, 0 dep · `line` (≤60 điểm/series) — `apexcharts` sẵn có, dynamic import. `candle` → v1.1.

Luật render: JSON hỏng / `type` lạ / `v`≠1 → fallback code block xám, không crash · vượt cap điểm → cắt + ghi chú ·
màu tăng/giảm + format số VN theo convention app · fence chưa đóng khi đang stream → skeleton "Đang dựng biểu đồ…",
widget chỉ mount khi fence đóng · contract SSE 02 §3 không đổi (widget đi in-band trong `token` text), backend
không biết widget tồn tại — widget spec là hợp đồng **PACK ↔ FE**.

UX chi tiết: optimistic user bubble · auto-scroll pin-to-bottom (ngừng pin khi user cuộn lên) · `AsOfChip` **"Dữ liệu {as_of}"** từ event `meta` (ẩn khi null) + tooltip: *"Trong phiên: giá cập nhật ~2 phút/lần · Phase chốt cuối ngày"* — ⚠ KHÔNG ghi "EOD" (agent_db chạy continuous, ghi EOD là sai độ tươi — audit G1) · disclaimer 1 dòng dưới composer: *"Thông tin tham khảo, không phải khuyến nghị đầu tư. AI có thể nhầm lẫn — kiểm tra số liệu quan trọng."* · skeleton bám cấu trúc, KHÔNG spinner (quy ước page mới từ market-phase).

Bổ sung từ audit hệ thống thực tế (file 09):
- **Consent modal lần đầu** vào page (NĐ 13/2023 — nội dung 3 điểm ở file 09 §2), lưu cờ đã đồng ý; chưa đồng ý thì composer disabled.
- **Empty state**: 3-4 suggested prompt chip sinh từ briefing ngày (file 09 §7) — bấm là gửi.
- **Feedback 👍👎** dưới mỗi bubble assistant; 👎 hiện 4 chip lý do, 1 chạm (file 09 §3). REST `POST /chat/messages/{id}/feedback`.
- **Nút copy** trên bubble assistant.

## 6. Rủi Ro & Xử Lý

| # | Rủi ro | Xử lý |
|---|--------|-------|
| R1 | `react-markdown` re-parse toàn message mỗi token → giật khung khi message dài | Throttle re-render ~100ms + memo các block đã hoàn chỉnh; widget chỉ mount khi fence đóng (skeleton trước đó) — spec 07-14 §D4 |
| R2 | Frame SSE bị cắt giữa multibyte UTF-8 (tiếng Việt!) → ký tự lỗi | `TextDecoder(..., {stream: true})` đã xử lý đúng — nhưng phải có test case chuỗi tiếng Việt cắt giữa byte |
| R3 | User refresh trang giữa stream → mất phần đang nhả | chấp nhận ở v1 (message partial đã lưu server-side, load lại thấy `interrupted` + nút thử lại). Resume stream = phức tạp không đáng |
| R4 | Mobile: bàn phím che composer, viewport nhảy | dùng `100dvh` + scroll container riêng cho MessageList; test sớm trên điện thoại thật vì nhóm NĐT dùng mobile nhiều |
| R5 | Hai tab cùng mở chat | semaphore server chặn stream thứ 2 → FE hiện "Đang có phiên chat khác" thay vì lỗi câm |
| R6 | Model xuất widget sai schema thường xuyên → user thấy nhiều code block xám | đếm tỷ lệ fallback trong store; nếu cao → sửa PACK (thêm ví dụ spec mẫu), không sửa code FE — đúng tinh thần R1 file 02 |

## 7. Điều Kiện Hoàn Thành Bước 4

- [ ] `tsc --noEmit` = 0 lỗi (quy ước: KHÔNG tự chạy `next build`; UI owner tự test).
- [ ] Chat end-to-end với backend echo/fixture: gõ → chip tool → chữ nhả dần → done; bấm dừng giữa chừng giữ text.
- [ ] Render giàu: bảng GFM đúng theme dark/light; 4 widget type render từ fixture message; JSON hỏng → fallback xám; fence chưa đóng → skeleton.
- [ ] Kịch bản lỗi: server trả `error` giữa stream → text giữ + nút thử lại; idle 45s → tự báo đứt.
- [ ] Xem lại hội thoại cũ render đúng (kể cả message `interrupted`).
- [ ] Consent modal chặn đúng lần đầu; feedback 👍👎 ghi vào message; empty state hiện suggested prompts.
- [ ] Mobile pass tay: bàn phím, cuộn, chip không vỡ layout.
