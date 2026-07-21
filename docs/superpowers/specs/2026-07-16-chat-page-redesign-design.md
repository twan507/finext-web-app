# Chat Page Redesign — Design (`/chat` ring layout + UI/UX polish)

> **HISTORICAL — IMPLEMENTED VÀ MỞ RỘNG:** Redesign đã triển khai; lịch sử hội thoại hiện được persist server-side, không còn chỉ ở mức phiên như phạm vi gốc.

> **Trạng thái:** hướng thiết kế đã chốt qua mockup (owner duyệt 2026-07-16 — "bảng + biểu đồ đạt yêu cầu"). Chờ review spec trước khi lên plan.
> **Ngày:** 2026-07-16.
> **Đây là gì:** redesign trang `/chat` (đã chạy được — xem [`2026-07-15-chat-fe-v1-slice-design.md`](2026-07-15-chat-fe-v1-slice-design.md)) thành khung "ring" kiểu ChatGPT/Claude bên trong appbar+sidebar Finext, + tối ưu UI/UX (trọng tâm: render bảng markdown).
> **Nền tảng nghiên cứu:** cột tin nhắn ~720–768px (Claude/ChatGPT), bảng tài chính số canh phải + tabular-nums + viền hàng nhẹ, layout 2 cột (history + chat) — tham khảo assistant-ui/LibreChat/open-webui (pattern, không bê code).
> **FE-only, KHÔNG persistence** (Bước 3): lịch sử ở mức PHIÊN (owner chốt Option 1).

---

## 1. Phạm vi

| ✅ IN | ⏸ OUT (giữ cho Bước 3 / sau) |
|---|---|
| Layout ring: thoát 1400px, full-height, panel lịch sử + khu chat, trong appbar+rail Finext | Persistence hội thoại vào DB (reload vẫn mất) |
| Panel lịch sử **mức phiên**: nhiều hội thoại/1 lần mở, chuyển qua lại, "Cuộc trò chuyện mới", gom theo thời gian | Lịch sử còn sau reload / nạp từ DB |
| Store refactor: 1 hội thoại → **map nhiều hội thoại + activeId** | Feedback 👍👎 ghi DB (giữ nút copy + tạo lại) |
| Cột tin nhắn kẹp ~760px giữa | Quota/429 |
| **Bảng làm lại**: số canh phải + tabular-nums, viền hàng nhẹ, header mờ, bo góc + đổ bóng, ±xanh/đỏ, pill trạng thái | Suggested prompt từ briefing (giữ 4 prompt tĩnh) |
| Typography/spacing tin nhắn, tool line (chấm+chữ inline theo thời gian — đã có), widget gọn lại | |
| Composer dính đáy khu chat; panel lịch sử cuộn riêng | |
| Cả dark/light theo theme Finext | |

**Nguyên tắc:** KHÔNG dep mới (react-markdown/remark-gfm/apexcharts đã có; tabular-nums là CSS). Diff chung tối thiểu (LayoutContent chỉ thêm 1 nhánh mode). Verify = `tsc --noEmit`, owner tự test browser.

---

## 2. Kiến trúc layout

Cấu trúc lồng nhau (ngoài → trong):
```
AppBar Finext (giữ nguyên, top)
└─ Body (flex)
   ├─ Icon rail Finext (giữ nguyên, ~60px)
   └─ Chat ring  ← MỚI, full-width (thoát maxWidth 1400)
      ├─ Panel lịch sử  (~272px, cuộn RIÊNG, thu gọn được)
      └─ Khu chat (flex)
         ├─ Stream (vùng cuộn của khu chat; cột tin nhắn max 760px, căn giữa)
         └─ Composer (dính đáy khu chat)
```

