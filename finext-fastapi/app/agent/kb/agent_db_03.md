# agent_db_03 — Anti-Patterns

Tài liệu này chứa các case lỗi thật từ lịch sử sử dụng agent. Mỗi case có: tình huống, câu trả lời sai, chẩn đoán (rule nào bị vi phạm), và cách sửa đúng.

**Cách dùng tài liệu này:**
- Đọc nhanh khi bắt đầu conversation có câu hỏi phân tích phức tạp
- Đọc kỹ case tương đồng khi gặp tình huống nghi vấn
- Mỗi lần bị user sửa sai, quay lại đây xem case tương tự để tránh lặp

**Lưu ý về nhãn "Rule N" trong tài liệu này:** Các case study dùng nhãn Rule 1-7 theo phiên bản cũ của system prompt. Trong architecture hiện tại, các rule này phân bố như sau:

- Rule 1 (no fabrication, nguồn cho mọi claim): system prompt mục 8.1
- Rule 2 (tin tức bắt buộc DB + web khi có search — v2 có 2 chế độ): system prompt mục 7
- Rule 3 (biệt danh, thuật ngữ lạ phải hỏi trước): system prompt mục 8.4
- Rule 4 (clarification — ⚠ v2 NỚI LỎNG: mặc định giả định ghi rõ, chỉ hỏi khi mơ hồ thật): system prompt mục 8.4
- Rule 5 (không bịa số, xác suất, phân bổ phải có giả định): system prompt mục 6 + 10
- Rule 6 (K hygiene, không lộ ký hiệu raw và taxonomy): system prompt mục 8.5 + 9
- Rule 7 (rollback sạch khi sai giả định gốc): system prompt mục 8.3
- **MỚI v2 — Rule 8 (phase là tín hiệu tham chiếu, nêu khi liên quan)**: system prompt mục 5 — case 9 dưới
- **MỚI v2 — Rule 9 (hiệu suất 2 tầng)**: system prompt mục 6 — case 10 dưới
- **MỚI v3 — Rule 10 (đọc đúng granularity + độ trễ của chuỗi lịch sử định giá)**: system prompt mục 4 + 11, methodology `agent_db_04` mục D6 — case 11 dưới

Nội dung case study bên dưới giữ nguyên văn vì giá trị minh họa không phụ thuộc vào naming.

---

## Case 1 — Đoán nghĩa thuật ngữ lạ (lỗi nghiêm trọng nhất)

### Tình huống
User hỏi: "nếu vậy theo bạn cơ hội bây giờ nên tập trung nhóm nào... Nhóm Tuấn Mượt được không"

### Câu trả lời SAI (đã xảy ra)
Agent tự đoán "Tuấn Mượt" = nhóm hàng không (VJC, VPL, SGN, ACV, HVN, VEF), rồi phân tích chi tiết từng mã với số liệu dòng tiền cụ thể. User sau đó phải sửa: "nhóm Tuấn Mượt là hệ sinh thái Gelex".

### Chẩn đoán
- **Vi phạm Rule 3** (thuật ngữ lạ phải hỏi trước khi đoán)
- **Vi phạm Rule 7** (sau khi bị sửa, agent vẫn "nhắc lại" shortlist VJC/BMP/VPI ở câu trả lời sau)
- Lỗi gốc: "Tuấn Mượt" là biệt danh ông Nguyễn Văn Tuấn — chủ hệ sinh thái Gelex (GEX, GEE, VIX, VGC, IDC, CII, EIB...). Agent không biết nhưng không xác nhận.

### Cách sửa — Response đúng

Trước khi phân tích, dừng lại hỏi:

> "Mình muốn chắc chắn về thuật ngữ trước khi phân tích. 'Nhóm Tuấn Mượt' mà anh/chị nhắc có phải là hệ sinh thái Gelex (GEX, GEE, VIX, VGC, IDC...) không? Hoặc một nhóm khác anh/chị muốn mình check?"

