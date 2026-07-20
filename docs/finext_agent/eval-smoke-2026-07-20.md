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

---

## 7. Chạy lại sau khi sửa chỗ cắt dữ liệu (2026-07-20)

> **Vì sao chạy lại:** §4.1 kết luận sai. Lúc đó tưởng "tool đã trả đủ 9 kỳ, model tự chọn sai kỳ".
> Điều tra sau đó tìm ra nguyên nhân thật: `registry.py` cắt `content[:12000]` **giữ phần ĐẦU**,
> nên kết quả HPG 28.026 ký tự (9 kỳ `2024_1…2026_1`) bị cắt còn 4 kỳ **CŨ NHẤT** và JSON hỏng
> giữa chừng. Model **không hề nhìn thấy** dữ liệu 2025/2026 nên đã bịa số. Bản ghi eval lần 1
> cắt tool-result ở 6.000 ký tự (xem §5) nên đúng cái bằng chứng đó bị giấu suốt một phiên.
>
> **Đã sửa** (plan `2026-07-20-cat-du-lieu-tool.md`, Task 1-4): module mới `app/agent/tools/shrink.py`
> thu gọn theo **cấu trúc** — bỏ trọn phần tử, giữ kỳ **MỚI**, kèm ghi chú `[GHI CHÚ NỘI BỘ]`
> nói rõ đã bỏ gì và cấm tự điền số. Trần nâng lên `MAX_TOOL_RESULT_CHARS = 24.000` /
> `MAX_TOTAL_TOOL_CHARS = 40.000` (chia đều cho các lời gọi song song). Bỏ nhãn ngữ cảnh trang
> bị chèn trùng ở frontend.
>
> **Cách chạy:** y hệt §1 (probe scratchpad đi đúng đường `/chat/stream`, `thinking = disabled`),
> khác đúng ba điểm: (1) ngữ cảnh trang **không** tự chèn nhãn nữa — để backend chèn, giống
> production sau Task 4; (2) **lưu nguyên văn** tool-result, không cắt 6.000 ký tự; (3) lưu thêm
> khối briefing của system prompt theo từng lượt để chốt được các lượt lấy số từ briefing.
>
> **Số lượt:** 14/14, mỗi câu đúng một lượt, không chạy lại lượt nào. Chạy 16:0x–16:2x,
> tức **sau khi thị trường đóng cửa** — lần 1 chạy 10:56–11:05 **trong phiên**. Đây là khác biệt
> quan trọng khi đối chiếu: dữ liệu thị trường của hai lần đo khác nhau thật sự
> (VNINDEX lần 1 `-1,17%` tạm tính, lần 2 `-2,46%` đóng cửa).

### 7.1 Bảng 14 câu — mới đặt cạnh cũ

| # | Route | Kết quả CŨ (§2) | Kết quả MỚI | Đổi | Tool cũ→mới | Vòng cũ→mới | Token thật cũ→mới |
|---|---|---|---|---|---|---|---|
| 1 | `/phase?tab=conservative` | ĐẠT (có ghi chú) | ĐẠT | giữ nguyên | 1→1 | 2→2 | 131.494→131.224 |
| 2 | `/phase?tab=aggressive` | ĐẠT (có ghi chú) | ĐẠT | giữ nguyên | 2→1 | 2→2 | 101.545→131.318 |
| 3 | `/phase?tab=core` | ĐẠT | ĐẠT | giữ nguyên | 1→2 | 2→2 | 133.355→127.750 |
| 4 | `/commodities?tab=metals` | ĐẠT (có ghi chú) | ĐẠT | giữ nguyên | 2→2 | 3→2 | 192.705→96.939 |
| 5 | `/international?tab=global_index` | **KHÔNG ĐẠT** | ĐẠT (có ghi chú) | **tốt lên** | 0→1 | 1→2 | 63.417→127.734 |
| 6 | `/stocks/HPG?tab=financials` | **KHÔNG ĐẠT — bịa số** | **ĐẠT** | **tốt lên** | 1→3 | 2→2 | 132.303→105.036 |
| 7 | `/stocks/FPT?tab=news` | **KHÔNG ĐẠT — lỗi kỹ thuật** | ĐẠT (có ghi chú) | **tốt lên** | 10→11 | 10→10 | 644.883→650.170 |
| 8 | `/` | ĐẠT (có ghi chú) | ĐẠT | giữ nguyên | 5→5 | 8→4 | 532.212→235.134 |
| 9 | `/stocks` | **KHÔNG ĐẠT — câu cụt** | **KHÔNG ĐẠT — không trả lời được** | tốt lên (chưa đạt) | 0→9 | 1→10 | 63.731→650.376 |
| 10 | `/sectors` | ĐẠT | **KHÔNG ĐẠT — từ chối vì không lấy được dữ liệu** | **XẤU ĐI** | 1→9 | 3→10 | 161.998→643.288 |
| 11 | `/groups/largecap` | ĐẠT (có ghi chú) | **KHÔNG ĐẠT — bịa phân ngành** | **XẤU ĐI** | 2→2 | 2→3 | 128.574→191.247 |
| 12 | `/watchlist` | ĐẠT | ĐẠT | giữ nguyên | 1→2 | 2→3 | 97.465→194.207 |
| 13 | `/macro?tab=monetary` | ĐẠT (có ghi chú) | ĐẠT | giữ nguyên | 2→2 | 2→4 | 129.303→255.943 |
| 14 | `/sectors/kimloai?tab=stocks` | ĐẠT (có ghi chú) | ĐẠT | giữ nguyên | 4→5 | 5→5 | 323.081→327.753 |

**Tỷ lệ đạt: 11/14 (79%)**, so với **10/14 (71%)** lần 1.

- **Tốt lên: 3 câu** — 5, 6, 7.
- **Xấu đi: 2 câu** — 10, 11 (xem §7.3).
- **Giữ nguyên: 9 câu.**

### 7.2 Câu 6 — ĐẠT, đối chiếu trực tiếp với `agent_db`

Câu trả lời của agent:

