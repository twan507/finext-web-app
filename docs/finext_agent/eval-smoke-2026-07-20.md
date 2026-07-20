# Eval smoke + đo token thật — 2026-07-20

> **Mục đích:** bộ 14 câu chuẩn để xác nhận agent trả lời đúng trước khi mở cho khách, và số đo token THẬT thay cho ước lượng ~20.000 token/lượt đang dùng để đặt hạn mức.
> **Cách chạy:** script probe (scratchpad, không thuộc repo) đi đúng đường của endpoint `/chat/stream`: `connect_to_mongo()` → `build_gateway()` → `build_system_blocks()` → nối khối ngữ cảnh trang → `run_agent(...)`, thinking = `disabled`.
> **Dữ liệu:** `agent_db` production, `as_of = 2026-07-20`, chạy trong phiên (khoảng 10:56–11:05).
> **Số lượt đã chạy:** 14/14 (trần cứng 15, không phải chạy lại lượt nào).

---

## 1. Bộ 14 câu eval

Ngữ cảnh trang lấy đúng chuỗi `buildPageContext()` sinh ra (`finext-nextjs/services/chatPageContext.ts`): nhãn ngữ cảnh + dòng `Trang: … · Đang xem: … · Tab: …` + mô tả trang + dòng chỉ dẫn trả lời ngắn. Chạy lại chỉ cần dựng đúng route dưới đây.

| # | Route | Câu hỏi | Vì sao chọn |
|---|---|---|---|
| 1 | `/phase?tab=conservative` | Rổ này đang nắm giữ những mã nào? | tab rổ danh mục — chưa từng kiểm chứng |
| 2 | `/phase?tab=aggressive` | Rổ này rủi ro tới đâu? | tab rổ — câu định tính, dễ bịa |
| 3 | `/phase?tab=core` | Rổ này đang bám theo ngành nào? | tab rổ — nối rổ ↔ ngành |
| 4 | `/commodities?tab=metals` | Giá thép và kim loại đang thế nào? | trang hàng hoá — chưa từng kiểm chứng |
| 5 | `/international?tab=global_index` | Chứng khoán Mỹ và châu Á đang tăng hay giảm? | trang quốc tế — chưa từng kiểm chứng |
| 6 | `/stocks/HPG?tab=financials` | Lợi nhuận HPG tăng hay giảm so với cùng kỳ? | tab tài chính — chưa từng kiểm chứng |
| 7 | `/stocks/FPT?tab=news` | Có tin gì mới về FPT không? | tab tin tức — chưa từng kiểm chứng |
| 8 | `/` | Hôm nay thị trường thế nào? | trang chủ, câu hỏi phổ biến nhất |
| 9 | `/stocks` | Cổ phiếu nào đang có dòng tiền vào mạnh? | bộ lọc — agent phải tự truy vấn |
| 10 | `/sectors` | Ngành nào đang mạnh nhất lúc này? | danh sách ngành |
| 11 | `/groups/largecap` | Nhóm này gồm những cổ phiếu nào? | chi tiết nhóm |
| 12 | `/watchlist` | Chỉ số ngành nào đang tăng tốt nhất? | trang theo dõi |
| 13 | `/macro?tab=monetary` | Lãi suất gửi tiết kiệm đang ra sao? | vĩ mô |
| 14 | `/sectors/kimloai?tab=stocks` | Cổ phiếu nào mạnh nhất trong ngành này? | chi tiết ngành + slug khó (`kimloai` → "Kim loại công nghiệp") |

**Lưu ý về slug ngành/nhóm.** Slug thật của app là **chữ thường, KHÔNG gạch dưới**: `/sectors/nganhang`, `/sectors/chungkhoan`, `/sectors/kimloai`, `/groups/largecap` (xem `SECTOR_LIST` trong `app/(main)/sectors/[sectorId]/page.tsx` và các link `item.ticker.toLowerCase()`). Dạng `ngan_hang` / `chung_khoan` chỉ xuất hiện trong `chatPageContext.test.ts` và **không phải route thật** — vào `/sectors/ngan_hang` sẽ `notFound()`. Không có slug `thep`; thép nằm trong `kimloai` ("Kim loại công nghiệp").

---

## 2. Kết quả từng câu

