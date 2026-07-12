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

## 5. Render Text Assistant — Options

| | Option A (khuyến nghị) | Option B (fallback) |
|---|---|---|
| Cách | Tái dùng pattern `AiCommentBody` (regex highlight số/%, pill tên pha, lede) | `react-markdown` |
| Dependency mới | 0 | 1 (owner phải duyệt) |
| Điều kiện | System prompt yêu cầu model trả plain text + bullet đơn giản (đã nằm trong pack luật format) | Khi thấy cần bảng markdown phức tạp thật sự trong câu trả lời |
| Rủi ro riêng | model lỡ trả markdown → hiện ký tự `**` thô — phòng bằng strip nhẹ `**`/`##` trước render | bundle size + phải style lại cho khớp theme |

UX chi tiết: optimistic user bubble · auto-scroll pin-to-bottom (ngừng pin khi user cuộn lên) · `AsOfChip` **"Dữ liệu {as_of}"** từ event `meta` (ẩn khi null) + tooltip: *"Trong phiên: giá cập nhật ~2 phút/lần · Phase chốt cuối ngày"* — ⚠ KHÔNG ghi "EOD" (agent_db chạy continuous, ghi EOD là sai độ tươi — audit G1) · disclaimer 1 dòng dưới composer: *"Thông tin tham khảo, không phải khuyến nghị đầu tư. AI có thể nhầm lẫn — kiểm tra số liệu quan trọng."* · skeleton bám cấu trúc, KHÔNG spinner (quy ước page mới từ market-phase).

Bổ sung từ audit hệ thống thực tế (file 09):
- **Consent modal lần đầu** vào page (NĐ 13/2023 — nội dung 3 điểm ở file 09 §2), lưu cờ đã đồng ý; chưa đồng ý thì composer disabled.
- **Empty state**: 3-4 suggested prompt chip sinh từ briefing ngày (file 09 §7) — bấm là gửi.
- **Feedback 👍👎** dưới mỗi bubble assistant; 👎 hiện 4 chip lý do, 1 chạm (file 09 §3). REST `POST /chat/messages/{id}/feedback`.
- **Nút copy** trên bubble assistant.

## 6. Rủi Ro & Xử Lý

| # | Rủi ro | Xử lý |
|---|--------|-------|
| R1 | Text streaming + regex highlight của `AiCommentBody` chạy lại mỗi token → giật khung khi message dài | Trong lúc streaming render text THÔ (chỉ append); áp `AiCommentBody` MỘT LẦN khi `done`. Nếu vẫn muốn highlight live → memo theo đoạn đã hoàn chỉnh (câu kết thúc bằng `.`) |
| R2 | Frame SSE bị cắt giữa multibyte UTF-8 (tiếng Việt!) → ký tự lỗi | `TextDecoder(..., {stream: true})` đã xử lý đúng — nhưng phải có test case chuỗi tiếng Việt cắt giữa byte |
| R3 | User refresh trang giữa stream → mất phần đang nhả | chấp nhận ở v1 (message partial đã lưu server-side, load lại thấy `interrupted` + nút thử lại). Resume stream = phức tạp không đáng |
| R4 | Mobile: bàn phím che composer, viewport nhảy | dùng `100dvh` + scroll container riêng cho MessageList; test sớm trên điện thoại thật vì nhóm NĐT dùng mobile nhiều |
| R5 | Hai tab cùng mở chat | semaphore server chặn stream thứ 2 → FE hiện "Đang có phiên chat khác" thay vì lỗi câm |

## 7. Điều Kiện Hoàn Thành Bước 4

- [ ] `tsc --noEmit` = 0 lỗi (quy ước: KHÔNG tự chạy `next build`; UI owner tự test).
- [ ] Chat end-to-end với backend echo/fixture: gõ → chip tool → chữ nhả dần → done; bấm dừng giữa chừng giữ text.
- [ ] Kịch bản lỗi: server trả `error` giữa stream → text giữ + nút thử lại; idle 45s → tự báo đứt.
- [ ] Xem lại hội thoại cũ render đúng (kể cả message `interrupted`).
- [ ] Consent modal chặn đúng lần đầu; feedback 👍👎 ghi vào message; empty state hiện suggested prompts.
- [ ] Mobile pass tay: bàn phím, cuộn, chip không vỡ layout.