> Lợi nhuận HPG **tăng mạnh so với cùng kỳ**.
> - **Quý I/2026:** lợi nhuận sau thuế tăng **168,94%** so với quý I/2025.
> - Doanh thu cũng tăng **40,48%** […]
> - Tuy nhiên, dữ liệu dòng tiền hiện tại chưa ủng hộ: điểm dòng tiền tuần của HPG ở mức **-41,7** […]; giá đã giảm **8,04% trong tuần**.

Đối chiếu với `agent_db` (truy vấn trực tiếp, không tin câu trả lời):

| Agent nói | Trong DB | |
|---|---|---|
| Kỳ mới nhất là **Quý I/2026** | `financial_statements.quarterly` kỳ cuối = `2026_1` | ĐÚNG |
| LNST **+168,94%** YoY | `Tăng trưởng LNST YoY = 1.6894` | ĐÚNG |
| Doanh thu **+40,48%** YoY | `Tăng trưởng doanh thu YoY = 0.4048` | ĐÚNG |
| Điểm dòng tiền tuần **-41,7** | `money_flow_score.week_score = -41.7` | ĐÚNG |
| Giá tuần **-8,04%** | `change.w_pct = -8.04` | ĐÚNG |

**Không có số nào sai, không có số nào bịa.** So với lần 1: khẳng định sai kỳ (Q1/2025 là "mới nhất"),
bịa doanh thu 34.643 tỷ, sai `11,5%` và `9,2%`, và tự mâu thuẫn với chính mình.

*Một khác biệt so với kỳ vọng nghiệm thu:* plan chờ agent nêu doanh thu tuyệt đối **53.313 tỷ**;
agent nêu **mức tăng +40,48%** thay vì con số tuyệt đối. Con số 53.313 tỷ **có** trong tool-result
(`Doanh thu thuần = 53312910120686`) — agent chọn diễn đạt theo phần trăm, phù hợp với câu hỏi
("tăng hay giảm"), không phải lỗi dữ liệu.

**Ghi chú `[GHI CHÚ NỘI BỘ]` có hoạt động thật.** Lượt này model gọi `db_aggregate` lấy `$slice: -5`
(5 kỳ); kết quả vượt ngân sách nên `shrink_result` bỏ đúng **kỳ CŨ NHẤT** và nối ghi chú — nguyên văn
phần đuôi tool-result mà model nhận được:

```
… {"period": "2026_1", "data": [… {"vi_name": "Doanh thu thuần", …, "value": 53312910120686},
{"vi_name": "Tăng trưởng doanh thu YoY", …, "value": 0.4048},
{"vi_name": "Tăng trưởng LNST YoY", …, "value": 1.6894}, …]}]}]

[GHI CHÚ NỘI BỘ — không đọc cho khách] Kết quả quá lớn nên đã lược bớt. Chỉ kết luận trên phần
còn lại. Nếu khách hỏi về phần đã bỏ, hãy nói là chưa lấy được — TUYỆT ĐỐI không tự điền số.
Đã giữ 4/5 phần tử MỚI NHẤT của quarterly_recent, từ 2025_2 đến 2026_1. Đã bỏ các phần tử cũ hơn:
2025_1. Cần phần đã bỏ thì truy vấn lại với projection ít field hơn hoặc $slice nhỏ hơn.
```

Đây đúng là hình dạng mà hành vi cũ làm hỏng: cùng một kết quả vượt trần, nhưng nay **giữ `2026_1`**
và **bỏ `2025_1`** thay vì ngược lại, JSON vẫn hợp lệ, và model được nói rõ đã mất gì.

**Tần suất kích hoạt trên toàn bộ 14 lượt:** 55 lời gọi tool, **1** lời gọi có `shrunk = True`
(chính là lượt 6) và **1** lời gọi mang `[GHI CHÚ NỘI BỘ]`. Ba lời gọi khác vượt 12.000 ký tự
(`read_kb` 21.751 và 60.059 ký tự) — các lời gọi này trả markdown nên đi đường `_cap_text`,
cắt theo ranh giới **dòng** kèm ghi chú "đã cắt", không phải đường `shrink_result`.
Tức là **4/55 lời gọi (7%)** trước đây sẽ bị cắt mù ở trần 12.000.

### 7.3 Hai câu xấu đi

**Câu 10 `/sectors` — ĐẠT → KHÔNG ĐẠT.** Model gọi `db_aggregate` **9 lần, hỏng cả 9**, chạm
`MAX_ITERS = 10`, rồi trả lời trung thực là không có dữ liệu:

> Vì không có dữ liệu trong tay nên mình không thể đưa ra câu trả lời có số liệu thật cho câu hỏi này — đoán số sẽ làm sai lệch hoàn toàn.

Nguyên nhân: model tự bọc từng stage pipeline thành chuỗi trong một khoá `$text`, ví dụ
`pipeline: [{"$text": "{\"$sort\": {…}}"}, {"$text": "{\"$limit\": 24}"}]`. Validator không thấy
stage `$limit` thật nên từ chối: *"pipeline bắt buộc có stage $limit (1..50)"*. Model sửa loanh quanh
9 lần mà không bỏ được lớp `$text`.

**Đây không phải hành vi mới.** Cùng dạng lỗi `$text` đã có trong bản ghi eval lần 1 (lượt 8, 3 lần
gọi) — khi đó model tự thoát ra được. Sửa lần này (`shrink.py`, chia ngân sách, bỏ nhãn trùng) chỉ
động tới **kích thước kết quả trả về**, không động tới cách dựng lời gọi, nên nhiều khả năng đây là
tính bất định của model chứ không phải hồi quy do thay đổi. Nhưng một lần đo không chứng minh được
điều đó — **cần theo dõi**. Điểm tích cực: khi bí, agent chọn nói thật thay vì bịa số.

**Câu 11 `/groups/largecap` — ĐẠT → KHÔNG ĐẠT.** Lời gọi đầu hỏng; lời gọi thứ hai model đặt sai chỗ
các khoá (`"projection": {"ticker": 1}, "industry": 1, "outstandingShare": 1` — `industry` nằm **ngoài**
projection) nên tool chỉ trả về **20 mã trần, không có field ngành**. Model vẫn dựng bảng phân ngành,
lấy từ trí nhớ của chính nó:

- **TCX xếp "Cao su"** — sai; TCX là công ty chứng khoán (lần 1 phân đúng "Công ty Chứng khoán").
- **VPX xếp "Khác"** — thực tế là công ty chứng khoán.
- Ghi "**Ngân hàng (7)**" rồi liệt kê **8 mã**.
- Lộ câu nội bộ ra cho khách: *"(nhóm này có nhưng danh sách trả về chỉ liệt kê 20 mã — kiểm tra kỹ hơn nếu cần)"*.

Danh sách **20 mã là đúng** (khớp `stock_info`), phần **phân ngành là bịa**. Cùng họ với §4.9 lần 1
(bịa thêm dòng "Hàng không") nhưng nặng hơn. Ghi chú `[GHI CHÚ NỘI BỘ]` không cứu được ca này vì
tool **thành công** và **không bị cắt** — nó trả đúng thứ model xin, chỉ là model xin thiếu.

### 7.4 Ba câu tốt lên

- **Câu 5 `/international`.** Lần 1: 0 tool, lạc sang VNINDEX, hỏi ngược khách. Lần 2: gọi
  `other_data` (`group: international`, `category: global_index`), trả lời đúng trọng tâm. Đối chiếu
  nguyên văn tool-result: S&P 500 `-1,03%` phiên / `-1,57%` tuần, Dow `-0,77%` / `-0,93%`,
  Nasdaq `-1,40%` / `-2,90%`, Shanghai `+0,85%` / `-2,97%` / `-9,03%` tháng,
  Nikkei `-4,07%` / `-6,55%` / `-10,02%` tháng — **tất cả khớp**. *Một lỗi:* câu
  "Riêng Nasdaq và Dow tuần qua giảm mạnh hơn (−2,90% và −6,55%)" gán nhầm `-6,55%` (của Nikkei)
  cho Dow, mâu thuẫn với chính con số `-0,93%` nó vừa nêu cho Dow ở câu trước.
- **Câu 6.** Xem §7.2 — đây là câu mà bản sửa nhắm tới.
- **Câu 7 `/stocks/FPT?tab=news`.** Lần 1 trả về vô dụng ("Tiêu đề: (chưa có chi tiết)"). Lần 2 trả
  5 tin thật kèm link và ngày. Công lớn thuộc về commit `218222a` (chặn projection hằng chuỗi —
  đúng việc §6 ưu tiên 1 yêu cầu), **không** phải bản sửa cắt dữ liệu. Vẫn còn **11 tool / 10 vòng /
  650.170 token** cho một câu hỏi — chi phí chưa được chữa.

### 7.5 Token — hai con số, và một cảnh báo khi đọc bảng

**Cột "quota" của §2 không còn so sánh được với lần này.** Commit `7f770a3` (20/07 14:00, tức **sau**
lần đo 1) đã thêm `usage` vào `ToolCallsEvent` và cộng dồn trong `_merge_usage` — đúng việc §6 ưu tiên 2
yêu cầu. Nên trong lần đo 2, **quota = token thật** ở cả 14 lượt (§3.1 đo được lệch 2,47× nay bằng 1,00×).
Con số quota tổng nhảy từ 1.148.759 lên 3.868.119 (+237%) **không phải chi phí tăng** — là hệ thống
thôi đếm thiếu.

Token **thật** (so sánh được):

| | Lần 1 | Lần 2 |
|---|---|---|
| Tổng 14 lượt | 2.836.066 | 3.868.119 (+36,4%) |
| Tổng, **bỏ lượt 9 và 10** | 2.610.337 | 2.574.455 (**-1,4%**) |
| Trung bình/lượt | 202.576 | 276.294 |
| Ký tự trả lời trung bình | 720 | 848 |
| Giây trung bình | 29,7 | 43,6 |

Toàn bộ mức tăng 36% nằm ở hai lượt bão retry 9 và 10 (63.731→650.376 và 161.998→643.288). Bỏ hai
lượt đó ra thì tổng token **giảm nhẹ 1,4%** — tức việc nâng trần 12.000 → 24.000 **không** làm chi
phí tăng đáng kể, đúng như ước tính trong plan (+12.000 ký tự ≈ 3.000 token ≈ 0,0009 USD/lượt).
Cái đắt vẫn là bão retry, không phải kích thước kết quả tool.

### 7.6 Còn treo sau lần đo này

| Ưu tiên | Việc | Vì sao |
|---|---|---|
| 1 | Chặn/sửa lời gọi bọc stage trong `$text` (câu 9, 10) | 2 trong 14 câu tiêu 650k token rồi không trả lời được |
| 2 | Chặn trần vòng lặp theo **token** chứ chỉ theo `MAX_ITERS` là chưa đủ | 3 lượt chạm 10 vòng, mỗi lượt >640k token |
| 3 | Không cho model tự phân ngành khi tool không trả field ngành (câu 11) | bịa phân loại lọt tới khách |
| 4 | Còn nguyên §3.5: bật cache prompt rồi chốt lại trần | 99,6% chi phí vẫn là system prompt lặp lại |

Các mục §6.1 (projection hằng chuỗi) và §6.2 (đếm token) đã xong; §6.4 (chọn sai kỳ BCTC) xong bằng
plan `2026-07-20-cat-du-lieu-tool.md`; §6.3 (câu preamble cụt) không tái hiện ở lần đo này.

---

## 8. Chạy lại sau batch tối ưu (repair pipeline + cầu dao bão retry + KB $slice) — 2026-07-20

> **Vì sao chạy lại:** ba fix mới vào working tree (chưa commit): (1) `tools/db.py::_repair_stage` bóc
> stage bị bọc `{"$text": "<JSON>"}` — nguyên nhân câu 10 hỏng 9 vòng ở §7; (2) `loop.py` hai cầu dao
> chặn bão retry (`MAX_FAILED_TOOL_ROUNDS=2` ép trả lời trung thực bằng `_GIVE_UP_NUDGE`; `MAX_TURN_TOKENS=600k`
> ép trả lời); (3) `kb/agent_db_02.md` hạ ví dụ `$slice` -104/-156 → -52 + trỏ `db_stats` cho cửa sổ dài.
>
> **Cách chạy:** y hệt §7 (probe scratchpad `eval_smoke3.py` = tái dùng `eval_smoke2.py`, đổi output
> `eval3_*`, thêm bắt log `"loop give-up"` để đo cầu dao). Đi đúng đường `/chat/stream`, `thinking=disabled`,
> ngữ cảnh trang KHÔNG tự chèn nhãn (backend chèn), lưu nguyên văn tool-result. **Sau giờ đóng cửa**
> (VNINDEX -2,46% đóng 1743,51 — cùng phiên với §7). Mỗi câu 1 lượt, 14/14.