Token "quota" = con số hệ thống đang tính vào hạn mức; token "thật" = tổng mọi vòng gọi LLM (xem §3.1 — hai con số này lệch nhau vì lỗi đếm).

| # | Route | Quota in/out | Thật in/out | Tool | Vòng | Giây | Ký tự | Kết quả |
|---|---|---|---|---|---|---|---|---|
| 1 | `/phase?tab=conservative` | 67.621 / 343 | 131.085 / 409 | 1 | 2 | 20,6 | 616 | ĐẠT (có ghi chú) |
| 2 | `/phase?tab=aggressive` | 53.268 / 250 | 101.182 / 363 | 2 | 2 | 28,6 | 808 | ĐẠT (có ghi chú) |
| 3 | `/phase?tab=core` | 69.522 / 251 | 132.983 / 372 | 1 | 2 | 17,3 | 424 | ĐẠT |
| 4 | `/commodities?tab=metals` | 64.645 / 557 | 191.848 / 857 | 2 | 3 | 39,0 | 973 | ĐẠT (có ghi chú) |
| 5 | `/international?tab=global_index` | 63.317 / 100 | 63.317 / 100 | 0 | 1 | 9,0 | 205 | **KHÔNG ĐẠT** |
| 6 | `/stocks/HPG?tab=financials` | 68.416 / 324 | 131.880 / 423 | 1 | 2 | 15,7 | 543 | **KHÔNG ĐẠT — bịa số** |
| 7 | `/stocks/FPT?tab=news` | 64.323 / 306 | 643.202 / 1.681 | 10 | 10 | 47,2 | 578 | **KHÔNG ĐẠT — lỗi kỹ thuật** |
| 8 | `/` | 268.002 / 3.527 | 528.084 / 4.128 | 5 | 8 | 77,5 | 2.274 | ĐẠT (có ghi chú) |
| 9 | `/stocks` | 63.439 / 292 | 63.439 / 292 | 0 | 1 | 7,9 | 76 | **KHÔNG ĐẠT — câu cụt** |
| 10 | `/sectors` | 113.109 / 819 | 161.073 / 925 | 1 | 3 | 34,1 | 318 | ĐẠT |
| 11 | `/groups/largecap` | 64.546 / 391 | 128.023 / 551 | 2 | 2 | 25,6 | 719 | ĐẠT (có ghi chú) |
| 12 | `/watchlist` | 49.281 / 141 | 97.244 / 221 | 1 | 2 | 20,8 | 369 | ĐẠT |
| 13 | `/macro?tab=monetary` | 65.052 / 621 | 128.486 / 817 | 2 | 2 | 31,2 | 1.088 | ĐẠT (có ghi chú) |
| 14 | `/sectors/kimloai?tab=stocks` | 65.739 / 557 | 321.488 / 1.593 | 4 | 5 | 41,9 | 1.084 | ĐẠT (có ghi chú) |

**Tỷ lệ đạt: 10/14 (71%).**

### Nhận xét từng câu

