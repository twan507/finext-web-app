# 10 — Widget tham chiếu: chặn tận gốc việc AI bịa số

> ⚠ **TRẠNG THÁI ĐÃ ĐỔI (2026-07-20, cuối ngày): GÁC LẠI — ĐỪNG BẮT ĐẦU TỪ FILE NÀY.**
> Đo đạc sau đó cho thấy doc này **sai chỗ và sai thứ tự**. Nguyên nhân gốc của vụ bịa số HPG
> không phải thiếu cơ chế cưỡng chế mà là **kết quả tool bị cắt mất 5 kỳ mới nhất trước khi model
> nhìn thấy**. Đọc `docs/superpowers/specs/2026-07-20-cat-du-lieu-tool-design.md` — đặc biệt §2
> (vì sao guard chống bịa số là bất khả thi, có số đo) và §9 (vì sao widget sai chỗ: xuất hiện
> 0/14 lượt eval, 5,9% câu `/chat`, chỉ dùng 2/12 template). Sau khi sửa gốc, câu HPG đã ĐẠT.
> Quay lại doc này chỉ khi có số đo mới chứng minh còn vấn đề bịa số đáng kể.
>
> **Trạng thái cũ (đã lỗi thời):** ĐÃ CHỐT LÀM BẢN ĐẦY ĐỦ (owner, 2026-07-20). Chưa bắt đầu.
> **Nguồn phát hiện:** [`eval-smoke-2026-07-20.md`](eval-smoke-2026-07-20.md) — 14 lượt hỏi thật.

## 1. Vấn đề

Trong eval, hỏi về báo cáo tài chính HPG, agent trả về:

- lợi nhuận **+11,5%** (số thật **16,5%**)
- doanh thu **34.643 tỷ** — **không kỳ nào có số này** (thật 37.951 tỷ)
- biên ròng **9,2%** (thật 8,9%)
- lấy dữ liệu **Q1/2025** rồi khẳng định đó là kỳ mới nhất, trong khi DB có **Q1/2026**; sau đó tự mâu thuẫn nói Q4/2024 mới là mới nhất

Tool đã trả về đủ **9 kỳ**, không bị cắt. Model tự bịa.

Với sản phẩm phân tích chứng khoán, đây không phải lỗi kỹ thuật mà là **rủi ro niềm tin và trách nhiệm**: khách đọc số sai rồi ra quyết định mua bán.

## 2. Vì sao guard hiện tại không cứu được

Guard chống bịa số (`_ungrounded_data` trong `app/agent/loop.py`) đối chiếu mọi con số trong câu trả lời với số trích từ kết quả tool, kèm dung sai 2% và quy đổi nhân/chia 1000 (để tha cho *nghìn đồng ↔ đồng*).

Đã đo trực tiếp:

| Kết quả tool chứa | Guard |
|---|---|
| chỉ số thật (37.951) | ✅ bắt được |
| có thêm một số hai chữ số ~35 (vd P/E 35) | ❌ lọt |
| có 34,8 (vd biên lãi 34,8%) | ❌ lọt |

**Nguyên nhân gốc: guard mù hoàn toàn về ĐƠN VỊ.** `34.643 ÷ 1000 = 34,6`, nằm trong dung sai 2% của `35`. Với guard, *"doanh thu 34.643 tỷ"* và *"P/E 35"* là cùng một con số. Một kết quả tool tài chính thật luôn có hàng chục số (P/E, P/B, biên lãi, tăng trưởng…) nên gần như **luôn có sẵn một số hai chữ số** để con số bịa bám vào.

**Siết dung sai không phải lời giải:** siết lại thì phá đúng công dụng gốc — giá ghi "34,6 nghìn" và tool trả "34600 đồng" sẽ bị báo bịa oan, tức chặn nhầm câu trả lời đúng. Đổi một lỗi âm thầm lấy một lỗi ồn ào hơn.

Và kể cả guard số hoàn hảo cũng **không bắt được phần nguy hiểm nhất**: lấy Q1/2025 rồi gọi là kỳ mới nhất. Đó là lỗi *diễn giải*, không phải lỗi *con số*.

## 3. Vì sao widget hiện tại cũng không cứu được

Cơ chế `finext-widget` hiện có **không giảm rủi ro bịa số**, vì model tự gõ số vào JSON:

```finext-widget
{"template":"line","x":["2021","2022"],"series":[{"name":"P/E","data":[17.4,10.5]}]}
```

Luật trong system prompt chỉ là câu nhắc *"số trong khuôn là số thật từ dữ liệu, không bịa"* — một lời khẩn cầu, không phải cơ chế cưỡng chế.