**LayoutContent.tsx** ([hiện có nhánh fullscreen cho `/charts`](../../../finext-nextjs/app/(main)/LayoutContent.tsx#L1019)): thêm nhánh cho `/chat`:
- Điều kiện: `currentPathname.startsWith('/chat')` → dùng container **full-width, no footer, no maxWidth 1400, no padding ngang**, `height: calc(100dvh - appBarHeight)`, `overflow: hidden` (khu chat tự quản scroll bên trong — giống charts nhưng nội dung khác).
- KHÔNG dùng maxWidth 1400 wrapper + footer (nhánh normal).

**Scroll model** (owner xác nhận kiểu ChatGPT, không phải window-scroll):
- Khu chat = container `overflow: hidden` cao đúng viewport-appbar; bên trong: `Stream` (`flex:1; overflow-y:auto`) + `Composer` (đứng yên đáy). Composer KHÔNG đè nội dung (nằm ngoài vùng cuộn).
- Panel lịch sử: `overflow-y:auto` riêng, độc lập với Stream.
- `100dvh` cho mobile (bàn phím). Mobile (<900px): panel lịch sử ẩn (mở bằng nút/overlay — v1 để nút toggle đơn giản).

---

## 3. Panel lịch sử (mức phiên)

- **Nút "Cuộc trò chuyện mới"** trên cùng → tạo hội thoại rỗng, active.
- **Danh sách** gom theo mốc: "Hôm nay / Hôm qua / 7 ngày trước" (dựa `createdAt` trong phiên; tất cả sẽ là "Hôm nay" ở phiên hiện tại — grouping vẫn dựng sẵn cho khi có persistence). Mỗi item: **title** (tự sinh từ prompt đầu, cắt ~40 ký tự) + click để chuyển.
- **Active** highlight nền accent-soft.
- **Thu gọn**: nút collapse (desktop) ẩn panel còn icon rail; mobile ẩn mặc định.
- Cuộn riêng (không ảnh hưởng khu chat).

**Store refactor** (`useChatStore`): hiện giữ 1 hội thoại. Đổi thành:
- `conversations: Conversation[]` với `Conversation = { id, title, createdAt, messages: ChatMessage[] }`.
- `activeId: string`.
- Actions: `send/stop/retry` (áp lên hội thoại active) · `newConversation()` · `selectConversation(id)` · giữ `newChat` = alias `newConversation`.
- Streaming state (phase/asOf/error) gắn theo hội thoại active.
- `messages`, `parts` model (text↔tool) giữ nguyên như hiện tại.
- History gửi backend vẫn từ `messages` của hội thoại active (cap 20/8000 như cũ).

---

## 4. Render tin nhắn — trọng tâm UI/UX

**Cột nội dung** `max-width: 760px`, căn giữa, padding thoáng (~24–28px).

**Bảng (làm lại — phần owner chê nhất):**
- Số **canh phải** + `font-variant-numeric: tabular-nums` (cột số thẳng hàng, dễ quét).
- Auto nhận cột số: cột mà đa số ô khớp regex số (có thể kèm `+ − % , .`) → canh phải + tabular; cột chữ → canh trái.
- **Viền hàng mảnh** (`border-top: 1px divider`), KHÔNG lưới đầy; header nền mờ (`--thead`), chữ hoa nhỏ letter-spacing, màu text-2.
- Container bo góc 12px + `overflow-x:auto` (bảng rộng cuộn ngang trong khung, không tràn) + đổ bóng nhẹ.
- Ô padding `11px 16px`. Hover hàng đổi nền nhẹ.
- Số dương xanh (`--up`) / âm đỏ (`--down`) khi ngữ cảnh là biến động (heuristic: ô có dấu `+`/`−`).
- Nhãn trạng thái ("Mạnh/Yếu/Trung tính"...) → **pill** bo tròn có màu ngữ nghĩa.

**Typography chung:** body ~15.5px, line-height 1.7; `h3` 16px đậm cho tiêu đề mục; list padding gọn; `strong` 650; link accent gạch chân; inline code nền mờ.

**Tool line:** chấm trạng thái + chữ, inline theo thời gian, ẩn khi xong (đã làm — giữ nguyên).

**Widget:** cùng ngôn ngữ bảng — thanh bo tròn, số tabular canh phải, tiêu đề nhỏ. line=apexcharts (đã có).

**User message:** bong bóng nền accent-soft, bo góc `16px 16px 4px 16px`, canh phải, max 80%.

**Hàng action** dưới bubble assistant: Sao chép · Tạo lại (retry). (👍👎 → Bước 3.)

---

## 5. Màu / theme (bám Finext)

Token theo `MuiProvider` + `colorHelpers` thật. Dark (mặc định) & light đều chăm. Accent tím Finext; `--up` `#22c55e`/`#34d399`, `--down` `#ef4444`/`#f87171` (đúng colorHelpers). Neutral lệch nhẹ về tím, không xám thuần. Semantic (up/down) tách khỏi accent.

---

## 6. Rủi ro & xử lý

| # | Rủi ro | Xử lý |
|---|--------|-------|
| R1 | Auto-detect cột số sai (cột mã CK chứa số) | Heuristic theo TỶ LỆ ô số trong cột + loại cột đầu (thường là nhãn); sai thì canh trái vẫn đọc được, không vỡ |
| R2 | `overflow:hidden` khu chat cắt dropdown/tooltip | Đã kiểm: nội dung chat không có overlay tràn; widget/table tự cuộn trong khung |
| R3 | Store refactor (multi-conversation) phá send/retry/stop hiện đang chạy | Giữ nguyên logic parts + streaming, chỉ bọc thêm lớp active conversation; test kỹ tsc + owner test |
| R4 | Mobile: panel lịch sử + rail chiếm chỗ | <900px ẩn cả hai; chat full width; nút mở lịch sử |

## 7. Điều kiện hoàn thành
- [ ] `/chat` full-width, thoát 1400px, full-height; appbar+rail Finext còn nguyên; không footer.
- [ ] Panel lịch sử: tạo mới / chuyển / gom thời gian; cuộn riêng; thu gọn được.
- [ ] Nhiều hội thoại trong phiên hoạt động (chuyển qua lại giữ nguyên nội dung).
- [ ] Bảng render đúng mockup: số canh phải tabular, viền nhẹ, header mờ, ±màu, pill; bảng rộng cuộn ngang trong khung.
- [ ] Cột tin nhắn ~760px; composer dính đáy; stream cuộn riêng.
- [ ] Dark/light đều đẹp. `tsc --noEmit` = 0.
- [ ] Owner test browser: layout, scroll, bảng, đổi hội thoại, mobile.

## 8. Ngoài scope (nhắc)
Persistence DB · lịch sử sau reload · feedback-DB · quota · suggested prompt từ briefing · resumable stream. (Bước 3 — [`03`](../../finext_agent/03-persistence-quota-cost.md)/[`08`](../../finext_agent/08-database-design-memory.md).)