- **1 — ĐẠT.** Liệt kê đúng 6 mã rổ Phòng Thủ, tỷ trọng khớp dữ liệu. *Ghi chú:* lộ `TRANSITION` (tiếng Anh) và "chỉ số phơi nhiễm 0.7" — khách phổ thông không hiểu; dùng bảng 6 dòng dù ngữ cảnh yêu cầu trả lời ngắn.
- **2 — ĐẠT.** Đánh giá rủi ro có căn cứ, nêu rõ số là backtest chứ không phải lợi nhuận kỳ vọng — đúng tinh thần thận trọng. *Ghi chú:* lộ `TRANSITION`, dùng từ "backtest".
- **3 — ĐẠT.** Ngắn, đúng, nêu được cả ngành sắp vào/ra. Câu tốt nhất bộ.
- **4 — ĐẠT.** Mọi số khớp `other_data`; nối đúng giá quặng sắt/thép HRC sang cổ phiếu thép. *Ghi chú:* bảng 6 dòng × 5 cột, dài so với chỉ dẫn trả lời ngắn.
- **5 — KHÔNG ĐẠT.** Hỏi chứng khoán Mỹ và châu Á, agent trả lời về VNINDEX (lạc đề), **không gọi tool nào** dù `other_data` có sẵn S&P 500, Nasdaq, Nikkei 225, Shanghai Composite; rồi hỏi ngược user "muốn tôi kéo … không?" thay vì tự lấy. Hiểu sai trang đang xem.
- **6 — KHÔNG ĐẠT (nặng nhất).** Xem §4.1.
- **7 — KHÔNG ĐẠT.** Xem §4.2. Câu trả lời vô dụng ("Tiêu đề: (chưa có chi tiết)"), lộ từ nội bộ "v1".
- **8 — ĐẠT.** Nội dung phong phú, kết luận hợp lý. *Ghi chú:* dài 2.274 ký tự với 2 bảng — vi phạm rõ chỉ dẫn trả lời ngắn của bubble; lộ `TRANSITION`, "trend line", "capitulation", "TB5". Các số top tăng/giảm lấy từ khối briefing trong system prompt chứ không từ tool; briefing được làm mới trong phiên nên **không kết luận được** có lệch hay không (xem §5 — hạn chế phương pháp).
- **9 — KHÔNG ĐẠT.** Trả về đúng một dòng tiêu đề cụt: *"Top cổ phiếu có điểm dòng tiền ngày cao nhất (đã lọc thanh khoản tối thiểu):"* rồi hết — không có danh sách, không gọi tool nào. Khách nhận được câu trả lời rỗng.
- **10 — ĐẠT.** Ngắn gọn, có sắc thái tốt (dẫn đầu theo tuần nhưng động lượng phiên đang yếu, "chưa phải tín hiệu mua đuổi").
- **11 — ĐẠT.** Đủ 20 mã, đúng hết, kể cả mã lạ (VPX = CK VPBank, TCX = CK Kỹ thương). *Ghi chú:* tự bịa thêm một dòng thứ 21 "Hàng không (gộp Du lịch Giải trí): HVN" — HVN đã có ở dòng trên, ngành "Hàng không" không tồn tại trong dữ liệu.
- **12 — ĐẠT.** Trung thực khi không ngành nào tăng, không tô hồng. Ngắn gọn đúng yêu cầu.
- **13 — ĐẠT.** Quy đổi đơn vị đúng (`value 0.045` + `unit "%"` → 4,5%), nối được sang tác động thị trường. *Ghi chú:* hơi dài (1.088 ký tự).
- **14 — ĐẠT.** Giải đúng slug `kimloai` → "Kim loại công nghiệp", nhận diện đúng HPG/HSG/NKG đang yếu. *Ghi chú:* tốn 4 tool / 5 vòng / 321k token cho một câu — kém hiệu quả; lộ "phân vị xếp hạng trong ngành 85.71", "vùng KT", "TB5"; giá hiển thị dạng nghìn đồng (KVC 1.10) dễ gây hiểu nhầm.

---

## 3. Đo token

### 3.1 Phát hiện chặn đường: hạn mức đang đếm THIẾU 2,47 lần

`ToolCallsEvent` (`app/agent/events.py`) **không có field `usage`**. Trong `app/agent/adapters/openai_compat.py`, khi `finish_reason == "tool_calls"` adapter `yield ToolCallsEvent(...)` rồi `return` — `state.usage` của vòng đó bị vứt. `_merge_usage` trong `loop.py` chỉ cộng được usage của `DoneEvent`, tức **chỉ vòng LLM cuối cùng**. Comment ở `loop.py:317-319` đã ghi nhận đây là known-gap v1.

Hệ quả: mỗi vòng gọi tool là một lượt gửi lại TOÀN BỘ system prompt (~63.000 token) mà **không được tính vào hạn mức**.

| | Trung bình | Trung vị | Thấp nhất | Cao nhất |
|---|---|---|---|---|
| Token hệ thống đang đếm (quota) | 82.054 | 65.438 | 49.422 | 271.529 |
| Token THẬT (mọi vòng) | **202.576** | 131.898 | 63.417 | **644.883** |

**Tỷ lệ thật / đếm = 2,47×.** Cực đoan nhất là lượt 7: hệ thống ghi 64.629 token, thực tế tiêu **644.883** token — lệch gần 10 lần, và riêng lượt đó đã vượt trần 500.000/5h.