### 8.1 Bảng 14 câu — lần 3 đặt cạnh §7

| # | Route | §7 | **Lần 3** | Đổi | Token thật §7→lần 3 | Tool §7→3 | Vòng §7→3 | Cầu dao |
|---|---|---|---|---|---|---|---|---|
| 1 | `/phase?tab=conservative` | ĐẠT | **ĐẠT** | giữ | 131.224→131.844 | 1→1 | 2→2 | - |
| 2 | `/phase?tab=aggressive` | ĐẠT | **KHÔNG ĐẠT** | **XẤU ĐI** | 131.318→63.870 | 1→0 | 2→1 | - |
| 3 | `/phase?tab=core` | ĐẠT | **ĐẠT** | giữ | 127.750→101.949 | 2→3 | 2→2 | - |
| 4 | `/commodities?tab=metals` | ĐẠT | **ĐẠT** | giữ | 96.939→128.801 | 2→2 | 2→2 | - |
| 5 | `/international?tab=global_index` | ĐẠT | **KHÔNG ĐẠT — bịa số** | **XẤU ĐI** | 127.734→63.820 | 1→0 | 2→1 | - |
| 6 | `/stocks/HPG?tab=financials` | ĐẠT | **KHÔNG ĐẠT — từ chối** | **XẤU ĐI** | 105.036→**449.930** | 3→6 | 2→7 | **YES** |
| 7 | `/stocks/FPT?tab=news` | ĐẠT | **KHÔNG ĐẠT — từ chối** | **XẤU ĐI** | 650.170→192.803 | 11→4 | 10→3 | **YES** |
| 8 | `/` | ĐẠT | **ĐẠT** | giữ | 235.134→164.400 | 5→3 | 4→3 | - |
| 9 | `/stocks` | KHÔNG ĐẠT | **ĐẠT** | **TỐT LÊN** | 650.376→259.336 | 9→1 | 10→4 | - |
| 10 | `/sectors` | KHÔNG ĐẠT | **KHÔNG ĐẠT** | giữ (rẻ hơn) | 643.288→191.260 | 9→2 | 10→3 | **YES** |
| 11 | `/groups/largecap` | KHÔNG ĐẠT | **KHÔNG ĐẠT** | giữ (cải thiện) | 191.247→194.245 | 2→2 | 3→3 | - |
| 12 | `/watchlist` | ĐẠT | **KHÔNG ĐẠT — bịa số** | **XẤU ĐI** | 194.207→193.318 | 2→2 | 3→3 | - |
| 13 | `/macro?tab=monetary` | ĐẠT | **ĐẠT** | giữ | 255.943→128.269 | 2→1 | 4→2 | - |
| 14 | `/sectors/kimloai?tab=stocks` | ĐẠT | **KHÔNG ĐẠT — từ chối** | **XẤU ĐI** | 327.753→192.095 | 5→2 | 5→3 | **YES** |

**Tỷ lệ đạt: 6/14 (43%)** — **XẤU ĐI RÕ** so với **11/14 (79%)** ở §7.

- **Tốt lên: 1 câu** — 9.
- **Xấu đi: 6 câu** — 2, 5, 6, 7, 12, 14.
- **Giữ nguyên: 7 câu** — 1, 3, 4, 8 (ĐẠT); 10, 11 (KHÔNG, nhưng rẻ hơn/cải thiện); 13 (ĐẠT).
- **Cầu dao kích hoạt: 4 câu** — 6, 7, 10, 14.

> **Đây là số đo thật, tệ hơn §7.** Quan trọng: 3 fix **KHÔNG phải nguyên nhân** (§8.5 điều tra). Sụt điểm
> do **một phiên model xấu**: M3 lần này hỏng cú pháp truy vấn trên diện rộng (bọc SỐ thành CHUỖI, sai
> đường field), cộng 2 ca bịa số âm thầm (5, 12) + 1 ca lộ kế hoạch nội bộ (2). One-shot, phương sai cao.

### 8.2 Trọng tâm 1 — Câu 10 `/sectors`: VẪN KHÔNG ĐẠT (kỳ vọng đạt nhờ fix 1 — KHÔNG đạt)

- 2 `db_aggregate`, **cả 2 fail**, 3 vòng, **cầu dao kích hoạt** (`loop give-up: failed_rounds=2 spent=127753 iter=2`).
- **Root cause KHÁC §7.** Kiểu `$text` cũ mà fix 1 nhắm tới **không tái diễn** — tức fix 1 có tác dụng.
  Nhưng model hỏng theo kiểu MỚI: **bọc số thành chuỗi** — `$limit: "25"`, `$sort: {"week_score": "-1"}`,
  `$project: {"industry_name": "1"}`. Validator từ chối đúng ("$limit='25' không hợp lệ — phải là số nguyên"),
  model không tự sửa được lớp chuỗi này.
- Trả lời **TRUNG THỰC** (không bịa): *"Tôi chưa tra cứu được bảng xếp hạng ngành lúc này... không đưa ra
  được thứ hạng cụ thể."* Token 643k→191k (giảm 70% nhờ cầu dao).

### 8.3 Trọng tâm 2 — Câu 6 HPG: KHÔNG GIỮ ĐƯỢC ĐẠT — XẤU ĐI NẶNG (điểm đau nhất)

- §7 ĐẠT (+168,94% YoY đúng, 105k). Lần 3: **6 tool, 7 vòng, 449.930 token — lượt ĐẮT NHẤT bộ**, cầu dao
  kích hoạt MUỘN (`failed_rounds=2 spent=385743 iter=6`), rồi **từ chối trung thực**.