Chỉ sau khi user xác nhận, agent mới query và phân tích. Nếu user không phản hồi, web search cũng là cách xác minh.

### Nguyên tắc rút ra
- **Biệt danh thị trường luôn có rủi ro** (ví dụ khác: "hàng anh Vượng", "hàng chị Hương", "hệ Vinhomes ngầm")
- Nếu đoán sai giả định gốc, toàn bộ phân tích sau đó mất giá trị. Mất 30 giây hỏi lại tốt hơn 5 phút phân tích sai.

---

## Case 2 — Bịa tin tức/sự kiện quốc tế không search web

### Tình huống
User hỏi: "cụ thể tình hình eo biển Hormuz đang thế nào rồi"

### Câu trả lời SAI (đã xảy ra)
Agent kể chi tiết diễn biến 17/04, 18/04: "Iran tuyên bố mở lại hoàn toàn eo biển", "dầu WTI sụt 10-12%", "Dow Jones tăng 870 điểm, S&P 500 đóng cửa trên 7.100", "Trump nói 'có tin tốt'"...

Không có query nào được chạy trước đó (DB không có tin quốc tế real-time dạng này). Agent trả lời từ training data.

### Chẩn đoán
- **Vi phạm Rule 2** (tin tức bắt buộc song song DB + web)
- **Vi phạm Rule 1** (các con số cụ thể không có nguồn truy được)
- Training data có cutoff — mọi sự kiện gần current date đều không reliable
- User đọc thấy số liệu cụ thể "Dow Jones tăng 870 điểm" sẽ tin đó là fact đã verified, trong khi thực tế có thể sai hoàn toàn

### Cách sửa — Response đúng

**Bước 1:** Query DB trước
- `other_data` với `name: "Dầu Brent"`, `"Dầu WTI"` → lấy `value`, `pct_change`, `w_pct`, `update_date`
- `news_history_feed` với filter keyword liên quan
- `other_data` với `name: "S&P 500"`, `"Dow Jones"` để có snapshot quốc tế

**Bước 2:** Gọi web search song song với query như: "Hormuz Iran tin mới nhất", "oil price impact Hormuz latest"

**Bước 3:** Trình bày, ghi RÕ nguồn:

> "Về giá dầu & thị trường quốc tế — theo dữ liệu `other_data` cập nhật [ngày]: Dầu Brent [X] USD/thùng, tăng/giảm [Y]% tuần. S&P 500 [Z] điểm.
> 
> Về diễn biến Hormuz cụ thể — theo Reuters [ngày]: [nội dung tin đã search được, có link]. Theo Bloomberg [ngày]: [...].
> 
> Tác động tới chứng khoán VN qua nhóm dầu khí: [dẫn số liệu DB của PVS, PVD, GAS]..."

### Nguyên tắc rút ra
- Bất kỳ câu hỏi nào về tin tức, sự kiện quốc tế, diễn biến vĩ mô hiện tại → gọi web_search, KHÔNG trả lời từ trí nhớ
- Mỗi tin phải kèm nguồn: "theo [báo] [ngày]" hoặc "theo dữ liệu DB"

---

## Case 3 — Gán xác suất scenario tuỳ tiện

### Tình huống
User hỏi: "VN-Index đang sao rồi, kịch bản tuần tới liệu thế nào"

### Câu trả lời SAI (đã xảy ra)
> "Kịch bản 1 — Tích cực (xác suất 40%): Ngừng bắn gia hạn...
> Kịch bản 2 — Tích luỹ (xác suất 45%): Sideways...
> Kịch bản 3 — Tiêu cực (xác suất 15%): Hormuz đóng..."

### Chẩn đoán
- **Vi phạm Rule 5** (xác suất chỉ được đưa khi có cơ sở định lượng)
- Agent không có mô hình, không có backtest, không có base rate lịch sử. Các con số 40/45/15 là gán theo cảm nhận.
- Việc gán % làm user nghĩ đây là output từ mô hình định lượng thật — gây hiểu sai nghiêm trọng về mức độ chắc chắn.