Ước lượng cũ ~20.000 token/lượt **thấp hơn thực tế khoảng 10 lần**.

### 3.2 Vì sao mỗi lượt đắt: system prompt 63.000 token, gửi lại mỗi vòng

`build_system_blocks()` trả 3 khối, tổng **139.409 ký tự**:

| Khối | Ký tự | `cache_hint` | Nội dung |
|---|---|---|---|
| 1 | 137.582 | `True` | System prompt + KB pack (98,7% khối lượng) |
| 2 | 1.453 | `True` | Briefing thị trường (`data_briefing` core) |
| 3 | 374 | `False` | Ghi chú thời gian/phiên |

Đo thật ở vòng 1 mỗi lượt: **~63.400 token input**. **Input chiếm 99,6% tổng token** (out trung bình chỉ 909 token/lượt).

`SystemBlock.cache_hint` **hiện không được dùng**: `OpenAICompatAdapter._payload()` chỉ map `[{"role": "system", "content": block.text} for block in system]` và bỏ qua hoàn toàn `cache_hint`. Tức chưa có cache prompt nào đang hoạt động trên đường OpenAI-compat.

### 3.3 Số lượt mỗi user dùng được

| Cách đếm | 500.000 token / 5h | 5.000.000 token / tuần |
|---|---|---|
| Theo con số hệ thống đang đếm (thực tế hôm nay) | **~6,1 lượt** | **~61 lượt** |
| Theo token thật (nếu sửa lỗi đếm mà giữ nguyên trần) | **~2,5 lượt** | **~25 lượt** |

Thêm: mỗi hội thoại MỚI tốn một lệnh đặt tiêu đề, đo được **374 in / 13 out** — không đáng kể (~0,0001 USD).

### 3.4 Chi phí

Giá MiniMax M3: **0,30 USD / 1 triệu token vào · 1,20 USD / 1 triệu token ra**.

- Trung bình một lượt: 201.667 in + 909 out → **0,0616 USD/lượt (~1.600 VND)**
  - trong đó input chiếm 98,2% chi phí
- Bỏ lượt 7 (lỗi retry storm): 0,0513 USD/lượt

**Ước tính tháng cho 10 user dùng thường xuyên** (giả định nêu rõ):

| Giả định | Số lượt/tháng | Chi phí |
|---|---|---|
| 10 user × 8 lượt/ngày × 30 ngày | 2.400 | **~148 USD/tháng** (~3,8 triệu VND) |
| 10 user × 15 lượt/ngày × 22 ngày làm việc | 3.300 | **~203 USD/tháng** (~5,3 triệu VND) |
| 10 user kích trần tuần hiện tại (61 lượt/tuần) | 2.614 | **~161 USD/tháng** (~4,2 triệu VND) |

Quy đổi 26.000 VND/USD. Chưa tính chi phí khi lỗi retry storm (§4.2) tái diễn — mỗi lần như vậy tốn gấp ~3 lần một lượt bình thường.

### 3.5 Kết luận về hạn mức

**Trần hiện tại đang quá RỘNG so với ý định, nhưng vì lý do sai — nó rộng do đếm thiếu, không do đặt số cao.**

- Đúng như thiết kế mong muốn (500.000 token = một "phiên dùng thoải mái"), con số này chỉ đủ **2,5 lượt thật**. Nếu sửa lỗi đếm mà giữ nguyên trần, sản phẩm **không dùng được** — user hỏi 3 câu là hết hạn mức.
- Thực tế đang chạy, user được ~6 lượt/5h và ~61 lượt/tuần, nhưng hệ thống trả tiền cho gấp 2,47 lần lượng token nó tưởng. **Kill-switch ngân sách toàn hệ thống (`AGENT_DAILY_TOKEN_BUDGET`) cũng đếm thiếu 2,47 lần** — cầu dao này sẽ không nhảy khi đáng lẽ phải nhảy. Đây là rủi ro tiền bạc thật.

**Đề xuất theo thứ tự:**