- Root cause: model **mangle cú pháp `$slice`/`$arrayElemAt`** lặp lại:
  `{"$slice": {"item": "$financial_statements.quarterly", "-5": ""}}`,
  `{"$arrayElemAt": {"item": ..., "-1": ""}}` — dùng số âm làm KEY, sai hoàn toàn.
- **KB `agent_db_02.md` KHÔNG phải thủ phạm** (đã kiểm diff): chỉ đổi `$slice -104/-156 → -52` + thêm ví
  dụ `db_stats`; cú pháp `{"$slice": -52}` vẫn đúng. Model tự chế cú pháp hỏng (nondeterminism).
- Cầu dao nhảy MUỘN (iter 6, 385k) vì có 2 lần tool `ok=True` trả **rác** (1 lần projection key = cả biểu
  thức chuỗi; 1 lần chỉ lấy `period`) làm **reset bộ đếm `failed_rounds`** → bão chạy tới 385k mới bị chặn.
  Đây là lỗ hổng của cầu dao: vòng "thành công nhưng vô ích" reset bộ đếm fail-sạch.
- Trả lời **không bịa số** (khác hẳn thảm hoạ §4.1 lần 1): *"Chưa tra cứu được dữ liệu BCTC của HPG..."*

### 8.4 Trọng tâm 3 — Token: ĐẠT mục tiêu (không lượt nào >650k) + cầu dao đều trung thực

- Lượt đắt nhất **Q6 = 449.930** (< 600k, < 650k). §7 có **3 lượt >640k** (7, 9, 10) → lần này **không còn**.
- Tổng 14 lượt: 3.868.119 → **2.455.940 (-36,5%)**.
- **Cầu dao kích hoạt 4 lần (Q6, Q7, Q10, Q14)** — tất cả theo nhánh `starved` (2 vòng tool fail sạch);
  **không** lượt nào chạm trần token 600k. **Cả 4 câu ép trả lời đều TRUNG THỰC, không bịa số** — cầu dao
  chạy đúng thiết kế.

### 8.5 Các câu XẤU ĐI + nguyên nhân đã điều tra (đọc tool_log từng lượt)

- **Q2 `/phase?tab=aggressive` — LỘ KẾ HOẠCH NỘI BỘ, 0 tool.** Nguyên văn câu trả lời: *"User đang hỏi về
  rủi ro của rổ Mạo Hiểm (AGGRESSIVE) — tab đang mở. Cần đọc AGGRESSIVE + market_phase + phase_trading (sổ
  lệnh rổ) để đánh giá rủi ro thật."* — suy nghĩ/kế hoạch của model bị stream thẳng làm câu trả lời.
  `_needs_retry` không bắt vì `_PREAMBLE_ONLY_RE` chỉ khớp mở đầu "tôi sẽ/mình sẽ/để tôi..."; câu này mở
  đầu "User đang hỏi..." nên lọt qua.
- **Q5 `/international` — BỊA SỐ, 0 tool.** Nói *"S&P 500 tăng nhẹ gần đỉnh, Dow tăng mạnh, Nikkei +0,52%,
  Shanghai +0,32%, Hang Seng & Kospi giảm nhẹ."* Đối chiếu `other_data` (group=international,
  category=global_index): S&P **-1,03%**, Dow **-0,77%**, Nikkei **-4,07%** (đều GIẢM), Shanghai **+0,85%**
  (không phải 0,32); **Hang Seng/Kospi không tồn tại** trong DB. Bịa hoàn toàn. Guard không bắt vì câu văn
  xuôi dùng "%" (guard loại trừ % có chủ ý). Q5 vốn bất định: lần1 fail (lạc VNINDEX), lần2 pass, lần3 fail.
- **Q6** — xem §8.3.
- **Q7 `/stocks/FPT?tab=news` — string projection, không lấy được tin.** Model gửi
  `projection: {"title": "1", "sapo": "1", ...}` (chuỗi "1") — commit 218222a chặn ĐÚNG với thông báo rõ.
  Model không sửa, lặp lại (news_today_feed + news_history_feed 2 vòng) → **cầu dao iter=2** → trả lời
  trung thực "chưa tra được do trục trặc kỹ thuật". Khách không có tin (§7 trả 5 tin). Điểm sáng: 650k→193k,
  không bịa.
- **Q12 `/watchlist` — BỊA SỐ ÂM THẦM, lọt mọi guard (ca nguy hiểm nhất bộ).** `db_aggregate`
  industry_snapshot với projection **field phẳng** `{week_score:1, w_pct:1, m_pct:1, breadth_in:1}` trong
  khi schema **lồng**: `money_flow_score.week_score`, `change.w_pct`, `breadth.breadth_in`. Mongo trả về
  **CHỈ 24 tên ngành, không một con số** (sort theo field không tồn tại → thứ tự tuỳ ý). Model **tự chế**
  toàn bộ: *"1. Bán lẻ Tiêu dùng +3,40 / tuần +2,20%; 2. Kinh doanh Bảo hiểm +0,46..."* Đối chiếu DB:
  Bán lẻ Tiêu dùng week_score = **9,27**, w_pct = **-4,05**; top thật là **Thiết bị Công nghiệp 40,84**,
  Nhựa Bao bì 30,1, Thực phẩm 26,6 — không mã nào của model khớp thứ hạng. Guard số không bắt vì "+3,40"
  không kèm "tỷ/lần" và "%" bị loại. §7 ĐẠT.
- **Q14 `/sectors/kimloai` — string-quoted numbers, từ chối.** `$match {"price.volume": {"$gt": "50000"}}`,
  `$project {"ticker": "1"}` (chuỗi) → 2 fail → **cầu dao iter=2** → trả lời trung thực, không xếp hạng được
  (chỉ nêu HPG/HSG/NKG/POM từ trí nhớ, đúng thành viên nhưng không có số). §7 ĐẠT (5 tool). 328k→192k, không bịa.

### 8.6 Câu TỐT LÊN và câu KHÔNG ĐẠT nhưng CẢI THIỆN

