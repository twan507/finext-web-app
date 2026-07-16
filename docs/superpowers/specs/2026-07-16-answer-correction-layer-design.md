# Answer Correction Layer (Bậc 2) — Design

> **Trạng thái:** PLANNED (chưa bắt đầu) — chốt cách tiếp cận, chờ khảo sát lỗi rồi mới code.
> **Ngày:** 2026-07-16. Nhánh: `feat/chat-fe-v1`.
> **Vì sao:** prompt-only đạt ~95% K-hygiene, KHÔNG 100% — DeepSeek biến thiên, lâu lâu vẫn lọt (câu mở đầu kể tiến trình "Tôi sẽ tra cứu… Đọc `core`…", ký hiệu trong backtick, `VSI`). Sau 2 vòng thêm rule vẫn lai rai → cần **lớp hậu xử lý deterministic** làm rào chắn chắc chắn trước khi trả khách. Owner chốt làm (2026-07-16).

## 1. Nguyên tắc
- **Bậc 1 (prompt) giữ nguyên** — vẫn là tuyến đầu; Bậc 2 chỉ dọn **residual**, không thay nội dung/phân tích.
- **CHỈ dọn bề mặt** (ký hiệu lộ, câu kể tiến trình). KHÔNG sửa số, KHÔNG viết lại câu, KHÔNG đổi ý.
- **An toàn > triệt để**: thà bỏ sót 1 leak hiếm còn hơn làm hỏng ngữ pháp/xoá nhầm nội dung thật.

## 2. Hai pha

### Pha A — Khảo sát lỗi (evidence trước, đừng đoán rule)
Chạy ~15–20 request đại diện, phủ các loại: tổng quan thị trường · 1 mã (giá/định giá) · so sánh 2 mã · xếp hạng ngành · định giá lịch sử (history_finratios) · pha thị trường/danh mục · tin tức · watchlist · multi-turn (hỏi tiếp "nó/mã đó"). Mỗi loại chạy 2–3 lần (bắt biến thiên).
Ghi lại **catalog lỗi**: pattern lộ/sai · tần suất · rule sửa đề xuất. Loại lỗi cần soi:
- Ký hiệu DB trong `()`/backtick/`tên = số` (w_trend, breadth_slow, VSI, corr60…).
- Câu mở đầu kể tiến trình / tên collection (`core`, `market_snapshot`).
- Đơn vị sai (nhân 100 nhầm các `*_pct`), thời gian ("đóng cửa" khi trong phiên — đã có block THỜI GIAN nhưng kiểm lại).
- Thuật ngữ Anh chưa dịch, taxonomy nội bộ (Kịch bản A–G…).
Lưu corpus (câu hỏi + output thô) vào scratchpad/`hygiene_corpus/` để làm bộ test before/after cho Pha B.

### Pha B — Hàm hiệu chỉnh `sanitize_answer(text) -> text`
Deterministic, từ catalog Pha A. Rule ứng viên (chốt theo dữ liệu Pha A):
1. **Xoá câu mở đầu kể tiến trình**: nếu đoạn đầu match "^(Tôi sẽ|Mình sẽ|Để .*, tôi|Đọc `?core`?|Trước tiên .*tra cứu).*" và nằm TRƯỚC block nội dung đầu tiên → cắt.
2. **Gỡ mã trong backtick**: `` `token` `` với token là MÃ NỘI BỘ (regex: có `_`, hoặc ∈ {VSI,VAL,VAH,POC,core,…}) → bỏ backtick + xoá token (hoặc map sang ngôn ngữ tự nhiên nếu có trong bảng dịch mục 9). GIỮ backtick cho ticker hợp lệ (VD `FPT`) nếu cần.
3. **Xoá chú thích `(ký_hiệu …)`** / `(VSI = 0,93)` — ngoặc chỉ chứa mã nội bộ + số → xoá cả cụm ngoặc.
4. Danh sách token nội bộ = tái dùng denylist §15 system_prompt (đồng bộ 1 nguồn).

### ⚠ Quyết định mở (chốt ở Pha B): STREAMING
Câu trả lời **stream token-by-token** ra FE. Hàm sửa full-text cần một trong:
- **(a) Buffer server rồi stream bản đã sạch** — gom hết answer ở loop/router, `sanitize_answer`, rồi mới nhả (mất "chữ chạy dần"; nhưng đơn giản, chắc chắn). *Khuyến nghị thử trước.*
- **(b) Sanitizer streaming incremental** — lọc trên buffer cộng dồn, chỉ nhả phần đã "an toàn" (khó vì regex cắt qua ranh giới token).
- **(c) Lọc ở FE** (client, trên text cộng dồn trước khi render) — giữ stream, nhưng logic tản ra client + không bảo vệ được API thô.
Hook đề xuất: **server-side, ở `loop.py`/`routers/chat.py`** (điểm assemble answer) — bảo vệ tại nguồn.

## 3. Nghiệm thu
- Trên corpus Pha A: **0 leak mã nội bộ + 0 câu kể tiến trình**, và **before/after KHÔNG hỏng ngữ pháp/mất số** (so tay từng cặp).
- Có test tự động: `sanitize_answer` trên bộ fixture (input có leak → output sạch; input sạch → giữ nguyên; ticker/parenthetical hợp lệ → không bị xoá nhầm).

## 4. Ngoài scope
Không viết lại nội dung, không đổi phân tích, không sửa số. Không đụng FE render (trừ khi chọn phương án (c)).