1. **Sửa lỗi đếm trước** (thêm `usage` vào `ToolCallsEvent`). Đây là điều kiện cần — mọi con số trần đặt trên nền đếm sai đều vô nghĩa.
2. **Bật cache prompt rồi ĐO LẠI trước khi chốt trần.** 99,6% token là input và gần như toàn bộ là system prompt lặp lại. Đây là đòn bẩy lớn nhất, có thể giảm 70-90% chi phí. Chốt trần trước khi làm việc này là chốt trên nền sai.
3. **Trần tạm nếu phải go-live ngay** (sau khi sửa đếm, trước khi có cache) — nhắm ~10 lượt/5h và ~60 lượt/tuần:
   - `AGENT_TOKENS_5H` = **2.000.000**
   - `AGENT_TOKENS_WEEK` = **12.000.000**
   - Chi phí trần: một user kích hết tuần ≈ 3,7 USD/tuần ≈ 16 USD/tháng; 10 user ≈ 160 USD/tháng.
   - Nếu con số này quá đắt so với khẩu vị của owner thì hạ số lượt mong muốn xuống, đừng hạ trần token — hạ trần token dưới ~200.000/lượt sẽ cắt ngang câu trả lời chứ không tiết kiệm được gì.

---

## 4. Vấn đề phát hiện, xếp theo mức nghiêm trọng

> Theo yêu cầu, **không sửa gì** — chỉ báo cáo để owner quyết.

### 4.1 NGHIÊM TRỌNG — Bịa số tài chính và chọn sai kỳ báo cáo (lượt 6)

Hỏi "Lợi nhuận HPG tăng hay giảm so với cùng kỳ?", agent trả lời dựa trên **Q1/2025** và khẳng định đó là "kỳ BCTC mới nhất có trong hệ thống", trong khi DB có tới **Q1/2026**. Tool đã trả về đủ **cả 9 kỳ** (2024_1 → 2026_1, 28.026 ký tự, `truncated: False`) — dữ liệu có sẵn, model tự chọn sai.

| Agent nói | Thực tế trong DB (2025_1) | |
|---|---|---|
| Lợi nhuận sau thuế tăng **11,5%** | `Tăng trưởng LNST YoY = 0.165` → **16,5%** | SAI |
| Doanh thu thuần **34.643 tỷ** | **37.951 tỷ** (không kỳ nào là 34.643 tỷ) | **BỊA** |
| Biên lợi nhuận ròng **9,2%** | `0.089` → **8,9%** | SAI |
| ROE **11,05%** | `0.1105` → 11,05% | đúng |
| Q1/2024: ROE 9,17%, biên 9,3% | khớp | đúng |
| Q4/2024 giảm **5,5%** | `-0.0552` → -5,52% | đúng |

Nghiêm trọng hơn: câu trả lời **tự mâu thuẫn** — vừa nói Q1/2025 là kỳ mới nhất, vừa nói "Q4/2024 … đây mới là kỳ mới nhất mà DB có". Cả hai đều sai.

**Câu trả lời đúng lẽ ra là Q1/2026: lợi nhuận +168,9% so với cùng kỳ, doanh thu 53.313 tỷ** — khác hoàn toàn về kết luận đầu tư.

**Vì sao guard chống bịa số không chặn được:**
- `_ungrounded_data` chỉ soi các số dạng "X đồng / X tỷ / X lần"; **phần trăm bị loại trừ có chủ ý** (docstring `loop.py:168`: *"'%' KHÔNG vào đây"*). Nên 11,5% / 9,2% không hề được kiểm tra.
- Số "34.643 tỷ" CÓ bị bắt làm ứng viên nhưng vẫn lọt: chạy lại `_ungrounded_data` với đúng dữ liệu tool trả về `False`. Nguyên nhân là dung sai `×1000 / ÷1000` trong `_register_grounded` — với một tập grounded lớn (hàng trăm tỷ số và chỉ số), gần như mọi số hai chữ số đều tìm được một "nguồn" trùng khớp giả. Guard mất tác dụng đúng ở chỗ cần nhất.

### 4.2 NGHIÊM TRỌNG — Projection dạng chuỗi trả về dữ liệu giả, âm thầm (lượt 7)

Model sinh `projection={"title": "1", "created_at": "1"}` — giá trị là **chuỗi `"1"`** thay vì số `1`. MongoDB ≥ 4.4 hiểu chuỗi trong projection là **biểu thức hằng**, nên trả về đúng chữ `"1"` cho mọi document. Gateway trả `ok=True`, không cảnh báo gì.