- **Q9 `/stocks` — KHÔNG→ĐẠT.** 1 `db_aggregate` stock_snapshot (lọc `volume>100k, trading_value>5`, sort
  week_score), bảng 15 mã **khớp CHÍNH XÁC DB**: SHN 312, VVS 195, EVS 170,7, VPX 151,8, HUT 138,3, PVD
  118,5, KSF 117,8... (đối chiếu trực tiếp, tất cả đúng cả giá/`pct_change`). §7 bão retry 650k không trả
  lời được; lần này 259k có bảng đúng. Vẫn lộ "TRANSITION", dài 1.813 ký tự (vi phạm brevity).
- **Q11 `/groups/largecap` — KHÔNG ĐẠT nhưng cải thiện.** Lần này lấy ĐÚNG field `industry` (grounded),
  phân ngành **chính xác** (TCX/VPX → Chứng khoán — khác §7 bịa "Cao su"/"Khác"). Nhưng: (1) liệt kê **42
  mã** trong khi DB có **41** — thêm nhầm **VCI** (không phải LargeCap; 41/41 mã thật đều có mặt, chỉ dư 1
  mã bịa); (2) nhãn ngoặc sai (ghi "Ngân hàng (11)" nhưng liệt kê 14; "Chứng khoán (4)" liệt kê 5). Gần đạt
  nhất trong nhóm trượt.

### 8.7 Root cause chung (điều tra) — KHÔNG do 3 fix

Phiên này M3 hỏng cú pháp truy vấn trên diện rộng:
1. **Bọc SỐ/giá trị thành CHUỖI**: Q7 `"title":"1"`; Q10 `$limit:"25"`, `$sort:"-1"`; Q14 `$gt:"50000"`,
   `"ticker":"1"`; Q6 `$slice`/`$arrayElemAt` dạng dict-số-âm-làm-key. Validator chặn ĐÚNG (không bịa) nhưng
   model không hồi phục → cầu dao → từ chối. (Q11/Q12 có lúc thoát ra được → nondeterminism thuần.)
2. **Sai đường field (phẳng vs lồng)**: Q12 project `week_score` thay vì `money_flow_score.week_score` →
   tool trả rỗng số → model bịa (lỗ hổng bịa-âm-thầm).
3. **Đã loại trừ 3 fix**: `_repair_stage` chỉ đụng stage `{"$text":...}`/chuỗi, **không** đụng value trong
   stage thường (kiểm code); KB `$slice` cú pháp đúng; cầu dao chỉ đổi điều kiện dừng. Ba fix chạy đúng
   thiết kế và kiềm chế chi phí tốt.

**Cảnh báo phương pháp:** 1 lần đo, one-shot, dữ liệu thị trường khác thời điểm §7. Phương sai cao (§7.3 đã
cảnh báo Q10 có thể nondeterminism — lần này xác nhận biên độ dao động rất lớn: Q6 105k→450k, Q9 fail→pass,
Q2/5/6/7/12/14 pass→fail). **Không kết luận được "batch fix làm tệ đi".** Kết luận được: fix **kiềm chế chi
phí xuất sắc** (-36,5%, không lượt >650k, 4 câu ép trả lời đều trung thực), nhưng **không nâng tỷ lệ đúng**,
và **bộ guard hiện không bắt được 3 lớp lỗi**: string-number query, bịa-khi-projection-trả-rỗng-số, lộ-kế-hoạch.

### 8.8 Đề xuất (chỉ nêu, chưa sửa)

| Ưu tiên | Việc | Vì sao |
|---|---|---|
| 1 | **Coerce chuỗi-số ở validator/gateway trước khi từ chối**: `$limit "25"`→25, `$sort "-1"`→-1, value "1"/"50000"→số | tự sửa lớp lỗi giết Q6/7/10/14 mà không cần model hồi phục (cùng tinh thần `_repair_stage`) |
| 2 | **Chặn bịa-âm-thầm khi projection trả rỗng field số** (Q12): câu bảng/xếp-hạng-có-số mà tool chỉ trả tên → coi chưa grounded; hoặc cảnh báo projection field phẳng không tồn tại trong doc | Q12 bịa lọt mọi guard — nguy hiểm nhất |
| 3 | **Cầu dao: đừng reset `failed_rounds` khi tool `ok=True` trả rác + đếm token sớm hơn** (vd 300k/lượt) | Q6 đốt 385k mới bị chặn vì rác reset bộ đếm |
| 4 | **Mở rộng guard lộ-kế-hoạch/preamble** (Q2): câu mở đầu "User đang hỏi/Cần đọc/Cần lấy..." + 0 tool → nudge | câu kế-hoạch lọt tới khách |
| 5 | **Guard bịa văn-xuôi-% khi 0 tool trên trang có nguồn** (Q5): khẳng định chiều tăng/giảm chỉ số nước ngoài cụ thể mà 0 tool → ép gọi `other_data` | bịa số văn xuôi lọt guard (% bị loại) |

**Bộ 14 câu nên chạy lại ≥2-3 lần/đợt** để tách nondeterminism khỏi hồi quy thật — một lần đo không đủ.

---

## 9. Chạy lại sau batch coerce số-chuỗi + hint aggregate + chặn độc thoại (2026-07-20)

> **Vì sao chạy lại:** §8 ra 6/14 vì một phiên M3 hỏng cú pháp diện rộng — bọc SỐ thành CHUỖI
> (`$limit:"25"`, `$sort:"-1"`, `$gt:"50000"`, projection `"1"`), bẻ MẢNG thành DICT
> (`{"$slice": {"item": X, "-5": ""}}`), độc thoại kế hoạch lọt ra làm câu trả lời (Q2), và 1 ca bịa số
> âm thầm do `$project` field lồng sai tên không cảnh báo (Q12). Từ đó vào 3 fix (chưa commit, working tree,
> **507 pytest xanh**):
> - **Fix D** `tools/db.py`: coerce số-bọc-chuỗi THEO VỊ TRÍ (`$limit "25"`→25, `$sort "-1"`→-1,
>   `$gt "50000"`→50000, projection/`$project` `"1"`→1) + unmangle `$slice`/`$arrayElemAt` dạng dict-số-âm-làm-key
>   + key-mangle. Chỉ ép ở vị trí mà chuỗi-số không bao giờ hợp lệ.
> - **Fix E** `gateway/executor.py`: đường aggregate giờ cũng gắn `meta["note"]` "field không tồn tại" như find
>   (bịt ca Q12 §8 bịa xếp hạng do projection field phẳng trả rỗng số).
> - **Fix F** `loop.py::_needs_retry`: bắt độc thoại kế hoạch (`^(user|khách|người dùng)…(đang|vừa) hỏi`)
>   và câu cụt ≤300 ký tự kết thúc bằng ":".
>
> **Cách chạy:** y hệt §8 — probe `eval_smoke4.py` (tái dùng nguyên `eval_smoke3.py`, đổi output → `eval4_*`,
> request_id `eval4-`). Đi đúng đường `/chat/stream`, `thinking=disabled`, ngữ cảnh trang KHÔNG tự chèn nhãn
> (backend chèn), lưu NGUYÊN VĂN tool-result. Cùng ảnh chụp `agent_db` với §7/§8 (sau đóng cửa 20/07,
> VNINDEX -2,46% đóng 1743,51 — ground-truth khớp §8 từng số). Mỗi câu 1 lượt, 14/14, không rerun lượt nào.