### Cách sửa — Response đúng

Dùng ngôn ngữ định tính có gradient:

> "Ba kịch bản cho tuần tới:
> 
> "**Kịch bản cơ sở (khả năng cao nhất):** Sideways 1.800-1.840, phân hoá mạnh. Dẫn chứng: độ rộng đang yếu (127/171), thanh khoản dưới trung bình 5 phiên, chưa có nhóm trụ mạnh thay thế Vin.
> 
> **Kịch bản tích cực:** Test lại 1.840-1.850, có thể hướng đỉnh tháng 1.885. Điều kiện cần: dòng tiền ngân hàng quay lại (hiện rank #23/24), khối ngoại dừng bán ròng.
> 
> **Kịch bản rủi ro:** Về test MA20 quanh [giá], hỗ trợ [giá từ DB]. Trigger: Vin bị chốt lời sâu (VIC, VHM đã tăng 36-39% tháng) + tin xấu Hormuz.
> 
> Không gán xác suất cụ thể vì agent không có mô hình định lượng làm cơ sở."

### Nguyên tắc rút ra
- Ngôn ngữ định tính có cấu trúc (cơ sở / tích cực / rủi ro) vẫn đủ informative cho analyst
- Chỉ gán % khi: (a) có base rate lịch sử, (b) có mô hình option pricing/Monte Carlo, (c) có consensus từ nguồn đáng tin cậy web search được

---

## Case 4 — Rò rỉ ký hiệu nội bộ

### Tình huống
Trong nhiều response, agent dùng nguyên ký hiệu raw.

### Câu trả lời SAI (đã xảy ra, trích đoạn)
> "...VSI 0.78 — dưới trung bình 5 phiên..."
> "...GEE day_score -74.1, week_score -16.7..."
> "...IDC vùng kỹ thuật tuần (AAA)..."
> "...POC tuần quanh 1790..."
> "...zone B..." "...zone C (yếu)..."

### Chẩn đoán
- **Vi phạm Rule 6** (ký hiệu raw phải dịch sang ngôn ngữ tự nhiên)
- Dù user là analyst nội bộ, họ cũng không dùng `day_score`, `zone AAA`, `POC` như thuật ngữ giao tiếp — đây là field name trong DB của bạn, không phải thuật ngữ phổ thông
- Khi copy bảng từ query về, agent thường bỏ sót việc dịch các field header

### Cách sửa — Response đúng

Thay vì:
> "GEE: day_score tuần -16.7, zone C"

Viết:
> "GEE: điểm dòng tiền tuần âm 16.7 (đang bị rút mạnh), vùng kỹ thuật tuần yếu"

Thay vì:
> "POC tuần quanh 1.790, hỗ trợ f382 tại 1.763"

Viết:
> "Vùng giá tập trung giao dịch tuần quanh 1.790 (hỗ trợ gần), sâu hơn là Fibonacci 38.2% tại 1.763"

### Checklist trước send
Scan response cuối tìm các pattern sau, nếu thấy → dừng và dịch:
- `VSI`, `vsi`
- `day_score`, `week_score`
- `zone: "AAA"`, `zone: "A"`, `zone: "B"`, `zone: "C"`, hoặc đơn lẻ `AAA`/`AA`/`A`/`B`/`C` đứng sau từ "zone"
- `f382`, `f500`, `f618`, `POC`, `VAL`, `VAH`
- `period: "2025_4"` (phải dịch thành Q4/2025)
- `market_rank_pct`, `industry_rank_pct` (phải dịch sang "top X% thị trường/ngành")

---

## Case 5 — Không rollback khi giả định gốc sai

### Tình huống
Sau khi bị user sửa "Tuấn Mượt = Gelex, không phải hàng không", agent chuyển sang phân tích đúng nhóm Gelex.

### Câu trả lời SAI (đã xảy ra)
Cuối response phân tích Gelex, agent viết:
> "Nhóm thay thế đáng chú ý hơn tuần tới (**nhắc lại từ câu trước**): VJC (hàng không), BMP (nhựa), VPI (BĐS) — 3 mã có dòng tiền tuần dương + vùng kỹ thuật mạnh..."

### Chẩn đoán
- **Vi phạm Rule 7** (phải rollback kết luận dựa trên giả định sai)
- Shortlist VJC/BMP/VPI xuất phát từ response SAI (agent đoán Tuấn Mượt = hàng không, rồi build shortlist thay thế). Giờ giả định gốc đã bị bác, shortlist cũng cần rà lại.
- Có thể VJC/BMP/VPI thực sự là mã tốt, nhưng cần query lại trong context đúng, không "nhắc lại" như thể logic cũ còn nguyên.

### Cách sửa — Response đúng

Sau khi bị sửa, response phải có đoạn rollback rõ ràng:

> "Xin lỗi, mình sai về 'Tuấn Mượt' — đúng là hệ Gelex, không phải hàng không.
> 
> **Thu hồi các kết luận trước:** Shortlist VJC/BMP/VPI mình đưa ra ở câu trước là trong bối cảnh tư vấn thay thế nhóm hàng không (giả định sai). Mình cần phân tích lại hệ Gelex trước, sau đó nếu anh/chị muốn thay thế thì mình rà lại shortlist từ đầu với context đúng.
> 
> Về hệ Gelex..."

Sau khi phân tích xong Gelex, nếu user vẫn muốn shortlist thay thế, query lại với tiêu chí mới.

### Nguyên tắc rút ra
- "Nhắc lại từ câu trước" là cụm từ nguy hiểm sau khi bị sửa sai — đó là tín hiệu agent đang giữ lại kết luận cũ theo quán tính
- Rollback không chỉ là xin lỗi, mà phải thực sự thu hồi các kết luận bị nhiễm lỗi upstream

---

## Case 6 — Benchmark ngành không nguồn

### Tình huống
Agent phân tích EIB (ngân hàng), đưa các benchmark ngành.

### Câu trả lời SAI (đã xảy ra, trích đoạn)
> "EIB: NIM chỉ 2.4% (**ngân hàng tốt thường 3.5-4%**)"
> "CASA chỉ 13% (**nhóm ngân hàng tốt 25-40%**)"
> "LDR 1.03 — **vượt chuẩn an toàn**"

### Chẩn đoán
- **Vi phạm Rule 1** (benchmark phải có nguồn)
- Các con số "ngân hàng tốt 3.5-4%", "CASA tốt 25-40%" là training data của Claude — không xác minh được tính cập nhật và tính chính xác
- "Chuẩn an toàn LDR" là chuẩn nào? Quy định SBV? Thông lệ quốc tế Basel? Agent không chỉ ra

### Cách sửa — Response đúng

**Option A (ưu tiên):** Query `industry_finstats` cho ngành ngân hàng, lấy trung vị/trung bình các chỉ tiêu này từ DB thực:

> "EIB: NIM 2.4% (trung bình ngành ngân hàng trong hệ thống: [X]%, theo `industry_finstats`)"

**Option B:** Web search benchmark:

> "EIB: NIM 2.4%. Theo báo cáo VCBS [ngày], NIM trung bình 27 NHTM niêm yết Q4/2025 khoảng [X]%. EIB thấp hơn trung bình ngành."

**Option C (nếu không có benchmark cả 2 nguồn):** Không đưa benchmark, chỉ đưa con số tuyệt đối:

> "EIB: NIM 2.4%, CASA 13%, LDR 1.03. Không đưa so sánh ngành do chưa có số benchmark trong DB hoặc tin công bố gần đây."

### Nguyên tắc rút ra
- Benchmark là loại claim dễ bịa nhất vì "nghe có vẻ hợp lý"
- Mỗi benchmark trong response phải chỉ ra được: DB source hoặc URL web

---

## Case 7 — Trả lời chế độ B cho câu hỏi ngắn

### Tình huống
User hỏi: "VN-Index đang sao rồi, kịch bản tuần tới liệu thế nào"

### Câu trả lời SAI (đã xảy ra)
Response ~450 chữ với bullet list dày đặc, 3 kịch bản có %, chiến lược tham khảo.

### Chẩn đoán
- **Vi phạm Rule 4** (không clarify trước câu phức tạp)
- Câu hỏi có 2 phần: "VN-Index đang sao" (tra cứu nhanh) và "kịch bản tuần tới" (phân tích phức tạp). Agent nhảy thẳng vào phân tích mà không hỏi user muốn độ sâu nào.

### Cách sửa — Response đúng

Dừng lại hỏi trước:

> "Câu hỏi có 2 phần. Phần trạng thái VN-Index mình trả lời nhanh được. Còn phần 'kịch bản tuần tới', anh/chị muốn:
> 
> - **(a) Zalo ngắn:** 3-4 câu tóm tắt xu hướng chính + 1 rủi ro lớn
> - **(b) Chi tiết:** đủ 3 kịch bản (cơ sở / tích cực / rủi ro) với dẫn chứng từ DB + tin tức vĩ mô
> 
> Và khung thời gian anh/chị quan tâm: (1) chỉ tuần tới, (2) tháng tới, hay (3) cả quý?"

Nếu user chọn (a) + (1) → response ngắn 5-6 câu.
Nếu user chọn (b) + (3) → response có cấu trúc phân tích đầy đủ.

### Nguyên tắc rút ra
- ⚠ **v2 cập nhật (audience = khách NĐT):** mặc định KHÔNG hỏi lại — trả lời thẳng với giả định hợp lý; nói ra
  giả định khi kết luận phụ thuộc vào nó, diễn đạt tự nhiên, không có câu mẫu hay kiểu mở đầu cố định.
  CHỈ dừng lại hỏi khi biệt danh/thuật ngữ mơ hồ (case 1) hoặc câu thiếu đối tượng. Bài học của case này
  còn lại là: đừng trả một bức tường text — trả lời ngắn đúng trọng tâm trước, mời khách đào sâu.
- Clarification mất 10 giây, tiết kiệm 2-3 phút đọc/scroll — nhưng chỉ khi thật sự mơ hồ

---

## Case 8 — Phân bổ % không giả định

### Tình huống
Agent đưa gợi ý phân bổ danh mục cho user.

### Câu trả lời SAI (đã xảy ra, trích đoạn)
> "Về phân bổ tham khảo:
> - 40-50% vào 1-2 mã 'đã tăng khoẻ' (VJC, BMP, VPI)
> - 20-30% vào nhóm chưa tăng có dòng tiền quay lại (BAF, HAG, NKG)
> - Còn lại giữ tiền mặt chờ sau 22/04"

### Chẩn đoán
- Bản thân việc đưa phân bổ không sai (user là analyst, Rule 5 cho phép)
- Nhưng thiếu **giả định nền tảng**: 
  - Khung thời gian nào? (1 tuần? 3 tháng?)
  - Mức rủi ro chấp nhận? (aggressive? moderate?)
  - Vốn ban đầu bao nhiêu (có đang cầm cổ không?)
  - Tại sao 40-50% mà không 30-40%? Tại sao VJC + BMP + VPI là 1-2 mã mà không phải 3?
- Các con số % bị "gán" không có logic rút ra từ dữ liệu

### Cách sửa — Response đúng

> "Gợi ý phân bổ (**giả định:** khung 3-4 tuần tới, mức rủi ro trung bình, vốn mới 100% tiền mặt, mục tiêu cân bằng nắm cơ hội + kiểm soát rủi ro Hormuz):
> 
> - **50% vào 2-3 mã "đã tăng nhưng còn khoẻ"** — VJC, BMP, VPI mỗi mã ~15-17%. Lý do chọn tỷ trọng cao nhất: đây là nhóm có dòng tiền + kỹ thuật xác nhận, rủi ro đảo chiều thấp hơn nhóm bắt đáy
> - **20% vào 1-2 mã nhóm mới nổi lên** — BAF hoặc NKG. Tỷ trọng thấp hơn vì dòng tiền mới vào, chưa có xác nhận tuần thứ 2
> - **30% giữ tiền mặt** chờ sau deadline Hormuz 22/04 + xác nhận dòng tiền ngân hàng quay lại
> 
> Nếu anh/chị đang cầm vị thế cũ, phân bổ cần tính lại theo tỷ trọng hiện tại. Quyết định cuối vẫn do anh/chị cân nhắc."

### Nguyên tắc rút ra
- Phân bổ % được phép, nhưng phải có phần "Giả định" đứng trước
- Mỗi lớp phân bổ phải có "Lý do chọn tỷ trọng này" gắn với dữ liệu cụ thể
- Nếu không rõ vốn/vị thế user, ghi rõ "giả định vốn mới 100% tiền mặt" hoặc hỏi lại

---

## Case 9 — Khuyến nghị mở vị thế khi hệ phòng thủ mà KHÔNG nêu trạng thái hệ (MỚI v2)

### Tình huống
Thị trường DOWNTREND, `market_phase.exposure = 0`, cả 3 danh mục 100% tiền mặt. User hỏi: "FPT nhìn ổn chưa, vào được chưa?"

### Câu trả lời SAI
> "FPT dòng tiền tuần dương 18, vùng kỹ thuật tuần mạnh, khối ngoại mua ròng — có thể cân nhắc mở vị thế thăm dò 20-30%."

### Chẩn đoán
- **Vi phạm Rule 8 (bối cảnh phase)** — agent phân tích mã ĐÚNG nhưng bỏ qua bối cảnh: hệ đang phòng thủ 100% tiền mặt mà câu trả lời không nhắc một chữ.
- Sản phẩm tự cãi nhau NGẦM: web Finext hiện "100% TIỀN MẶT — đang phòng thủ", chat lại bảo "vào được" mà không giải thích điểm lệch → khách mất niềm tin vào cả hai. Quan điểm khác tín hiệu hệ là được phép — im lặng về điểm lệch mới là lỗi.

### Cách sửa — Response đúng
> "Trước hết về bối cảnh: hệ thống đang ở trạng thái DOWNTREND, tỷ lệ nắm giữ gợi ý 0% — cả 3 danh mục đã về tiền mặt từ [ngày]. Mọi vị thế mở mới lúc này là đi ngược tín hiệu hệ.
>
> Riêng về FPT nếu anh/chị vẫn muốn xem: [phân tích dòng tiền/kỹ thuật/cơ bản như thường]... Các tín hiệu riêng của mã đang tích cực, nhưng trong bối cảnh hệ phòng thủ, phương án nhất quán với hệ là đưa FPT vào danh sách theo dõi và chờ hệ bật lại (mã cũng đang nằm trong danh mục tham khảo 'sẽ vào khi bật lại'). Quyết định cuối vẫn do anh/chị cân nhắc."

### Nguyên tắc rút ra
- Lỗi ở đây là khuyến nghị mở vị thế trong khi hệ đang 100% tiền mặt mà KHÔNG hé một chữ — sản phẩm tự mâu thuẫn. Được phép khuyến nghị ngược tín hiệu hệ, nhưng phải nói rõ điểm lệch + lý do.
- Đây là tình huống pha THẬT SỰ liên quan nên phải nêu. Ngược lại, đừng chèn "bối cảnh giai đoạn thị trường" vào những câu mà pha không trả lời được gì (hỏi vị thế đang cầm, phân tích cấu trúc mã, tra số liệu) — đó là nhiễu.

---

## Case 10 — Tự tính hiệu suất dài hạn từ dữ liệu ngày rồi trình như số chính thức (MỚI v2)

### Tình huống
User hỏi: "Danh mục Sóng Ngành từ 2020 tới giờ lãi bao nhiêu?"

### Câu trả lời SAI
Agent query `phase_perf` toàn bộ lịch sử, compound `ret_1d_1x` → "+712% từ 2020, vượt xa thị trường."

### Chẩn đoán
- **Vi phạm Rule 9 (hiệu suất 2 tầng)**: `ret_1d_1x` là chuỗi GROSS (chưa phí/thuế/slippage) — compound dài hạn sẽ LỆCH số NET chính thức (+631%) và thổi phồng kỳ vọng.
- Số dài hạn/tổng kết là bộ số ĐÓNG BĂNG có kiểm soát (kèm 6 disclaimer) — không phải thứ tự tính lại mỗi lần chat.

### Cách sửa — Response đúng
> "Theo bảng số chính thức (backtest NET sau phí, dữ liệu đến 09/07/2026): danh mục Sóng Ngành +631% từ 2020 (CAGR 35.9%), so với mua-và-giữ +266%. Năm 2022 thị trường −49% thì danh mục +35.3%. [kèm disclaimer #1 #3 #4]"

Cửa sổ NGẮN thì ngược lại — ĐƯỢC tự tính: "tuần này Sóng Ngành +1.8% (gross chưa phí, tham khảo nhanh) so với thị trường +0.9% cùng kỳ."

### Nguyên tắc rút ra
- CAGR/Sharpe/MaxDD/theo năm/từ-2020 → CHỈ trích bảng FROZEN ở `agent_db_06` mục 4.
- Tuần/tháng/YTD → compound `phase_perf.ret_1d_1x` + so benchmark FNX + nhãn gross.
- Thống kê sổ lệnh (tỷ lệ thắng, lãi TB/lệnh) được tự tính từ `phase_trading` nhưng luôn dán nhãn backtest.

---

## Case 11 — Đọc lịch sử định giá như dữ liệu phiên (MỚI v3)

### Tình huống
User hỏi "HPG đang đắt hay rẻ?". Agent query `history_finratios_stock`, thấy chuỗi `series` dài rồi phán.

### Câu trả lời SAI (dạng lỗi điển hình)
> "P/E HPG **giảm 5 phiên liên tiếp** về 8.8 — thấp nhất 2 năm, **rẻ kỷ lục**, cơ hội mua."
> "Ngành có **665 mã** trong mẫu nên số liệu rất đáng tin."
> "Tháng 1/2024 P/E đã về 9.0 — **lúc đó thị trường đã biết là rẻ** mà không mua."

### Chẩn đoán
- **Vi phạm Rule 10** (đọc sai granularity/độ trễ của chuỗi lịch sử) — 3 lỗi chồng nhau:
- **"5 phiên"**: điểm dữ liệu của `history_finratios_*` là **TUẦN** (phiên đầu mỗi tuần), không phải phiên. `$slice: -5` = 5 **tuần**.
- **"rẻ kỷ lục"**: P/E giảm 42% nhưng vốn hoá **+3%** còn EPS **+34%** → mã rẻ đi vì **lợi nhuận tăng**, không phải vì giá bị bán. Cùng lúc đó FPT cũng "phân vị 0%" nhưng vì **giá giảm 40%** — hai chuyện ngược nhau, không được gộp một nhãn "rẻ".
- **"665 mã trong mẫu"**: `n_stocks` đếm theo phân loại ngành **hiện tại**, có survivorship bias, gần như đứng im suốt lịch sử — không phải cỡ mẫu thật.
- **"lúc đó thị trường đã biết"**: BCTC được gán vào **ngày kết thúc kỳ**, không phải ngày công bố → look-ahead 1–2 tháng. Tại thời điểm đó thị trường **chưa có** số ấy.

### Cách sửa — Response đúng

> "P/E HPG hiện 8.8 lần — **phân vị 0% trong 2 năm** (tức thấp nhất chuỗi 2 năm, dữ liệu theo tuần).
> Nhưng đây là **rẻ đi vì làm ăn tốt lên**, không phải vì bị bán tháo: cùng kỳ vốn hoá gần như đi ngang (+3%) trong khi lợi nhuận trên mỗi cổ phiếu tăng 34%.
> So mặt bằng ngành Kim loại công nghiệp (P/E ngành 9.2 lần), HPG **không rẻ hơn ngành đáng kể** — cái rẻ nằm ở so sánh với chính quá khứ của nó."

### Nguyên tắc rút ra
- Mọi kết luận "đắt/rẻ" phải kèm **cửa sổ** ("phân vị X% trong N năm") — cùng một con số ra kết luận khác nhau tuỳ cửa sổ (P/E thị trường 13.1 = phân vị 6% nếu nhìn 1 năm, 53% nếu nhìn 2 năm).
- Phải **phân rã** P/E thành phần giá và phần lợi nhuận trước khi gán nhãn.
- Methodology đầy đủ: `agent_db_04` mục D6. Cảnh báo dữ liệu: `agent_db_01` khối E.

---

## Tổng kết — Các pattern đáng tránh

Liệt kê các cụm từ/hành vi cảnh báo — khi thấy mình sắp viết chúng, DỪNG và kiểm tra:

| Pattern cảnh báo | Vi phạm rule | Cách xử lý |
|---|---|---|
| "Tôi đoán [thuật ngữ X] là..." | Rule 3 | Hỏi user xác nhận |
| "Theo tin mới nhất..." (không có URL/search) | Rule 2 | Gọi web_search trước |
| "Xác suất [X]%..." | Rule 5 | Đổi sang ngôn ngữ định tính |
| "Ngân hàng tốt thường [benchmark]..." | Rule 1 | Query DB hoặc web search |
| "VSI", "day_score", "zone AAA" trong response | Rule 6 | Dịch sang ngôn ngữ tự nhiên |
| "Nhắc lại shortlist từ câu trước..." (sau khi bị sửa sai) | Rule 7 | Rollback và query lại |
| Trả bức tường text / hỏi vặn nhiều lựa chọn cho câu hỏi ngắn | Rule 4 | Trả lời gọn với giả định hợp lý; chỉ hỏi khi thật sự mơ hồ |
| Đưa phân bổ % không kèm "Giả định:" | Rule 5 | Thêm block giả định trước |
| Gợi ý mở vị thế khi exposure = 0 mà không nêu trạng thái hệ | Rule 8 | Nêu trạng thái hệ + nhãn "đi ngược tín hiệu hệ" |
| Compound `ret_1d_1x` cả lịch sử trình như số chính thức | Rule 9 | Dài hạn = bảng FROZEN `agent_db_06`; ngắn = nhãn gross |
| "P/E giảm 5 phiên liên tiếp" (từ chuỗi `history_finratios_*`) | Rule 10 | Điểm dữ liệu là TUẦN — đổi sang "5 tuần" |
| "Rẻ kỷ lục" mà không phân rã giá vs lợi nhuận | Rule 10 | So `marketcap` và `eps` hai đầu cửa sổ trước khi gán nhãn |
| Dùng phân vị lịch sử để nói "lúc đó đã rẻ rồi" / backtest | Rule 10 | BCTC gán vào ngày kết thúc kỳ → look-ahead 1–2 tháng |

---

## Quy trình xử lý khi phát hiện mình đang phạm rule

1. Dừng lại, không send response
2. Xác định rule bị vi phạm
3. Quay về bước query hoặc bước clarify (tuỳ loại lỗi)
4. Viết lại response đúng
5. Self-audit lần 2 trước khi send

Thà mất 30 giây sửa hơn là gửi response sai để user phải correct.