Tái hiện 100%, trên dữ liệu thật:

```
projection={"title": "1"}  →  [{'title': '1'}, {'title': '1'}, {'title': '1'}]
projection={"title": 1}    →  [{'title': 'ACB: Chủ tịch Trần Hùng Huy…'}, …]
```

`validate_find` kiểm tra projection là dict, kiểm tra operator cấm, kiểm tra `$series`, nhưng **không kiểm tra giá trị projection phải là 0/1**. Chính comment ở `validator.py:193` đã biết Mongo cho phép biểu thức trong projection, nhưng chỉ chặn operator cấm chứ không chặn hằng chuỗi.

**Chuỗi hậu quả ở lượt 7:** query "thành công" nhưng trả rác → model tưởng tin thiếu nội dung → thử lại với biến thể khác → chạm `MAX_ITERS = 10` → **644.883 token thật cho một câu hỏi**, và khách nhận được "Tiêu đề: (chưa có chi tiết)".

Đây là lỗi âm thầm nguy hiểm nhất trong bộ: không có exception, không có log lỗi, `ok=True`, và dữ liệu giả được đưa thẳng cho model.

*(Ghi chú phụ:* trong lượt 7 còn có vài lần `gateway mongo error` do `max_time_ms = 5000` — các query đó chạy lại lúc rảnh đều OK, nên là timeout nhất thời chứ không phải lỗi cố định. Nhưng nó cộng hưởng với lỗi trên để đẩy vòng lặp lên 10.)*

### 4.3 NẶNG — Hạn mức và cầu dao ngân sách đếm thiếu 2,47 lần

Xem §3.1. Ảnh hưởng trực tiếp tới tiền: `AGENT_DAILY_TOKEN_BUDGET` là cầu dao chống cháy ví, hiện chỉ thấy ~40% lượng token thật đã tiêu.

### 4.4 NẶNG — Câu trả lời cụt lọt ra tới khách (lượt 9)

Agent trả về đúng một dòng *"Top cổ phiếu có điểm dòng tiền ngày cao nhất (đã lọc thanh khoản tối thiểu):"* rồi dừng, không gọi tool nào.

Đã kiểm tra: `_needs_retry()` và `_looks_like_data_answer()` đều trả `False` cho chuỗi này, nên không guard nào kích hoạt và câu được stream thẳng cho user. Một dòng mở đầu kết thúc bằng dấu hai chấm, hứa hẹn danh sách nhưng không có danh sách, nên bị coi là preamble.

### 4.5 TRUNG BÌNH — Lạc đề ở trang quốc tế (lượt 5)

Trang `/international?tab=global_index`, hỏi về chứng khoán Mỹ và châu Á → trả lời về VNINDEX, 0 tool, rồi hỏi ngược user có muốn lấy số không. Dữ liệu S&P 500, Nasdaq, Nikkei 225, Shanghai Composite **có sẵn** trong `other_data` (`group: "international"`, `category: "global_index"`). Agent chưa gắn được ngữ cảnh trang quốc tế với nguồn dữ liệu tương ứng.

### 4.6 TRUNG BÌNH — Lộ thuật ngữ nội bộ cho khách phổ thông

| Thuật ngữ | Xuất hiện ở lượt |
|---|---|
| `TRANSITION` (tên pha, tiếng Anh) | 1, 2, 8 |
| "phơi nhiễm" | 1 |
| "backtest" | 2 |
| "trend line", "capitulation", "TB5" | 8, 14 |
| "phân vị xếp hạng trong ngành", "vùng KT" | 14 |
| "v1" (tên phiên bản nội bộ) | 7 |
| `LargeCaps` (tên rổ dạng mã) | 11 |

7/14 lượt có ít nhất một thuật ngữ khách phổ thông khó hiểu. Theo ghi nhận trước đây, owner đã chốt **dừng tối ưu K-hygiene bằng cách siết prompt**; nếu muốn xử lý thì nên làm bằng code (bảng ánh xạ `TRANSITION` → "giai đoạn chuyển tiếp" ở tầng hiển thị) chứ không phải thêm luật vào prompt.

### 4.7 NHẸ — Không tuân chỉ dẫn "trả lời ngắn" của bubble