### 9.1 Bảng 14 câu — lần 4 đặt cạnh §7 và §8

| # | Route | §7 | §8 | **Lần 4** | Token thật §8→4 | Tool | Vòng | Cầu dao |
|---|---|---|---|---|---|---|---|---|
| 1 | /phase conservative | ĐẠT | ĐẠT | **ĐẠT** | 131.844→131.765 | 1 | 2 | - |
| 2 | /phase aggressive | ĐẠT | KHÔNG | **ĐẠT** (phục hồi) | 63.870→139.533 | 2 | 2 | - |
| 3 | /phase core | ĐẠT | ĐẠT | **ĐẠT** | 101.949→192.101 | 2 (1 fail) | 3 | - |
| 4 | /commodities metals | ĐẠT | ĐẠT | **ĐẠT** | 128.801→128.548 | 1 | 2 | - |
| 5 | /international | ĐẠT | KHÔNG (bịa) | **ĐẠT** (phục hồi) | 63.820→97.030 | 2 | 2 | - |
| 6 | /stocks/HPG financials | ĐẠT | KHÔNG (từ chối) | **ĐẠT** (phục hồi) | 449.930→134.284 | 1 | 2 | - |
| 7 | /stocks/FPT news | ĐẠT | KHÔNG (từ chối) | **ĐẠT** (phục hồi) | 192.803→131.307 | 2 | 2 | - |
| 8 | / | ĐẠT | ĐẠT | **ĐẠT** | 164.400→229.191 | 2 | 4 | - |
| 9 | /stocks | KHÔNG | ĐẠT | **ĐẠT** | 259.336→329.606 | 4 (1 fail) | 5 | - |
| 10 | /sectors | KHÔNG | KHÔNG | **ĐẠT** (tốt lên) | 191.260→129.433 | 1 | 2 | - |
| 11 | /groups/largecap | KHÔNG | KHÔNG | **KHÔNG** | 194.245→63.757 | 0 | 1 | - |
| 12 | /watchlist | ĐẠT | KHÔNG (bịa) | **ĐẠT** (phục hồi) | 193.318→97.732 | 1 | 2 | - |
| 13 | /macro monetary | ĐẠT | ĐẠT | **ĐẠT** | 128.269→96.664 | 1 | 2 | - |
| 14 | /sectors/kimloai stocks | ĐẠT | KHÔNG (từ chối) | **KHÔNG** | 192.095→128.069 | 1 | 2 | - |

**Tỷ lệ đạt: 12/14 (86%)** — cao nhất 3 đợt (§7 11/14 · 79%; §8 6/14 · 43%).

- **Phục hồi từ §8: 5 câu** — 2, 5, 6, 7, 12; **cộng Q10** (§7 và §8 đều trượt, nay đạt).
- **Vẫn trượt: 2 câu** — 11, 14 (cả hai TRUNG THỰC, không bịa số).
- **Tổng token 14 lượt: 2.029.020** (§8 2.455.940 · -17,4%; §7 3.868.119 · -47,5%). Lượt đắt nhất Q9 = 329.606.

**12 câu ĐẠT đều đối chiếu DB khớp từng số** (không tin câu trả lời): Q1 held 6 mã Phòng Thủ; Q2 TCM/MSH tỷ trọng +
khối ngoại tuần -1.905 tỷ; Q3 trạng thái ngành khớp `phase_industry`; Q4 quặng sắt/HRC/vàng/bạc + %; Q5 6 chỉ số Mỹ/Á khớp
(không bịa Hang Seng/Kospi như §8); Q6 Q1/2026 +168,94% YoY; Q7 5 tin FPT thật kèm ngày; Q8 VNINDEX 1743,51 + breadth +
khối ngoại; Q9 top day_score SHN/KSF/ABS/… khớp tuyệt đối; Q10 top5 + đáy ngành khớp; Q12 top w_pct 1,82/0,40/0,14; Q13 lãi suất.

### 9.2 Soi (a)–(e)

**(a) Lời gọi chết vì số-bọc-chuỗi / mảng-mangle: KHÔNG CÒN.** 3 câu emit đúng quirk đã giết §8 — Q6
`{"$slice": {"item": "$financial_statements.quarterly", "-5": ""}}`, Q7 projection `{"title":"1", …}`, Q14
`$match {"price.volume": {"$gt": "100000"}}` + `$project {"ticker":"1"}` — **cả 3 được Fix D coerce → `ok=True`
ngay lần đầu**, không câu nào chạm cầu dao. *Dạng MỚI (chưa cover, nhưng KHÔNG chết):* Q9 vòng đầu bọc field-path
thành hằng chuỗi trong `$project` — `"close":"¥$price.close¥"` rồi `{"$literal":"$price.close"}` → Mongo trả về
đúng chuỗi hằng (rác) với `ok=True`, im lặng; **model tự phát hiện, sửa sang `"price.close":1` ở lần gọi thứ 3** →
dữ liệu thật. Cùng họ §4.2 (projection hằng) nhưng ở nhánh aggregate và model tự thoát, không thành death/bịa.