**Nguy hiểm hơn:** biểu đồ trông đáng tin hơn câu chữ, nên cùng một con số bịa, hiển thị dạng biểu đồ sẽ được khách tin nhiều hơn.

## 4. Hướng giải quyết đã chốt

**Nguyên tắc: model KHÔNG BAO GIỜ gõ lại con số. Model chọn *hiện cái gì*, hệ thống điền *giá trị bao nhiêu*.**

Đây là cách các sản phẩm tài chính nghiêm túc làm, và là cách duy nhất diệt tận gốc thay vì giảm xác suất.

## 5. Các phần việc

### 5.1 Đổi widget từ "điền số" sang "khai tham chiếu"

Model khai nguồn dữ liệu, không khai giá trị:

```finext-widget
{"template":"line","source":{"ticker":"HPG","field":"pe","periods":20}}
```

### 5.2 Bộ resolve ở backend (module mới)

Bóc khối widget khỏi câu trả lời → thẩm định tham chiếu → truy vấn → điền số → chèn lại trước khi gửi xuống giao diện.

⚠️ **Bắt buộc thẩm định qua ĐÚNG validator/policy của tool** (`app/agent/gateway/validator.py`). Mở một đường truy vấn riêng cho widget là tạo lỗ rò dữ liệu — mọi luật cấm collection/field/operator phải áp y hệt.

Tham chiếu sai → bỏ widget + ghi chú nội bộ để model sửa ở vòng sau (giống cơ chế `note` sẵn có trong `tools/registry.py`).

### 5.3 Viết lại phần dạy model

Mục 3b của `kb/system_prompt.md` và toàn bộ tài liệu template `kb/agent_db_07.md` (12+ template) phải đổi từ "khuôn để điền số" sang "khuôn để khai tham chiếu". Đây là phần tốn công âm thầm và dễ bị đánh giá thấp.

### 5.4 Xử lý số trong văn xuôi

Widget chỉ trị được biểu đồ. Model vẫn viết "lợi nhuận tăng 16,5%" trong câu chữ. Hai lựa chọn (chốt khi viết spec):

- **Cấm số tài chính trong văn xuôi**, chỉ cho nằm trong widget — dễ cưỡng chế, nhưng câu trả lời khô hơn.
- **Guard mới đối chiếu số văn xuôi với dữ liệu ĐÃ RESOLVE** — cách này giờ mới thật sự chạy được, vì tập số nhỏ và có đơn vị rõ ràng, đúng hai thứ mà guard hiện tại thiếu.

### 5.5 Giao diện

`WidgetRenderer.tsx` nhiều khả năng đổi rất ít, nếu dữ liệu sau khi resolve giữ đúng hình dạng hiện tại.

### 5.6 Chạy lại eval thật

Lặp lại bộ 14 câu trong `eval-smoke-2026-07-20.md`, đặc biệt câu tài chính HPG đã sai, để xác nhận.

## 6. Quy mô

**Đây là một dự án con, cỡ ngang tính năng chat bubble** — cần spec riêng, nhiều task, một vòng eval. Không phải bản vá.

Owner đã cân nhắc bản rút gọn (chỉ áp cho số liệu báo cáo tài chính) và **chọn làm bản đầy đủ**, lý do: đằng nào cũng phải đụng vào cùng một chỗ, làm một lần cho dứt.

## 7. Việc liên quan còn tồn (từ cùng vòng eval)

| Mức | Việc |
|---|---|
| ~~Chặn cửa~~ | ~~Projection chuỗi trả dữ liệu giả âm thầm~~ — **ĐÃ SỬA** 2026-07-20, xem `_check_projection_values` trong `gateway/validator.py` |
| Nên sửa | Câu trả lời cụt lọt tới khách (một dòng kết thúc bằng dấu hai chấm, 0 tool, `_needs_retry()` trả False) |
| Nên sửa | Lạc đề ở trang quốc tế (0 tool, trả lời về VNINDEX dù có sẵn S&P 500 / Nikkei) |
| Nhỏ | Nhãn `[NGỮ CẢNH TRANG…]` bị chèn TRÙNG hai lần — frontend `chatPageContext.ts` thêm một lần, backend `routers/chat.py` thêm lần nữa. Phí ~90 token mỗi lượt |
| Đã biết, owner chốt không đuổi theo | Lộ thuật ngữ nội bộ ra câu trả lời (7/14 lượt): "điểm dòng tiền tuần", "NN/TD", "LSLNH" |