Độ dài trung bình 720 ký tự; 3/14 lượt vượt 1.000 ký tự (lượt 8: **2.274 ký tự với 2 bảng**). Dòng `BREVITY` yêu cầu "hạn chế bảng dài và liệt kê dài dòng" nhưng 5/14 lượt vẫn dựng bảng markdown. Khung bubble hẹp nên đây là vấn đề trải nghiệm thật.

### 4.8 NHẸ — Nhãn ngữ cảnh trang bị lặp hai lần

`buildPageContext()` (frontend) đã chèn sẵn dòng `[NGỮ CẢNH TRANG — …]`, rồi `_page_context_block()` (`routers/chat.py:53`) chèn `_PAGE_CONTEXT_HEADER` **y hệt** lần nữa. Mỗi lượt lãng phí ~25 token và prompt trông lặp. Vô hại về mặt chức năng.

### 4.9 NHẸ — Bịa thêm một dòng phân loại (lượt 11)

Sau khi liệt kê đủ 20 mã LargeCaps đúng, agent thêm dòng thứ 21 *"Hàng không (gộp Du lịch Giải trí): HVN"* — HVN đã có ở dòng trên và ngành "Hàng không" không tồn tại trong `stock_info`. Danh sách tự mâu thuẫn với chính câu "gồm 20 mã".

### 4.10 GHI NHẬN — Slug ngành trong test không khớp route thật

`chatPageContext.test.ts` dùng `/sectors/ngan_hang`, nhưng route thật là `/sectors/nganhang` (không gạch dưới) và `/sectors/[sectorId]/page.tsx` sẽ `notFound()` với slug có gạch dưới. Test vẫn xanh vì `buildPageContext()` nhận mọi slug. Không phải bug sản phẩm, nhưng test đang bảo chứng cho một đường dẫn không tồn tại.

---

## 5. Hạn chế của lần đo này

- **Không chốt được lượt 8.** Các số top tăng/giảm ở lượt 8 lấy từ khối briefing trong system prompt, không phải từ tool. Probe không lưu lại nội dung khối system tại thời điểm chạy, mà briefing được làm mới trong phiên — nên khi đối chiếu với ảnh chụp briefing lấy sau đó ~30 phút thì 5/10 mã lệch giá trị. **Chưa đủ căn cứ kết luận là bịa số.** Lần đo sau cần lưu nguyên văn khối system theo từng lượt.
- Probe cắt nội dung tool ở 6.000 ký tự để giữ file gọn; khi cần đối chiếu sâu (như lượt 6) phải truy vấn lại DB. Lần sau nên lưu đủ.
- Mỗi lượt là một hội thoại mới, không có lịch sử. Chưa đo chi phí hội thoại nhiều lượt — token input sẽ còn tăng theo lịch sử.
- Chỉ đo với `thinking = disabled` (mặc định). Chưa đo chế độ `adaptive`.
- Chạy trong giờ giao dịch nên số liệu trong phiên thay đổi giữa các lượt; hợp lý cho việc đánh giá hành vi nhưng không tái lập chính xác từng con số.

---

## 6. Việc cần làm trước khi mở cho khách

| Ưu tiên | Việc | Vì sao |
|---|---|---|
| 1 | Chặn projection có giá trị không phải 0/1 ở `validate_find` | §4.2 — dữ liệu giả âm thầm, đắt và sai |
| 2 | Thêm `usage` vào `ToolCallsEvent` và cộng dồn trong `_merge_usage` | §4.3 — hạn mức và cầu dao ngân sách đang mù |
| 3 | Xử lý câu preamble cụt trong `_needs_retry` | §4.4 — khách thấy câu trả lời rỗng |
| 4 | Điều tra việc chọn sai kỳ BCTC (lượt 6) | §4.1 — sai lệch kết luận đầu tư |
| 5 | Bật cache prompt / cắt KB pack, rồi đo lại và chốt trần | §3.2, §3.5 — 99,6% chi phí nằm ở đây |
| 6 | Chốt lại trần token sau khi có số đo mới | §3.5 |

Bộ 14 câu ở §1 nên chạy lại sau mỗi lần đổi model hoặc đổi prompt, và so với bảng §2.