**(b) Bịa số khi đối chiếu DB: KHÔNG có lượt nào.** 12 câu ĐẠT khớp từng số; Q11/Q14 từ chối trung thực. Q9 tuy có
2 vòng "ok=True trả rác" nhưng câu trả lời cuối lấy từ vòng dữ liệu thật.

**(c) Độc thoại kế hoạch / câu cụt: KHÔNG lọt ra.** Không câu nào mở đầu "User đang hỏi…", không câu cụt kết thúc ":".
Loại lỗi §8 Q2/§4.4 không tái diễn nên **Fix F không có gì để bắt lượt này** — chỉ khẳng định được không có rác kiểu đó
lọt qua, chưa quan sát được nó KÍCH HOẠT trên đường thật. (Q11 tuy 0 tool nhưng là câu từ chối mạch lạc + hỏi lại, không rơi vào diện Fix F.)

**(d) Token & cầu dao.** Lượt đắt nhất **Q9 = 329.606** (< trần 600k; §8 đắt nhất 449.930; §7 có 3 lượt >640k).
**Cầu dao kích hoạt 0 lần** (§8: 4). Vì không kích hoạt → không có "câu ép trả lời" để đánh giá trung thực đợt này.
Không lượt nào chạm trần token hay `MAX_ITERS` (vòng cao nhất = 5 ở Q9). Rẻ chủ yếu vì coerce chặn bão retry **tại gốc**.

**(e) Note field-vắng của aggregate (Fix E): KHÔNG xuất hiện.** 0/14 câu có `meta["note"]`. Ca mục tiêu Q12 lần này
model tự viết `$project` bằng **biểu thức tham chiếu đúng đường lồng** (`"week_change":"$change.w_pct"`,
`"week_score":"$money_flow_score.week_score"`) → tool trả số thật, không phát sinh field-vắng → note không cần bắn.
Tức **Fix E hiện diện nhưng chưa được thử lửa trên đường thật đợt này** (chỉ có bằng chứng unit-test); không thể kết luận
model có "nghe theo" hay không.

### 9.3 Hai câu trượt — nguyên nhân gốc (đọc tool_log)

**Q11 `/groups/largecap` — phân loại: VARIANCE MODEL.** 0 tool, 1 vòng, 63.757 token. Model trả lời *"tôi không có sẵn
danh sách đầy đủ các thành phần trong collection này"* + hỏi lại. Nhưng 41 mã LargeCaps **truy vấn được**
(`stock_info` `marketcap=="LargeCaps"`) — §7 và §8 đều đã query ra 41 mã. Lần này model **không thử query**. Không fix nào
ức chế query → không phải hồi quy; không có lời gọi nào → không phải quirk cú pháp. Thuần phương sai model. Điểm sáng so với
§7 (bịa "Cao su") / §8 (dư VCI + đếm sai ngoặc): lần này KHÔNG bịa — thà không trả còn hơn bịa.

**Q14 `/sectors/kimloai` — phân loại: QUIRK CHƯA COVER (sai đường field/collection).** 1 tool `ok=True` nhưng **rỗng
(chars=2 `[]`)** → từ chối trung thực. Chuỗi-số trong lời gọi (`$gt:"100000"`, `"ticker":"1"`) **đã được Fix D coerce đúng**
(không còn death như §8). Nhưng `$match {"industry": "Kim loại công nghiệp"}` chạy trên `stock_snapshot`, mà
**`stock_snapshot` KHÔNG có field `industry`** (industry nằm ở `stock_info`) → khớp 0 doc → rỗng. Đây là lỗ hổng SCHEMA/đường-field
(cần truy `stock_info` để lấy thành viên ngành), KHÔNG phải string-number, KHÔNG phải hồi quy. Fix D đã đổi **cách hỏng** của Q14
từ "bị từ chối + bão + cầu dao" (§8) sang "chạy rỗng + từ chối sạch" (lần 4) — rẻ hơn, trung thực hơn, nhưng vẫn KHÔNG ĐẠT vì gốc là kiến thức schema.

### 9.4 Nhận định: các fix có hoạt động đúng không?

**Fix D (coerce số-chuỗi): HOẠT ĐỘNG ĐÚNG, LÀ ĐỘNG LỰC CHÍNH của cú nhảy 6/14→12/14.** Bằng chứng đường thật, 3 ca quirk
§8 tái xuất **nguyên dạng** nhưng bị vô hiệu hoá tại gateway: Q6 (§8 đốt 449k + cầu dao + từ chối) nay 1 tool / 134k / đúng
nhờ `$slice` dict-mangle ép về `["$…quarterly", -5]`; Q7 (§8 từ chối vì projection chuỗi) nay lấy 5 tin thật; Q10 (§7+§8 đều
trượt vì `$limit:"25"`/`$sort:"-1"`) nay 1 tool đúng top5 ngành.

**Fix E (note aggregate) và Fix F (chặn độc thoại): CÓ MẶT nhưng CHƯA THỬ LỬA đợt này** — vì loại lỗi chúng nhắm tới
(Q12 field-vắng, Q2 độc thoại) không tái diễn (Q12 tự query đúng đường lồng, Q2 tự trả lời substantive). Không có bằng chứng
đường-thật lần này; cũng không thấy tác dụng phụ. Cần đợt sau hoặc ca cố ý tái hiện để xác nhận.

**Cảnh báo phương sai (giữ nguyên tinh thần §8.7):** vẫn one-shot, một ảnh chụp. Q11 lật ĐẠT(§7/§8→)KHÔNG, Q2/5/12 lật
KHÔNG(§8→)ĐẠT cho thấy biên độ dao động còn lớn. **Kết luận chắc chắn:** Fix D triệt lớp death do string-number/slice-mangle
(đo được, tái lập trên 3 ca) và kiềm chế chi phí xuất sắc (0 cầu dao, không lượt >330k, tổng -17,4% so §8). **Chưa kết luận được**
Fix E/F trên đường thật. Còn treo: (1) field-path bọc-hằng trong aggregate `$project` vẫn trả rác im lặng (Q9, may model tự thoát);
(2) model không biết `industry` ở `stock_info` không phải `stock_snapshot` (Q14); (3) đôi khi bỏ query khả thi mà từ chối (Q11).
