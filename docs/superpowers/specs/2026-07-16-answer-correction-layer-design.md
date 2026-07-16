# Answer Correction Layer (Bậc 2) — Design

> **Trạng thái:** PHA A XONG → quyết định đã CHỐT (xem §5). Sẵn sàng viết plan + code Pha B.
> **Ngày:** 2026-07-16. Nhánh: `feat/chat-fe-v1`.
> **Vì sao:** prompt-only đạt ~95% K-hygiene, KHÔNG 100% — DeepSeek biến thiên, lâu lâu vẫn lọt (câu mở đầu kể tiến trình "Tôi sẽ tra cứu… Đọc `core`…", ký hiệu trong backtick, `VSI`). Sau 2 vòng thêm rule vẫn lai rai → cần **lớp hậu xử lý deterministic** làm rào chắn chắc chắn trước khi trả khách. Owner chốt làm (2026-07-16).
>
> **↓ §5 là phần chốt cuối (đọc trước khi code). §1–4 là thiết kế gốc, giữ để tham chiếu.**

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

---

## 5. CHỐT SAU PHA A (2026-07-16) — thiết kế thi công

**Bằng chứng Pha A:** 17 câu × 2 = 34 run DeepSeek thật, **25/34 (74%) lộ ≥1 lỗi**, 0 lỗi hệ thống. Corpus + phân tích: `scratchpad/hygiene_corpus/_ANALYSIS.md` (+`_catalog.md`, `_raw.jsonl`). Phát hiện cốt lõi: lỗi có **2 nguồn gốc** → **2 đường fix** (KHÔNG gộp 1 regex như §2–3 gợi ý ban đầu). Owner đã duyệt (2026-07-16).

### 5.1 Nhóm A — Câu kể tiến trình (17/34 = 50%, cao nhất) → SỬA Ở LOOP
**Root cause (evidenced):** `loop.py:_drive_turn` emit `token` cho MỌI `TokenEvent`, kể cả text model sinh ra ở **lượt gọi-tool (interim)** — tức "Tôi sẽ tra cứu…" nằm ở lượt interim, "## câu trả lời" ở lượt cuối, hai đoạn bị **stream dính liền** (không xuống dòng). Adapter chỉ phát `DoneEvent` khi `finish_reason=stop` (lượt cuối); lượt interim kết bằng `ToolCallsEvent`, không DoneEvent.

**Fix:** trong `_drive_turn`, **buffer token text theo lượt, KHÔNG emit ngay**:
- Lượt interim (kết bằng `ToolCallsEvent`, không DoneEvent) → **hủy buffer** (không nhả).
- Lượt cuối (`DoneEvent`/stop) → buffer = câu trả lời cuối → **sanitize toàn bộ 1 lần** → nhả.

Deterministic, diệt sạch preamble + narration chồng, **0 rủi ro regex**.

### 5.2 Streaming câu trả lời cuối (chốt: **buffer trọn lượt cuối → sanitize cả câu → nhả theo chunk**)
Vì lượt cuối đã buffer trọn (để phân biệt interim/final), ta **sanitize cả câu 1 lần** (regex thấy đủ ngữ cảnh — tin cậy nhất), rồi **nhả lại theo đoạn nhỏ (~40–48 ký tự, cắt ở khoảng trắng, giữ `\n`)** → giữ hiệu ứng "nhả chữ" nhưng **lọc ở server** (API thô cũng sạch, denylist không lộ FE). Không cần lọc-từng-dòng-incremental (đơn giản + chắc hơn).
- **Đánh đổi (chấp nhận):** chữ bắt đầu hiện sau khi model soạn xong câu cuối (TTFT tăng ~2–6s). Lúc chờ: chip tra cứu (đang chạy) rồi "đang soạn" — UX đã có sẵn.
- FE **không đổi** (vẫn nhận `token` cộng dồn + render markdown).

### 5.3 `sanitize_answer(text) -> text` — bảng rule map (denylist đồng bộ §15 system_prompt)
Áp dụng theo thứ tự, bảo toàn SỐ, an toàn > triệt để:
1. **Token điểm/độ rộng (có nghĩa với khách)** — map §9, cả trần lẫn trong backtick: `w_trend`→"độ rộng xu hướng tuần", `m_trend`→"…tháng", `q_trend`→"…quý", `day_score`→"điểm dòng tiền ngày", `week_score`→"điểm dòng tiền tuần".
2. **`VSI` (10 run — nhiều nhất):** `VSI <op>? <số>` → `<op><số>× TB 5 phiên` (giữ số + toán tử; VD `(VSI 0,92)`→`(0,92× TB 5 phiên)`, `(VSI ≥ 2)`→`(≥2× TB 5 phiên)`); `VSI` trơ còn lại (ô/tiêu đề bảng) → "thanh khoản (×TB5)".
3. **`exposure` (5 run):** → "tỷ lệ nắm giữ" (replace phẳng).
4. **Tên collection/field nội bộ** (`core`,`stock_finstats`,`industry_finstats`,`history_finratios_stock`,`valuation_ratios`,`marketcap`,`period`,`market_snapshot`,`market_recent`,`data_briefing`,`rank_pct`,`technical_zone`…): trong backtick → **xóa cả span**; trơ (hiếm) → xóa token; rồi dọn khoảng trắng/dấu câu thừa.
5. **Backtick còn lại:** nếu nội dung là ticker hoa `[A-Z]{2,5}` hoặc chữ đã map → **gỡ backtick giữ nội dung**; nếu vẫn là snake_case chưa map → xóa span.
6. **Grade zone `(A)/(B)/(C)`** (17 hit, severity thấp — luôn kèm nhãn VN): xóa `(A|B|C)` khi **dính liền sau từ** (regex `(?<=\w)\s*\([ABC]\)`), để lại "mức yếu". KHÔNG đụng grade trần giữa câu (rủi ro false-positive) — để Bậc 1 lo.
7. **Dọn cuối:** gộp khoảng trắng đôi, sửa ` ,`/` .`/`( `/` )`/ngoặc rỗng do bước xóa để lại. KHÔNG đổi số, KHÔNG viết lại câu.
- **GIỮ NGUYÊN:** 4 nhãn pha UPTREND/DOWNTREND/SIDEWAY/TRANSITION, URL hợp lệ, ticker, mọi con số.

### 5.4 Điểm ráp code
- File mới `app/agent/sanitize.py`: `sanitize_answer(text)` + hằng denylist (comment "đồng bộ §15"). Thuần, không I/O, không phụ thuộc gateway/LLM.
- Sửa `app/agent/loop.py`: buffer lượt (hủy interim), lượt cuối `sanitize_answer` rồi nhả chunk. Chỉ đụng `_drive_turn`/chỗ emit — surgical.
- KHÔNG đụng adapter, gateway, schema, FE.

### 5.5 Nghiệm thu
- **Unit test `sanitize_answer`**: mỗi rule ≥1 cặp input-lộ→output-sạch + **negative** (input sạch giữ nguyên; ticker/nhãn pha/URL/số không bị xóa nhầm; ngữ pháp không vỡ). Fixture lấy **đoạn thật từ corpus Pha A**.
- **Loop test** (fake adapter): lượt interim có text+tool_calls → text bị hủy; lượt cuối text+DoneEvent → chỉ nhả text đã sanitize.
- Toàn bộ pytest (đang 211) vẫn PASS.
- Owner test browser: preamble hết, bảng/câu không còn `VSI`/backtick/mã; vẫn thấy chữ nhả dần.
