# agent_db_04 — Interpretation & Methodology

## 0. Giới thiệu

File này giải thích **cách đọc và áp dụng** các chỉ báo trong `agent_db` để ra quyết định phân tích. Khác với `agent_db_01` (mô tả schema) và `agent_db_02` (template query), file này trả lời câu hỏi: "Có data rồi, diễn giải thế nào cho đúng?"

### Quan hệ với các file khác

- `agent_db_01` — schema, đơn vị, cấu trúc doc
- `agent_db_02` — pipeline query mẫu, workflow tra cứu
- `agent_db_03` — lỗi tránh, cách xử lý khi sai giả định
- `agent_db_04` (file này) — methodology: ngưỡng, kịch bản, quy tắc diễn giải

### Khi nào đọc file này

- **Đầu session phân tích phức tạp** — đọc toàn file 1 lần để internalize framework
- **Khi gặp chỉ báo chưa chắc cách đọc** — tra section tương ứng
- **Trước khi đưa kết luận cho user** — kiểm tra lại kịch bản ở Phần E và pitfall ở Phần F

### Nguyên tắc chủ đạo

0. **PHASE (v2)** — trend/breadth trong file này là công cụ để agent đánh giá xu hướng ĐỘC LẬP. Nhãn pha của hệ (`market_phase`, `agent_db_06`) là nguồn tham chiếu ngang hàng, không override; nếu có nêu cả hai mà chúng lệch nhau thì trình bày cả hai góc nhìn — không mặc định bên nào thắng.
1. **Mọi ngưỡng đều có cơ sở từ empirical distribution của DB thực** — không phải hardcode theo training data của Claude
2. **Dòng tiền là lăng kính trung tâm** — mọi phân tích tổng hợp phải có ít nhất 1 luận điểm dòng tiền
3. **4 lăng kính kết hợp**: dòng tiền → kỹ thuật → cơ bản → vĩ mô (nếu liên quan)
4. **3 lớp đồng pha**: thị trường → ngành → mã, chỉ có tín hiệu khỏe khi ít nhất 2 lớp đồng thuận
5. **Đa khung w/m/q/y** không bao giờ suy từ khung này sang khung khác, chỉ đọc theo mức độ đồng pha

### Bảng dịch taxonomy nội bộ → cách nói với user (K hygiene)

Bảng tra nhanh cho rule K hygiene (system prompt mục 8.5): taxonomy dưới đây là công cụ nội bộ của file này, KHÔNG lộ tên ra output — thay bằng mô tả trực tiếp ở cột phải. Ký hiệu DB raw xem bảng system prompt mục 9; thuật ngữ tin tức xem `agent_db_05` phần 9.

| Internal | Mô tả cho user |
|---|---|
| Kịch bản A (đồng pha trung tính tích cực) | Thị trường tăng khỏe đồng đều 4 khung, chưa cực đoan |
| Kịch bản B (ngắn yếu + dài khỏe) | Điều chỉnh ngắn hạn trong xu hướng dài vẫn mạnh, cơ hội mua pullback |
| Kịch bản C (ngắn yếu + dài cũng yếu) | Cả ngắn và dài đều yếu, tránh bắt đáy, bounce có thể chỉ là hồi kỹ thuật |
| Kịch bản D (ngắn quá mua + dài chưa) | Điều chỉnh ngắn sắp tới trong uptrend dài, chờ tuần pullback mới vào |
| Kịch bản E (đồng pha quá mua) | Cảnh báo đỉnh lớn, cả thị trường lan toả cực đoan, giảm tỷ trọng |
| Kịch bản F (đồng pha quá bán) | Cảnh báo đáy lớn, canh tích luỹ dần, không all-in vì đáy có thể kéo dài |
| Kịch bản G (sóng hồi trung hạn) | Rally trung hạn từ đáy dài hạn, chưa xác nhận dài hạn, rủi ro cao |
| Kịch bản E1 (đã tăng nhưng còn khoẻ) | Mã đã có sóng tăng rõ nhưng chưa có dấu hiệu cạn lực |
| Kịch bản E2 (chưa tăng nhưng dòng tiền quay lại) | Mã đang tích luỹ hoặc vừa đảo chiều đáy, tín hiệu sớm chưa xác nhận |
| Kịch bản E3 (rủi ro cao, tránh vào) | Mã có nhiều cảnh báo đồng thời, không nên mua |
| warning mean-reversion | Cảnh báo khả năng đảo chiều do quá mua hoặc quá bán |
| exhaustion | Rally đuối hơi, cạn lực tăng |
| dead-cat bounce | Hồi kỹ thuật trong downtrend, không bền |
| confluence level | Vùng giao nhau của nhiều mức hỗ trợ hoặc kháng cự, mạnh hơn mức đơn |
| Value Area | Vùng giá chấp nhận, nơi diễn ra khoảng 70% giao dịch |
| Value Trap | Bẫy giá trị, P/E rẻ phản ánh kỳ vọng xấu có cơ sở, không phải undervalued |
| DuPont decomposition | Tách ROE thành 3 thành phần: biên lợi nhuận × vòng quay tài sản × đòn bẩy |
| Golden Ratio retracement | Mức Fibonacci 61.8%, mức hỗ trợ sâu nhất; vượt xuống là cấu trúc trend có thể đã gãy |
| whip-saw | Dao động biên độ lớn, rally rồi sập lặp nhiều lần |
| B5/B6/B7, Pitfall F1-F12, Workflow A-M, Bước 1/2/3 | Không nhắc tên section/workflow, làm theo flow tự nhiên |

---

## A. Diễn giải chỉ báo dòng tiền

### A1. day_score — Điểm dòng tiền phiên

**Công thức:**

```
day_score = ((C - L) - (H - C)) / TC × 1000

Trong đó:
- TC = prev_close (giá tham chiếu hôm trước)
- H = max(high, TC) — đỉnh hoặc TC nếu gap down
- L = min(low, TC) — đáy hoặc TC nếu gap up
- C = close (giá đóng cửa)
```

**Bản chất:** đo vị trí close trong range ngày, có cộng thêm gap.

- C gần H → tử số dương → bên mua thắng thế
- C gần L → tử số âm → bên bán thắng thế
- Điểm đặc biệt: H và L được điều chỉnh theo TC, nên gap down bị penalize (H=TC giảm numerator), gap up được reward (L=TC tăng numerator)

**Khác biệt với pct_change:** day_score đo **chất lượng phiên** (ai đang thắng trong range), không phải mức độ tăng giảm thuần. Một phiên pct_change +1% nhưng close sát high và gap up mạnh vẫn có thể có day_score +60. Ngược lại pct_change +3% nhưng bóng trên dài (close gần low) sẽ có day_score âm.

**Ngưỡng diễn giải** (theo percentile 674 mã toàn thị trường):

| Ngưỡng day_score | Mô tả | Percentile |
|---|---|---|
| ≥ 167 | Cực mạnh | Top 1% |
| 67 → 167 | Rất mạnh | Top 5% |
| 40 → 67 | Mạnh | Top 10% |
| 13 → 40 | Tích cực | Top 25% |
| -10 → 13 | Trung tính | Middle 50% |
| -31 → -10 | Yếu | Bottom 25% |
| -48 → -31 | Khá yếu | Bottom 10% |
| -125 → -48 | Rất yếu | Bottom 5% |
| ≤ -125 | Cực yếu | Bottom 1% |

**Kết hợp đọc tín hiệu:**

- day_score cao + pct_change dương + VSI ≥ 1.3 = tín hiệu mua mạnh nhất (đồng thuận 3 chiều)
- day_score cao + pct_change âm = hiếm, thường xảy ra sau gap down rồi phục hồi trong phiên — bắt đáy nội tại
- day_score âm + pct_change dương = tăng nhưng close dưới mid-range = yếu ngầm, cảnh báo phân phối
- day_score cao + VSI thấp (< 0.5) = tăng không có dòng tiền, không tin cậy

### A2. week_score — Điểm dòng tiền tuần

**Công thức:** rolling cumulative sum 5 phiên gần nhất của day_score

**Ngưỡng diễn giải** (theo percentile toàn thị trường):

| Ngưỡng week_score | Mô tả | Percentile |
|---|---|---|
| ≥ 54 | Cực mạnh | Top 1% |
| 30 → 54 | Rất mạnh | Top 5% |
| 18 → 30 | Mạnh | Top 10% |
| 6 → 18 | Tích cực | Top 25% |
| -6 → 6 | Trung tính | Middle 50% |
| -13 → -6 | Yếu | Bottom 25% |
| -19 → -13 | Khá yếu | Bottom 10% |
| -34 → -19 | Rất yếu | Bottom 5% |
| ≤ -34 | Cực yếu | Bottom 1% |

**Đọc đồng pha / lệch pha giữa day_score và week_score:**

- **Đồng pha dương** (day + tuần +): xu hướng ngắn hạn đang khỏe — momentum tốt
- **Đồng pha âm** (day - tuần -): xu hướng ngắn hạn xấu — tránh vào
- **Day dương + tuần âm**: cover ngắn hạn hoặc bắt đầu đảo chiều đáy — cần confirm bằng 2-3 phiên tiếp theo, chưa đủ tín hiệu mua
- **Day âm + tuần dương**: phiên điều chỉnh trong uptrend tuần — bình thường, không phải signal bán trừ khi day_score liên tiếp âm mạnh 3-4 phiên

**Lưu ý cẩn trọng:** week_score là tổng cộng, nên một phiên day_score +70 có thể kéo cả tuần lên dương dù 4 phiên khác đi ngang. Luôn verify bằng độ đồng đều của day_score qua `stock_recent` 5 phiên trước khi kết luận "dòng tiền tuần khỏe".

### A3. industry_rank_pct & market_rank_pct

**Công thức:** `rank_pct = (1 - rank/total) × 100` — thang **0–100** (v2)

- rank_pct = 90 → mã xếp trong top 10% (vượt qua 90% còn lại)
- rank_pct = 50 → mã ở mức trung vị
- rank_pct = 0 → xếp cuối hoặc không đủ điều kiện xếp hạng (thanh khoản quá thấp)

**Ranking dựa trên week_score** giảm dần, có filter thanh khoản tối thiểu (mã có trading_value quá thấp bị gán rank_pct = 0).

**Ngưỡng diễn giải:**

| rank_pct | Mô tả |
|---|---|
| ≥ 90 | Top 10%, dẫn đầu |
| 75 → 90 | Top 25%, mạnh |
| 50 → 75 | Trên trung vị |
| 25 → 50 | Dưới trung vị |
| 1 → 25 | Bottom 25%, yếu |
| = 0 | Không xếp hạng hoặc bottom thực — bỏ qua, không phân tích sâu |

**Kết hợp industry_rank_pct và market_rank_pct** (4 kịch bản):

| industry_rank_pct | market_rank_pct | Đọc |
|---|---|---|
| Cao (≥ 70) | Cao (≥ 70) | **Leader toàn diện** — dẫn đầu trong ngành mạnh, ưu tiên cao |
| Cao (≥ 70) | Thấp (< 50) | **Leader ngành yếu** — nổi bật trong ngành đang bị bỏ lại, rủi ro khi ngành điều chỉnh kéo theo |
| Thấp (< 50) | Cao (≥ 70) | **Hiếm** — ngành mạnh nhưng mã yếu trong ngành, cân nhắc tại sao yếu |
| Thấp (< 50) | Thấp (< 50) | **Yếu toàn diện** — tránh |

**Industry_rank (ngành):** số nguyên 1-24, sort theo week_score ngành giảm dần. Rank 1 = ngành có week_score cao nhất.

### A4. VSI — Volume Strength Index

**Công thức:** `VSI = volume hiện tại / SMA5 volume` (trung bình khối lượng 5 phiên gần nhất)

**Distribution thực tế** (phi chuẩn, exponential skewed):
- Median 0.75 — phần lớn phiên có volume dưới trung bình 5 phiên
- Mean 2.84 — bị kéo bởi spike
- Max 129 — có mã VSI gấp 129 lần trung bình 5 phiên

**Ngưỡng diễn giải:**

| VSI | Mô tả | Percentile |
|---|---|---|
| < 0.4 | Thanh khoản cạn | Bottom 25% |
| 0.4 → 1.3 | Trung bình | Middle 50% |
| 1.3 → 3.5 | Cao | Top 25% |
| 3.5 → 8.8 | Spike rõ rệt | Top 10% |
| 8.8 → 53 | Cực đoan | Top 5% |
| > 53 | Bất thường | Top 1% |

**Đọc kết hợp direction:**

- VSI cao + pct_change dương = mua mạnh, xác nhận breakout
- VSI cao + pct_change âm = xả mạnh (distribution), cảnh báo
- VSI cao nhưng price đứng yên = phân phối giấu — thường thấy ở đỉnh
- VSI thấp kéo dài + giá tăng nhẹ = rally thiếu xác nhận, dễ fail

**Lưu ý:** VSI thấp không nhất thiết là tín hiệu xấu. Mã có thanh khoản nền thấp, phiên nghỉ, hoặc đang tích luỹ đều có thể VSI < 0.5. Đọc VSI luôn kết hợp direction và context thanh khoản tuyệt đối (trading_value).

### A5. Breadth vs Trend — đừng nhầm lẫn

**Breadth** (`breadth_in`, `breadth_out`, `breadth_neu`) = đếm số mã tăng / giảm / đứng giá **trong phiên hôm nay**.

- Tỷ lệ `breadth_in / (breadth_in + breadth_out)`
  - < 0.4 = bên bán thắng
  - 0.4 → 0.6 = phân hoá
  - > 0.6 = bên mua thắng

**Trend** (`w_trend`, `m_trend`, `q_trend`, `y_trend`) = tỷ lệ mã có giá trên **trend line của khung thời gian** (5/20/60/240 phiên).

Sự khác biệt:
- Breadth = snapshot 1 phiên (số mã tăng/giảm/đứng hôm nay) → gọi cho user là "độ rộng"
- Trend = tỷ lệ mã trên trend line theo khung dài hạn → gọi cho user là "xu hướng theo tuần/tháng/quý/năm" (KHÔNG gọi "độ rộng")

Một phiên có breadth mạnh (60% tăng) nhưng trend tuần vẫn thấp (0.3) = phiên này tốt nhưng đa số mã vẫn dưới trend line tuần → bounce ngắn chưa đủ để nói xu hướng tuần đã đảo.

---

## B. TREND (XU HƯỚNG THEO KHUNG) — cơ chế Mean-Reversion

**Đây là phần quan trọng nhất của file này.** Trend là chỉ báo XU HƯỚNG độc nhất mạnh thứ hai sau dòng tiền trong hệ thống. Agent phải hiểu sâu để dùng đúng.

### B1. Định nghĩa & công thức

**Trend line** = (đỉnh chu kỳ + đáy chu kỳ) / 2 — midpoint của range trong khung thời gian.

**Value của trend** = tỷ lệ cổ phiếu đang có giá > trend line tương ứng, bounded [0, 1].

**Khung thời gian:**

| Khung | Số phiên | Ý nghĩa |
|---|---|---|
| w_trend | 5 | Trend tuần — ngắn hạn |
| m_trend | 20 | Trend tháng — trung hạn |
| q_trend | 60 | Trend quý — dài hạn ngắn |
| y_trend | 240 | Trend năm — dài hạn |

**Tính ở 3 cấp:**
- Thị trường (`market_snapshot.trend`) — toàn rổ FNXINDEX
- Ngành (`industry_snapshot.trend`) — trong nội bộ ngành
- Nhóm (`group_snapshot.trend`) — trong nhóm vốn hoá hoặc nhóm dòng tiền

**Không có ở cấp cổ phiếu** — mã đơn lẻ dùng `technical_zone` thay thế.

**Lưu ý dịch thuật khi output cho user:** KHÔNG dùng `w_trend`, `m_trend`, `q_trend`, `y_trend` raw. Cách dịch chuẩn:

- `w_trend: 0.35` → "xu hướng tuần 35%" hoặc "35% số mã đang trên đường trend tuần"
- `m_trend: 0.68` → "xu hướng tháng 68%"
- `q_trend: 0.28` → "xu hướng quý 28%"
- `y_trend: 0.32` → "xu hướng năm 32%"

Có thể viết tắt "xu hướng tuần/tháng/quý/năm" nhưng KHÔNG được để `w_trend`, `m_trend`... trong response cuối. **TUYỆT ĐỐI KHÔNG gọi w/m/q/y_trend là "độ rộng"** — "độ rộng" chỉ dành cho breadth phiên (số mã tăng/giảm/đứng hôm nay). K hygiene (system prompt mục 8.5 + mục 9) cấm lộ ký hiệu raw.

### B1.5. Bắt buộc kết hợp snapshot + recent khi phân tích trend

**Quy tắc cứng:** Snapshot chỉ cho điểm hiện tại của trend — không đủ căn cứ ra kết luận. Mọi phân tích trend PHẢI query cả `*_recent` để xem vận động 20 phiên gần nhất. Áp dụng cho mọi output style (cả tra cứu nhanh lẫn phân tích chi tiết), cả câu hỏi đơn giản lẫn phức tạp — đây là chuẩn methodology, không phụ thuộc format trả lời.

**3 collection có trend history:**

- `market_recent.series[].trend` — trend 4 khung mỗi phiên, 20 phiên gần nhất
- `industry_recent.series[].trend` — trend 4 khung mỗi phiên trong series ngành
- `group_recent.series[].trend` — trend 4 khung mỗi phiên trong series nhóm

Cả 3 cấp cùng cấu trúc `series[].trend` (v2 đã xác minh với DB thật — bản docs cũ tả `market_recent` có array `recent_trend` riêng là SAI). Schema ở `agent_db_01` khối D.

**Stock không có trend riêng** — dùng `technical_zone` của snapshot + chuỗi giá qua `stock_recent` để suy vận động kỹ thuật.

**5 pattern vận động trend cần nhận diện:**

1. **Đang rơi từ vùng quá mua** — trend ở cao > 0.75 trong nhiều phiên trước đây, hiện giảm dần qua 3-5 phiên. Đây là cảnh báo rally đã cạn lực, downside risk tăng. Ví dụ: xu hướng tuần 0.86 → 0.77 → 0.50 → 0.34 qua 4 phiên. Snapshot hiện tại (0.34) nhìn như "điều chỉnh bình thường" nhưng recent cho thấy đây là rơi từ đỉnh — bức tranh khác hẳn.

2. **Đang bật từ đáy** — trend ở thấp < 0.25 trong nhiều phiên, hiện tăng dần. Nếu duy trì 2-3 phiên và có dòng tiền xác nhận = phục hồi sớm, cơ hội entry early. Nếu chỉ 1 phiên bật rồi rơi = bounce không bền.

3. **Dao động biên độ lớn** — rally lên > 0.75 rồi sập xuống < 0.25 rồi rally lại, lặp 2+ lần trong 20 phiên. Volatility cao, môi trường không lành, tránh vào mới và chờ ổn định. Khác với pattern 1 (rơi 1 chiều): pattern này dao động 2 chiều lặp lại.

4. **Stable (dao động hẹp)** — giữ trong dải ~0.15-0.20 rộng quanh 1 mức (VD: 0.45-0.60 suốt 15 phiên). Thị trường ranging, không có hướng rõ, chờ breakout xác nhận trước khi hành động.

5. **Steady climb / Steady fall** — tăng đều 0.3 → 0.5 → 0.65 qua 10-15 phiên, hoặc giảm đều tương ứng. Xu hướng bền vững, độ tin cậy cao nhất trong 5 pattern — đây là môi trường tốt nhất để đầu tư theo trend.

**Quy trình đọc trend 2 bước bắt buộc:**

1. **Query snapshot** (market/industry/group) — biết vị trí hiện tại (4 giá trị w/m/q/y)
2. **Query recent 20 phiên** — biết đang đi đâu, đã trải qua pattern nào. Đọc theo 5 pattern ở trên cho từng khung thời gian.

**Cách mô tả cho user (theo K hygiene):**

- Không nói "xu hướng tuần rơi từ 0.86 xuống 0.35" (lộ raw nếu không có % đi kèm)
- Nói: "Xu hướng tuần rơi từ 86% xuống 35% qua 4 phiên — đây là đang rơi từ vùng quá mua, không phải điều chỉnh bình thường"
- Không nói "whip-saw", "steady climb" — dịch thành "dao động biên độ lớn", "tăng đều qua X phiên"

**Thiếu bước 2 = phân tích mất context**, rất dễ ra kết luận sai. Đây là pitfall methodology nghiêm trọng, không kém việc chỉ nhìn 1 snapshot stock_snapshot (xem F12).

### B2. Nguyên lý Mean-Reversion ở biên cực đoan

Trend là chỉ báo XU HƯỚNG — đo mức độ tham gia của thị trường vào xu hướng. Khi phần lớn cổ phiếu đồng thuận đi về một hướng, xu hướng đó tiến tới exhaustion (cạn lực).

**Ngưỡng warning mean-reversion:**

| trend value | Diễn giải | Signal |
|---|---|---|
| > 0.8 | Quá mua — đa số mã đã vượt trend line | Warning: xác suất đảo chiều giảm **cao hơn bình thường** |
| 0.6 → 0.8 | Bullish mạnh | Xu hướng tăng đang lan toả, còn dư địa |
| 0.4 → 0.6 | Cân bằng | Phân hoá, cần tín hiệu khác |
| 0.2 → 0.4 | Bearish mạnh | Xu hướng giảm lan toả |
| < 0.2 | Quá bán — đa số mã đã dưới trend line | Warning: xác suất đảo chiều tăng **cao hơn bình thường** |

**Ngưỡng này khớp với chuẩn quốc tế** (StockCharts, Schwab, Enlightened Stock Trading): % stocks above MA > 70% = bullish / < 30% = bearish / > 80% = overbought / < 20% = oversold.

**Lưu ý quan trọng:** "quá mua" không có nghĩa "đảo chiều ngay mai". Thị trường có thể giữ trạng thái quá mua/quá bán trong nhiều tuần. Tín hiệu chỉ báo cho biết xác suất điều chỉnh cao hơn, dùng để giảm risk appetite, không phải lệnh bán tức thời.

### B3. Đọc 4 khung fractal — nguyên tắc đồng pha

**Nguyên tắc 1 — Không suy từ khung này sang khung khác:**

w_trend yếu không có nghĩa y_trend sắp đảo. Thị trường có cấu trúc fractal: chu kỳ dài chứa chu kỳ ngắn, chu kỳ ngắn chứa chu kỳ ngắn hơn. Mỗi khung có logic xu hướng riêng.

**Nguyên tắc 2 — Sức mạnh tín hiệu = mức độ đồng pha:**

Khi cả 4 khung cùng báo một điều, tỷ lệ tín hiệu đúng tăng lên rất cao. Khi các khung lệch pha, phải đọc theo kịch bản cụ thể.

**Lưu ý dịch thuật (K hygiene):** 7 kịch bản dưới đây (A-G) là taxonomy NỘI BỘ để agent hiểu và gọi ra framework. KHÔNG nhắc tên "Kịch bản A/B/C/..." trong output cho user. Khi áp dụng, mô tả trực tiếp hiện tượng theo ngôn ngữ tự nhiên (bảng dịch taxonomy ở đầu file này). Ví dụ: thay vì "Thị trường đang ở Kịch bản G", nói "Thị trường đang trong pha rally trung hạn từ đáy dài hạn, dài hạn chưa xác nhận".

**7 kịch bản chính:**

**Kịch bản A — Đồng pha trung tính tích cực** (0.5 → 0.7 cả 4 khung)

Xu hướng tăng khỏe, không cực đoan. Thị trường/ngành/nhóm có sức mạnh lan toả đồng đều qua các khung thời gian. Rủi ro thấp, phù hợp giữ vị thế hoặc mua thêm.

**Kịch bản B — Ngắn yếu + Dài khỏe** (w < 0.2, m/q/y ≥ 0.5)

Điều chỉnh ngắn hạn trong uptrend dài. Đây là **kịch bản cơ hội mua pullback** — xu hướng dài còn đang mạnh, ngắn hạn chạm đáy, có xác suất phục hồi nhanh. Entry khi w_trend bắt đầu bật từ < 0.2 trở lên kèm day_score dương.

**Kịch bản C — Ngắn yếu + Dài cũng yếu** (w < 0.2, m/q/y < 0.4)

Bounce ngắn hạn không phải cơ hội. Xu hướng dài đang xấu, phục hồi ngắn có thể chỉ là dead-cat bounce. Tránh bắt đáy khi dài hạn chưa có tín hiệu đảo chiều đáy.

**Kịch bản D — Ngắn quá mua + Dài chưa** (w > 0.8, m/q/y 0.5-0.7)

Điều chỉnh ngắn sắp tới trong uptrend dài. Không vào vị thế mới ở vùng này, chờ pullback của w_trend xuống dưới 0.5 rồi mới vào. Nếu đang cầm vị thế dài hạn có thể giữ.

**Kịch bản E — Đồng pha quá mua** (> 0.75 cả 4 khung)

Cảnh báo đỉnh lớn. Cả thị trường đã lan toả cực đoan, dư địa tăng gần hết. Giảm tỷ trọng, không vào vị thế mới. Xác suất điều chỉnh 10-15% trong 1-3 tháng cao hơn bình thường.

**Kịch bản F — Đồng pha quá bán** (< 0.25 cả 4 khung)

Cảnh báo đáy lớn. Cả thị trường đã giảm lan toả cực đoan. Canh tích luỹ dần, không all-in vì đáy có thể kéo dài. Entry từng phần khi trend bắt đầu bật lên từng khung (w trước, rồi m, rồi q).

**Kịch bản G — Sóng hồi trung hạn từ đáy dài hạn** (m cao 0.6-0.9, w và q/y đều thấp 0.2-0.4)

Đây là combo lệch pha xuất hiện nhiều trong thực tế: tháng bật mạnh lên từ vùng đáy dài hạn, nhưng quý và năm vẫn chưa phục hồi.

Đặc điểm:
- Tháng trong khoảng 0.6-0.9 (rally mạnh)
- Tuần 0.2-0.4 (điều chỉnh sau rally tháng, hoặc chưa kịp bứt)
- Quý 0.2-0.4 (vẫn trong vùng yếu, chưa xuyên qua vùng đỉnh cũ của quý)
- Năm 0.2-0.4 (downtrend năm chưa đảo)

Đây là giai đoạn "rally trung hạn từ đáy sâu" — thường xuất hiện sau đợt giảm kéo dài. Thị trường đang thử phục hồi nhưng chưa đủ momentum để kéo dài sang quý và năm.

Xử lý:
- Rủi ro đảo chiều cao nếu quý không cải thiện qua 2-3 tuần tiếp theo
- Không vào mới bằng khối lượng lớn, chỉ nên thăm dò
- Theo dõi quý: bật lên > 0.5 = xác nhận rally sang dài hạn hơn
- Nếu quý tiếp tục yếu và tháng rơi từ cao xuống < 0.5 = rally tháng đã thất bại, quay lại downtrend
- Nếu mã trụ đang kéo index trong khi breadth thấp → cảnh báo rally thiếu lan toả (xem B5 phân biệt dẫn dắt thật vs trụ kéo)

**Nguyên tắc đọc lệch pha tổng quát (khi combo không match kịch bản A-G):**

Thực tế thị trường đa dạng, không phải mọi combo 4 khung đều match đúng 1 kịch bản chuẩn. Khi gặp combo mới, áp dụng 3 bước sau:

**Bước 1 — Xác định khung dominant.** Khung có giá trị cực đoan nhất (gần 0 hoặc gần 1) hoặc khác biệt rõ nhất với 3 khung còn lại. Đây là "câu chuyện chính" ở thời điểm hiện tại.

**Bước 2 — Đọc từng khung độc lập** theo ngưỡng B2:
- > 0.8: quá mua — warning mean-reversion
- 0.6-0.8: bullish
- 0.4-0.6: cân bằng, ranging
- 0.2-0.4: bearish
- < 0.2: quá bán — warning đáy

**Bước 3 — Tổng hợp theo 4 pattern:**
- **Khung dài bullish + khung ngắn đảo chiều đáy** (VD: y=0.6, q=0.55, m=0.35, w=0.15) → cơ hội entry ngắn hạn trong uptrend dài
- **Khung dài bearish + khung ngắn quá mua** (VD: y=0.25, q=0.3, m=0.85, w=0.75) → không vào mới, cân nhắc thoát nếu đang cầm
- **Tất cả mid-range 0.4-0.6** → thị trường ranging, chờ tín hiệu rõ ràng trước khi hành động
- **Lệch pha mạnh đa khung không có pattern rõ** → mô tả rõ từng khung cho user, KHÔNG ép vào 1 kịch bản cụ thể, đưa nhận định cẩn trọng

Nguyên tắc cốt lõi: đa khung không phải để suy diễn, mà để mô tả **hiện trạng** theo nhiều tầng thời gian. User cần biết thị trường đang ở giai đoạn nào, không cần agent ép vào hộp kịch bản chuẩn.

### B4. Ba lớp kết hợp — thị trường → ngành → mã

Luôn đọc trend theo **3 lớp đồng thời**:

**Lớp 1: Thị trường** (`market_snapshot.trend`) — cho big picture.

**Lớp 2: Ngành** (`industry_snapshot.trend`) — cho sector rotation. Khi thị trường chung yếu nhưng một ngành có trend mạnh = rotation vào ngành đó.

**Lớp 3: Mã** — không có trend riêng, dùng `technical_zone.overall` 4 khung thay thế. Mã có zone AAA 4 khung = tương đương "trend cao đa khung" cho cá nhân mã đó.

**Quy tắc ra quyết định:**

- Chỉ mua khi **ít nhất 2 trong 3 lớp đồng pha bullish** (không cực đoan quá mua)
- Hoặc khi lớp trên (thị trường/ngành) có xu hướng dài bullish + lớp dưới (mã) vừa đảo chiều đáy ngắn hạn
- Tránh mua khi **bất kỳ lớp nào đang ở trạng thái đồng pha quá mua (kịch bản E)**

### B5. Phân biệt "Dẫn dắt thật" vs "Trụ kéo"

Đây là ứng dụng thực tế quan trọng nhất của trend — phát hiện ngành dẫn dắt có chất lượng.

**Dẫn dắt thật:**
- week_score cao (≥ 15)
- w_trend 0.4 → 0.7 (lan toả nhưng chưa cực đoan)
- m_trend cũng vừa phải (không max)
- Đa số mã trong ngành cùng tham gia

**Trụ kéo:**
- week_score cao (≥ 15)
- w_trend thấp (< 0.3)
- Vài mã vốn hoá lớn kéo điểm dòng tiền ngành, đa số mã vẫn yếu
- Rủi ro: khi mã trụ chốt lời, cả ngành sụp vì không có mã khác đỡ

**Quy tắc thực hành:**

Khi tìm ngành để đầu tư, ưu tiên ngành có combo week_score cao + trend 0.5-0.7. Tránh ngành rank cao nhưng trend < 0.3 — đó là "ngành giả mạnh", rủi ro đảo chiều bất ngờ khi trụ suy yếu.

Tương tự cho nhóm và thị trường: index tăng mạnh nhưng market trend thấp = rally thiếu lan toả, dễ đảo chiều.

### B6. Workflow screening nhóm dẫn dắt tiềm năng

**Step 1: Xét trend thị trường — snapshot + recent 20 phiên (bắt buộc cả 2)**

Theo B1.5, query cả:
- `market_snapshot.trend` — điểm hiện tại
- `market_recent.series` (mỗi item có `trend`) — vận động

Đánh giá theo 5 pattern B1.5:
- Snapshot cả 4 khung > 0.75 VÀ recent cho thấy đã ở cao nhiều phiên liên tiếp → cảnh báo đỉnh lớn đồng pha, không screening mua mới
- Snapshot có khung > 0.75 NHƯNG recent cho thấy đang rơi từ đỉnh (pattern "đang rơi từ vùng quá mua") → rally đã cạn lực, tránh vào
- Snapshot < 0.3 và recent cho thấy đang bật lên (pattern "đang bật từ đáy") → cơ hội sớm, có thể screening với criteria conservative (xu hướng đảo đáy chứ không phải mua mạnh)
- Pattern "dao động biên độ lớn" → tránh screening mới, chờ ổn định
- Pattern "steady climb" (xu hướng tăng đều qua 10-15 phiên) → môi trường tốt nhất, tiếp tục screening với criteria chuẩn

**Step 2: Lọc ngành có tín hiệu dẫn dắt thật**

Query `industry_snapshot`, tìm ngành thoả:
- `money_flow_score.week_score` ≥ 15
- `trend.w_trend` trong 0.4-0.7
- `trend.m_trend` trong 0.4-0.7
- Loại ngành có `trend.y_trend` > 0.8 (dài hạn đã quá mua)

**Step 3: Trong ngành đã chọn, tìm mã dẫn dắt**

Query `stock_snapshot` với filter `industry` ∈ ngành đã chọn và:
- `technical_zone.overall.w` ∈ (A, AA, AAA)
- `technical_zone.overall.m` ∈ (A, AA, AAA)
- `money_flow_score.day_score` ≥ 13 (top 25% phiên hôm nay)
- `money_flow_score.market_rank_pct` ≥ 60
- `price.volume_strength_index` ≥ 1.3

**Step 4: Confirm bằng cơ bản**

Cho 5-10 mã lọt sàng ở Step 3, query `stock_finstats` lấy P/E, P/B, ROE:
- So với benchmark ngành (tra `industry_finstats`, xem Phần D)
- Loại mã có định giá vượt 150% median ngành
- Loại mã có tăng trưởng LNST âm 2 quý liên tiếp

Kết quả: shortlist 3-5 mã "đã tăng nhưng còn khỏe" — xem Phần E1.

### B7. Khi user hỏi screening trong ngành đang yếu toàn diện

Trường hợp user yêu cầu tìm mã mạnh trong một ngành cụ thể (VD: "tìm mã tốt trong ngành ngân hàng", "chỉ mình mã thép nào khoẻ") nhưng ngành đó đang ở trạng thái yếu toàn diện (rank thấp + trend thấp + week_score âm), agent KHÔNG tự động screening hoặc refuse thẳng. Quy trình 3 bước:

**Bước 1 — Báo trạng thái ngành trước khi screening (snapshot + recent)**

Theo B1.5, query cả:
- `industry_snapshot` của ngành user hỏi → điểm hiện tại
- `industry_recent` của ngành (slice 20) → vận động qua 20 phiên

Trình bày cho user (theo K hygiene, KHÔNG dùng raw, KHÔNG nhắc tên section):
- Xếp hạng ngành (trong 24 ngành)
- Điểm dòng tiền tuần
- Xu hướng 4 khung hiện tại + so với 10 phiên trước (cải thiện / xấu đi / ổn định / dao động biên độ lớn)
- Đánh giá pattern (chọn 1 trong 5 pattern B1.5 phù hợp): đang phục hồi sớm / đang rơi từ vùng quá mua / dao động biên độ lớn / ổn định ở mức yếu / tăng đều qua nhiều phiên
- Đánh giá tổng: ngành đang yếu toàn diện / yếu 1-2 khung / đang phục hồi sớm / đã mạnh nhiều phiên

**Bước 2 — Đưa 3 lựa chọn cho user**

- (a) Vẫn screening trong ngành, chấp nhận cảnh báo rủi ro thị trường chưa ủng hộ
- (b) Chuyển sang ngành khỏe hơn — gợi ý top 3 ngành rank tốt với trend lành mạnh (0.4-0.7)
- (c) Chờ tín hiệu phục hồi — theo dõi khi xu hướng tuần bật từ dưới 0.2 hoặc week_score chuyển dương rõ

**Bước 3 — Nếu user chọn (a), screening với criteria kịch bản E2**

Khi ngành yếu, không nên áp criteria "đã tăng nhưng còn khỏe" (E1) vì ngành chưa đủ điều kiện. Dùng criteria "chưa tăng nhưng dòng tiền quay lại" (E2):

- `money_flow_score.day_score` chuyển từ âm sang dương 2-3 phiên gần nhất
- `money_flow_score.week_score` đang từ âm sâu nhích lên gần 0 hoặc nhẹ dương
- `technical_zone.overall.w` chuyển từ B/C lên B hoặc A
- `technical_zone.ma_zone.w` bắt đầu cho tín hiệu đảo chiều (giá cắt lên MA20)
- `price.volume_strength_index` ≥ 1.3 trong phiên bật

Kèm cảnh báo rõ ràng: **"Đây là screening trong ngành đang yếu. Rủi ro cao hơn bình thường vì ngữ cảnh ngành chưa ủng hộ. Nếu ngành tiếp tục rơi, mã lọt shortlist cũng có thể bị kéo theo dù có tín hiệu cá nhân tích cực."**

Không refuse user — user có quyền quyết định sau khi có đủ thông tin.

---

## C. Technical Zone & Chỉ báo kỹ thuật

### C1. Overall Zone — tổng hợp nhanh

**Cấu trúc:** 5 bậc AAA > AA > A > B > C, tính từ 3 sub-zone (ma_zone, fibonacci_zone, volume_profile_zone). Mỗi sub-zone chỉ có 3 giá trị A/B/C.

**Rule tổng hợp:**

| Số sub-zone = A | Còn lại | Overall |
|---|---|---|
| 3 | — | AAA |
| 2 | 1 B/C bất kỳ | AA |
| 1 | 2 B/C bất kỳ | A |
| 0 | ≥ 1 B | B |
| 0 | 3 C | C |

**Dùng overall vs 3 sub-zone — chọn 1, không song song:**

- Phân tích nhanh, tra cứu ngắn → dùng `technical_zone.overall`
- Phân tích sâu, cần xác định điểm mạnh/yếu cụ thể → dùng 3 sub-zone riêng

Ví dụ, mã có overall = AA với ma_zone = A, fibonacci_zone = A, volume_profile_zone = B → xu hướng giá và retracement đang tốt nhưng chưa có volume xác nhận. Đọc 3 sub-zone giúp chẩn đoán đúng, còn overall chỉ cho biết "mạnh tổng quát".

### C2. ma_zone — SMA 5/20/60/240

**Cấu trúc MA cluster:** giá hiện tại so với 4 đường SMA 5/20/60/240 phiên.

**Ngữ nghĩa ma_zone:**

- **A** — Giá trên hầu hết/toàn bộ MA + các MA xếp hạng tăng (ma5 > ma20 > ma60 > ma240) — xu hướng đa tầng xác nhận bullish
- **B** — Giá và MA pha trộn, chưa có xu hướng rõ — sideways hoặc đang chuyển giai đoạn
- **C** — Giá dưới hầu hết MA + MA đảo xếp hạng (ma5 < ma20 < ...) — xu hướng đa tầng bearish

**Đọc thủ công khi cần chi tiết:**

1. Giá trên ma5 → momentum tuần tích cực
2. Ma5 > ma20 → xu hướng 5 phiên vượt xu hướng 20 phiên
3. Ma20 > ma60 → xu hướng tháng vượt xu hướng quý
4. Ma60 > ma240 → xu hướng quý vượt xu hướng năm
5. Nếu đủ 4 điều kiện trên → Golden Cross đa tầng, tín hiệu mạnh nhất

Ngược lại nếu đảo chiều từng điều kiện (Death Cross) — cảnh báo tương ứng.

### C3. fibonacci_zone — Fibonacci Retracement

**Cấu trúc:** 3 mức Fibonacci 38.2% / 50% / 61.8% của range prev_high - prev_low trong khung tương ứng.

- `f382` = giá tại mức retracement 38.2% (mức hỗ trợ nông nhất, cũng là kháng cự gần nhất nếu giá dưới)
- `f500` = retracement 50%
- `f618` = retracement 61.8% (mức hỗ trợ sâu nhất, theo lý thuyết Golden Ratio)

**Ngữ nghĩa fibonacci_zone:**

- **A** — Giá trên f382 (vùng chưa retracement sâu) — trend vẫn giữ
- **B** — Giá giữa f382 và f618 — đang retracement bình thường, chưa thay đổi cấu trúc
- **C** — Giá dưới f618 — retracement vượt Golden Ratio, cấu trúc trend có thể đã gãy

**Nguyên tắc thực hành:**

- Giá chạm f618 rồi bật lên = hỗ trợ mạnh, entry có xác suất thành công cao
- Giá vượt dưới f618 = cảnh báo gãy trend, cân nhắc cắt
- Khung càng dài (y > q > m > w), mức Fibonacci càng có ý nghĩa — f618 khung năm quan trọng hơn f618 khung tuần

### C4. volume_profile_zone — POC / VAL / VAH

**Cấu trúc Volume Profile theo Market Profile methodology:**

- **POC** (Point of Control) — giá có volume giao dịch cao nhất trong khung, "giá công bằng" mà đa số giao dịch xảy ra
- **VAL** (Value Area Low) — biên dưới của Value Area (chứa ~70% volume)
- **VAH** (Value Area High) — biên trên của Value Area

**Ngữ nghĩa volume_profile_zone:**

- **A** — Giá > VAH (breakout trên Value Area, cần volume xác nhận) hoặc giá ≈ POC/VAH trong uptrend
- **B** — Giá giữa VAL và VAH (balance zone, giá công bằng theo market consensus)
- **C** — Giá < VAL (breakdown dưới Value Area, weakness)

**Nguyên tắc thực hành:**

- Giá ở POC = giá đang "fair", không có catalyst chưa có entry rõ
- Giá > VAH kèm VSI ≥ 1.5 = breakout có volume xác nhận — tín hiệu mua
- Giá > VAH nhưng VSI < 1 = breakout fake, dễ fail
- Giá < VAL = break hỗ trợ, cảnh báo; nếu quick recovery về VAL thì có thể là bear trap
- POC vùng có thể là kháng cự (nếu giá đang dưới) hoặc hỗ trợ (nếu giá đang trên)

### C5. Pivot Classical

**Công thức Classical Pivot:**

```
pivot = (H + L + C) / 3
r1 = 2 × pivot - L  (kháng cự 1)
s1 = 2 × pivot - H  (hỗ trợ 1)
```

Trong đó H, L, C là high/low/close của khung trước.

**Ứng dụng theo khung:**

- `pivot.w` (tuần) — dùng cho swing trade ngắn hạn 5-10 phiên
- `pivot.m` (tháng) — dùng cho swing trade trung hạn
- `pivot.q`, `pivot.y` — tham khảo bối cảnh dài hạn

**Nguyên tắc thực hành:**

- Giá > pivot = bias bullish cho khung đó
- Giá gần r1 = vùng chốt lời ngắn hạn
- Giá gần s1 = vùng bật dậy nếu trend chung còn mạnh
- Kết hợp với fibonacci: khi r1 ≈ f382 hoặc VAH = confluence level, mức kháng cự mạnh hơn

### C6. Đọc Combo 4 khung Technical Zone

**Matrix diễn giải** theo combo overall w/m/q/y:

| w | m | q | y | Diễn giải |
|---|---|---|---|---|
| AAA | AAA | AAA | AAA | Đa khung đồng thuận — strongest bullish, nhưng cẩn thận nếu market trend > 0.75 (kịch bản E) |
| AAA | AA | AA | AA | Ngắn hạn rất mạnh, trung-dài hạn mạnh — tốt cho swing và position trade |
| AAA | A | B | B | Bulllish ngắn trong sideway dài — swing trade ngắn có thể, không vào dài hạn |
| A | AA | AAA | AAA | Ngắn hạn vừa phải, dài hạn mạnh — có thể đang pullback nông, chờ w cải thiện để entry |
| C | B | AA | AAA | Pullback sâu trong uptrend dài — kịch bản B cho cá nhân mã, cơ hội mua đáy ngắn hạn |
| C | C | C | C | Đa khung bearish — tránh |
| AAA | AAA | C | C | Ngắn hạn bùng nổ nhưng nền dài yếu — có thể là bear market rally, thận trọng |
| AAA | C | C | C | Bắt đầu đảo chiều từ đáy, chưa xác nhận — theo dõi, chưa entry |

**Nguyên tắc:** khung y là "nền", khung w là "momentum". Kết hợp: nền tốt + momentum tốt = an toàn nhất. Nền xấu + momentum tốt = rủi ro cao (có thể bear rally).

---

## D. Phân tích cơ bản theo 4 type (methodology riêng biệt)

Không có bộ chỉ tiêu chung cho mọi cổ phiếu. `stock_finstats` có 4 loại `type`, mỗi loại có bộ chỉ tiêu đặc thù, phương pháp tính benchmark riêng, và khung phân tích riêng. Bắt buộc đọc đúng type trước khi áp dụng.

**Phân bố type:**
- SXKD — 585 mã, 21 ngành (chiếm ~88%)
- CHUNGKHOAN — 41 mã, 1 ngành "Công ty Chứng khoán"
- NGANHANG — 29 mã, 1 ngành "Tài chính ngân hàng"
- BAOHIEM — 10 mã, 1 ngành "Kinh doanh Bảo hiểm"

### D0. Nền tảng chung

**Cấu trúc `stock_finstats`:**

- `valuation_ratios` — 7-9 tỷ số định giá hiện tại, cập nhật hàng ngày theo giá
- `financial_statements.quarterly` — chuỗi 8+ quý gần nhất, cập nhật khi doanh nghiệp công bố BCTC (thường chậm 1-2 tháng sau kết thúc quý)
- `financial_statements.yearly` — chuỗi 5+ năm, cập nhật khi có BCTC năm

**Period notation:**
- `2025_4` = Q4/2025
- `2025_5` = năm 2025 (convention _5 cho yearly)

**Đơn vị quy đổi bắt buộc nhớ:**
- BCTC absolute (Net Revenue, Total Assets, Equity, Net Income...): **đồng Việt Nam** — chia 10⁹ để có tỷ đồng
- Vốn hoá thị trường trong `valuation_ratios.value`: **đã là tỷ đồng**
- NN/TD (`buy_value`, `sell_value`, `net_value`): **đã là tỷ đồng**
- Tỷ lệ trong `stock_finstats`/`industry_finstats` (ROE, ROA, margin, growth): ⚠ **dạng thập phân** — nhân 100 khi nói (NGOẠI LỆ còn lại của quy ước v2, chờ schema curated)
- `pct_change`/`*_pct` ở price/change/other_data: **ĐÃ là điểm %** (v2) — đọc thẳng, KHÔNG nhân 100
- Lãi suất trong `other_data`: `value` gốc thập phân đọc kèm `unit` (0.045 = 4.5%)

**Lookup benchmark ngành:**

```
1. Từ stock_finstats lấy industry của ticker
2. Query industry_finstats với industry_name tương ứng
3. Kiểm tra type khớp (SXKD so với SXKD, NGANHANG so với NGANHANG)
4. Đọc giá trị benchmark theo method phù hợp
5. TRỤC THỜI GIAN — query history_finratios_industry (+ history_finratios_stock cho
   chính mã) để biết hiện đang ở phân vị nào của lịch sử (xem D6)
```

Bước 5 là bắt buộc: benchmark ngành hiện tại chỉ cho biết mã đắt/rẻ **so với hàng xóm**, không cho biết cả xóm có đang đắt hay không.

**4 method tính benchmark ngành** (quan trọng khi diễn giải):

- **aggregate** — ∑tử_số / ∑mẫu_số, coi cả ngành là 1 công ty lớn. Dùng cho: P/E, P/B, P/S, ROE, ROA, EBIT Margin, Net Margin, Asset Turnover, leverage
- **weighted** — ∑(trọng_số × chỉ_số) / ∑trọng_số. Dùng cho: Gross Margin (trọng số rev), DSO/DIO/DPO/CCC (rev), CASA/NPL/Credit Cost (loans), CIR (NII)
- **harmonic** — ∑trọng_số / ∑(trọng_số/chỉ_số), penalize outlier lớn mạnh hơn arithmetic. Dùng cho: NIM (NII), LDR (loans), ICR (EBIT hoặc PBT)
- **median** — np.nanmedian, tránh skew bởi outlier. Dùng cho: Revenue Growth, Net Profit Growth, PEG, Cash/Quick/Current Ratio

Ý nghĩa thực hành: khi so sánh mã với ngành, đừng nghĩ benchmark là "trung bình đơn thuần". P/E ngành aggregate có thể thấp hơn median nếu có vài mã vốn hoá lớn với LNST ổn định. Ngược lại NIM ngành harmonic sẽ thấp hơn arithmetic mean vì penalize bank có NIM cực cao.

### D1. Type SXKD — Sản xuất Kinh doanh (585 mã)

**Bộ chỉ tiêu 5 nhóm:**

**1. Valuation**
- P/E, P/B, P/S — ratio cơ bản
- PEG — P/E / tăng trưởng, bổ sung chiều tăng trưởng
- P/CF — P/E thay earning bằng cash flow, loại non-cash items
- EV/EBITDA — loại ảnh hưởng cấu trúc vốn
- EPS, BVPS — theo đơn vị cổ phiếu

**2. Profitability**
- ROE, ROA — hiệu quả sinh lời trên vốn chủ, trên tài sản
- Gross Margin, EBIT Margin, Net Margin — biên theo 3 cấp
- Asset Turnover, Fixed Asset Turnover — hiệu quả sử dụng tài sản

**3. Efficiency**
- CCC (Cash Conversion Cycle) — số ngày vốn kẹt
- DSO (Days Sales Outstanding) — số ngày phải thu
- DIO (Days Inventory Outstanding) — số ngày tồn kho
- DPO (Days Payable Outstanding) — số ngày phải trả
- Công thức: CCC = DSO + DIO - DPO

**4. Health**
- Đòn bẩy tài chính (Financial Leverage) = Total Assets / Equity
- Vay/VCSH (Borrowings-to-Equity)
- ICR (Interest Coverage Ratio) = EBIT / Interest — khả năng trả lãi
- Cash Ratio, Quick Ratio, Current Ratio — thanh khoản ngắn hạn

**5. Growth**
- Revenue Growth YoY
- Net Profit Growth YoY

**Ngưỡng tham khảo từ DB thực tế (VN, SXKD):**

| Chỉ số | Range 21 ngành SXKD |
|---|---|
| P/E | min 4.6 (Hoá chất Phân bón) — median ~14.6 — max 34 (Tài nguyên cơ bản) |
| P/B | min 0.84 (Thi công Xây dựng) — median ~1.46 — max 4.3 (Công nghệ Viễn thông) |
| P/S | min 0.17 (Kim loại CN) — median ~0.62 — max 3.83 (BĐS Dân dụng) |

**Không có ngưỡng tuyệt đối "rẻ/đắt"** — luôn so 2 mốc: benchmark ngành (`industry_finstats`) VÀ lịch sử của chính nó (D6). Tham chiếu toàn thị trường **KHÔNG hardcode**: query `history_finratios_industry` doc `"Toàn bộ thị trường"` để lấy P/E thị trường hiện tại + phân vị lịch sử của nó.

**4 kịch bản đọc SXKD:**

**1. Giá trị thật** (Value Play): P/E dưới median ngành + ROE trên median ngành + ICR ≥ 5 + Revenue Growth dương + biên ổn định/cải thiện qua 4 quý. Đây là cơ hội đầu tư giá trị chuẩn.

**2. Bẫy giá trị** (Value Trap): P/E rẻ (dưới 60% median ngành) nhưng ROE thấp + ICR < 2 + LNST âm tăng trưởng 2+ quý + biên co hẹp. P/E rẻ chỉ phản ánh market đánh giá xấu có cơ sở.

**3. Tăng trưởng đắt xứng đáng** (Growth at Premium): P/E cao hơn 150% median ngành nhưng Revenue Growth ≥ 15% YoY 4 quý liên tiếp + NPAT Growth ≥ 20% + biên mở rộng + ROE ≥ 20%. Định giá cao có cơ sở, cần theo dõi xem tăng trưởng có bền không.

**4. Đỉnh chu kỳ** (Cycle Top): ROE đang đỉnh lịch sử (cao hơn 5 năm gần) + biên bắt đầu co hẹp QoQ + tăng trưởng NPAT đảo chiều từ dương lớn sang nhỏ dần hoặc âm. Cảnh báo chu kỳ đảo chiều — giảm tỷ trọng.

**DuPont decomposition** (tùy chọn, dùng khi cần chẩn đoán ROE):

```
ROE = Net Margin × Asset Turnover × Financial Leverage
```

Nếu ROE cao chủ yếu do Financial Leverage (đòn bẩy > 3x) → ROE không bền. Khi ngành vào khó khăn, đòn bẩy cao = rủi ro vỡ nợ. So với cùng ROE mà nhờ Net Margin cao → chất lượng vượt trội.

### D2. Type NGANHANG — Ngân hàng (29 mã)

**Bộ chỉ tiêu đặc thù khác hẳn SXKD:**

**1. Valuation** (P/B quan trọng nhất với bank, không phải P/E)
- P/B — phản ánh kỳ vọng tạo giá trị trên vốn chủ
- P/E — bổ sung nhưng kém tin cậy hơn do lợi nhuận bank dễ bị ảnh hưởng bởi provision

**2. Profitability**
- ROE — chỉ tiêu hiệu quả cốt lõi cho bank
- ROA — thấp hơn SXKD nhiều lần do đòn bẩy bank rất cao (10-15x)

**3. Core banking metrics**
- NIM (Net Interest Margin) = (Interest Income - Interest Expense) / Interest Earning Assets — biên lãi
- YOEA (Yield on Earning Assets) — lợi suất tài sản sinh lãi
- COF (Cost of Funds) — chi phí vốn
- Non-interest income / NII — tỷ trọng thu nhập ngoài lãi, đa dạng hoá
- CIR (Cost-to-Income Ratio) — chi phí hoạt động / tổng thu nhập, càng thấp càng hiệu quả
- CASA (Current Account Savings Account) — tiền gửi không kỳ hạn / tổng tiền gửi, càng cao chi phí vốn càng rẻ

**4. Asset quality**
- NPL (Non-Performing Loan) — tỷ lệ nợ xấu nhóm 3-5
- LLCR (Loan Loss Coverage Ratio) — dự phòng / nợ xấu, khả năng hấp thụ rủi ro
- LLR/Gross Loans — tỷ lệ trích lập dự phòng trên tổng cho vay
- Credit Cost — chi phí tín dụng

**5. Capital adequacy & liquidity**
- Equity/TTS — tỷ lệ vốn chủ trên tổng tài sản
- Equity/Loans — vốn chủ trên tổng cho vay
- LDR (Loan-to-Deposit Ratio) — dư nợ / huy động, > 100% là áp lực thanh khoản

**6. Growth**
- Loan Growth YoY, Deposit Growth YoY, NII Growth YoY

**Ngưỡng tham khảo ngành ngân hàng VN (Q4/2025, từ DB + VinaCapital + FiinGroup + MBS):**

| Chỉ số | Benchmark sector | Diễn giải ngưỡng |
|---|---|---|
| NIM | 3.04% (DB harmonic) / forecast 3.5% | < 2.5% yếu / 2.5-3.5% trung bình / > 3.5% tốt |
| ROE (annualized) | ~17% (Q4 × 4) | < 12% yếu / 12-18% trung bình / > 18% tốt |
| CIR | 34% (DB weighted) | < 35% hiệu quả / 35-45% trung bình / > 45% kém |
| CASA | 22% (DB weighted) | < 15% thấp / 15-30% trung bình / > 30% cao (TCB >40%) |
| NPL | 1.86% (DB weighted) | < 1.5% tốt / 1.5-2.5% trung bình / > 2.5% cảnh báo / > 3% rủi ro cao |
| LLCR | 83% (DB weighted) | < 70% yếu / 70-120% trung bình / > 120% dồi dào |
| LDR | 108% (DB harmonic) | < 90% an toàn / 90-105% bình thường / > 110% căng thanh khoản |
| P/B | ~1.3x sector | Không có ngưỡng tuyệt đối, so với ROE |

**4 kịch bản đọc Ngân hàng:**

**1. Bluechip chất lượng tài sản**: ROE > 18% + NPL < 1% + LLCR > 150% + CASA > 30% + LDR < 100%. Có thể NIM thấp hơn sector do cho vay chủ yếu bluechip với lãi suất ưu đãi, nhưng đánh đổi lấy an toàn.

**2. Margin Leader**: NIM > 3.5% + CASA > 30% + ROE > 20%. Dẫn đầu về hiệu quả sinh lời, chi phí vốn thấp. Thường thấy ở bank có digital banking mạnh.

**3. Phục hồi đặc biệt**: P/B < 1 hoặc thấp hơn đáng kể sector (đáng nghi) — cần check NPL. Nếu NPL > 3% hoặc LLCR < 70% = rủi ro cao, P/B thấp có lý do. Nếu NPL tốt và P/B thấp do bất đối xứng thông tin hoặc cấu trúc sở hữu = cơ hội.

**4. Rủi ro cao**: NPL > 3% + LLCR < 70% + LDR > 115% + Loan Growth chậm lại + CIR tăng qua 3-4 quý. Cảnh báo nhiều chiều, tránh.

**Lưu ý đơn vị đặc biệt:**
- ROE/ROA trong quarterly data là **số cho 1 quý**, nhân ~4 để annualized so sánh với sector benchmark
- Growth metrics (Loan Growth, NII Growth) thường đã YoY sẵn, không cần adjust

### D3. Type CHUNGKHOAN — Công ty Chứng khoán (41 mã)

**Bộ chỉ tiêu trung gian giữa SXKD và ngân hàng:**

**1. Valuation**
- P/E, P/B, P/S — tương tự SXKD nhưng P/S cao hơn (doanh thu biến động theo thị trường)

**2. Profitability**
- ROE, ROA, Gross Margin, Net Margin
- Lưu ý ROE biến động mạnh theo chu kỳ thị trường

**3. Risk indicators đặc thù CK**
- Financial Leverage, Borrowings-to-Equity — đòn bẩy
- Margin Loans / Equity — exposure cho vay ký quỹ
- FVTPL / Equity — exposure tự doanh (prop trading)
- ICR

**4. Business structure** (không có trong DB tường minh nhưng suy từ doanh thu)
- Môi giới (brokerage commission)
- Cho vay ký quỹ (margin lending interest)
- Tự doanh (prop trading P&L từ FVTPL, AFS, HTM)
- Tư vấn, bảo lãnh phát hành

**5. Growth**
- Revenue Growth, NPAT Growth — biên độ rất lớn, có thể gấp đôi YoY khi thị trường sôi động

**Ngưỡng tham khảo ngành CK VN:**

| Chỉ số | Benchmark sector | Diễn giải |
|---|---|---|
| ROE (quarterly) | 2.64% → ~10.5% annualized | Biến động mạnh theo thanh khoản thị trường |
| ROA | 1.17% | |
| P/E | 17.97x | Cao hơn SXKD do doanh thu biến động |
| P/B | 1.94x | |
| Gross Margin | 61.5% | Cao do ít COGS trực tiếp |
| Net Margin | 30.9% | |
| Financial Leverage | 2.25 | Thấp hơn bank nhưng cao hơn SXKD |

**3 kịch bản đọc Chứng khoán:**

**1. Leader thanh khoản cao**: Vốn hoá top, thị phần môi giới lớn, doanh thu môi giới ổn định, margin lending / Equity trong 150-200%. Phù hợp đầu tư dài hạn theo chu kỳ thị trường.

**2. Phụ thuộc Margin Lending**: Margin Loans / Equity > 200% + tỷ trọng doanh thu lãi margin > 50%. Rủi ro khi thị trường điều chỉnh (margin call hàng loạt) và khi SBV siết tín dụng.

**3. FVTPL Exposure lớn**: FVTPL / Equity > 200% (như SSI 260%). P&L phụ thuộc mạnh vào biến động thị trường. Q nào thị trường tăng mạnh → ROE bật cao; Q nào thị trường giảm → ROE rớt. Đánh giá theo chu kỳ, không theo quý đơn lẻ.

**Lưu ý đặc thù:**
- ROE quý có thể âm trong Q thị trường giảm mạnh — không có nghĩa công ty có vấn đề cơ bản
- Cần đọc cùng với VN-Index performance của quý tương ứng để đánh giá

### D4. Type BAOHIEM — Bảo hiểm (10 mã)

**Bộ chỉ tiêu đơn giản hơn 3 type trên:**

**1. Valuation**
- P/E, P/B, P/S
- EV/EBITDA thường NaN do đặc thù kế toán bảo hiểm

**2. Profitability**
- ROE, ROA — chỉ tiêu cốt lõi
- Gross Margin **có thể âm bình thường** (đặc thù kế toán ngành)
- Net Margin thường thấp + biến động

**3. Leverage**
- Financial Leverage — cao (7-11x) bình thường do Technical Reserves là nợ phải trả lớn
- **Không dùng ICR** — có thể bị loại trong DB

**4. Growth**
- Revenue Growth (từ phí bảo hiểm gốc)
- NPAT Growth

**Ngưỡng tham khảo ngành Bảo hiểm VN:**

| Chỉ số | Benchmark sector | Ghi chú |
|---|---|---|
| ROE (quarterly) | 2.1% → ~8.4% annualized | Thấp hơn bank và CK |
| ROA | 0.29% | Rất thấp do đòn bẩy cao |
| P/E | 9.65x | Thấp hơn SXKD |
| P/B | 1.76x | |
| Financial Leverage | 7.34 | Đặc thù, không so với SXKD |
| Gross Margin | 3.83% | Thấp, có thể âm theo chu kỳ |

**Các điểm tránh nhầm lẫn:**
- Đừng áp ICR, Cash Cycle, Fixed Asset TO cho bảo hiểm — không áp dụng
- Đừng so P/B bảo hiểm 1.76x với P/B SXKD — cấu trúc vốn khác hoàn toàn
- Technical Reserves là khoản nợ lớn nhưng không phải debt truyền thống — không dùng nó để tính D/E

**2 kịch bản đọc Bảo hiểm:**

**1. Bluechip ngành**: ROE vượt trội sector (> 10% annualized) + Revenue Growth ổn định + NPAT Growth dương.

**2. Rủi ro**: NPAT Growth âm 3+ quý liên tiếp + doanh thu phí âm YoY + biên gộp âm sâu. Cảnh báo structural issue.

### D5. Đọc chuỗi quarterly 8 kỳ — YoY, QoQ, Seasonality

**Hai phép so sánh cơ bản:**

- **YoY (Year-over-Year)** — Q hiện tại so với Q cùng kỳ năm trước (Q4/2025 vs Q4/2024). Chính xác cho ngành có tính mùa vụ rõ (tiêu dùng, du lịch, xây dựng).
- **QoQ (Quarter-over-Quarter)** — Q hiện tại so với Q liền trước (Q4/2025 vs Q3/2025). Phản ánh xu hướng tức thời nhưng không so mùa — có thể gây nhầm lẫn ở ngành mùa vụ.

**Base effect cần chú ý:**

Q cùng kỳ năm trước có sự kiện bất thường (Covid lockdown, M&A lớn, 1-off charge) → tăng trưởng YoY bị méo. Ví dụ công ty Q4/2024 lỗ do 1-off impairment, Q4/2025 lãi bình thường → NPAT Growth YoY +∞%. Đó là base effect, không phải tăng trưởng thật. Kiểm tra bằng cách nhìn cả chuỗi 8 quý, loại outlier.

**Trend biên qua 3-4 quý = structural change:**

- Gross Margin mở rộng 4 quý liên tiếp → cải thiện vị thế cạnh tranh hoặc chu kỳ hàng hoá thuận lợi
- Gross Margin co hẹp 4 quý liên tiếp → áp lực cạnh tranh hoặc chi phí đầu vào tăng
- Net Margin diverge khỏi Gross Margin → chi phí hoạt động hoặc tài chính thay đổi cấu trúc

**Seasonality theo ngành (VN):**

- **Tiêu dùng bán lẻ**: Q4 cao nhất (Tết + holiday), Q1 thấp
- **Xây dựng**: Q1 yếu (nghỉ Tết), Q3-Q4 cao (mùa thi công)
- **Du lịch**: Q2-Q3 cao (hè), Q4 trung bình
- **Ngân hàng**: Q4 thường có provision booking cao, Q1 năm sau margin tốt hơn
- **Bảo hiểm**: Q1 tăng phí theo chu kỳ ký hợp đồng

Hiểu seasonality giúp đọc đúng QoQ: Q4 xây dựng giảm so với Q3 có thể là mùa vụ thôi, không phải cảnh báo.

---

### D6. Định giá tương đối theo lịch sử

Câu "P/E 8.9 — đắt hay rẻ?" **không có đáp án tuyệt đối**. Chỉ trả lời được khi có mốc so sánh. Hai mốc, phải dùng CẢ HAI:

- **Trục dọc (lịch sử)** — mã/ngành đang ở đâu so với **chính nó** trong quá khứ → `history_finratios_stock` · `history_finratios_industry` (schema: `agent_db_01` khối E).
- **Trục ngang (mặt bằng)** — mã đang ở đâu so với **ngành**, tại cùng thời điểm → `industry_finstats` (hiện tại) hoặc `history_finratios_industry` (quá khứ).

Query mẫu: `agent_db_02` mục 1.6 (mã) và 1.7 (ngành + toàn thị trường). **Không lặp lại query ở nơi khác — trỏ về đó.**

#### Bước 1 — Chọn cửa sổ, và LUÔN nói rõ đã chọn cửa sổ nào

Điểm dữ liệu theo **TUẦN**: `$slice: -52` = 1 năm · `-156` = **3 năm (mặc định)** · `-260` = 5 năm.

Đổi cửa sổ là đổi kết luận. Ví dụ thật (14/07/2026): P/E toàn thị trường **13.1** = phân vị **6% nếu nhìn 1 năm** nhưng **53% nếu nhìn 2 năm**. Nói "rẻ" mà không kèm cửa sổ là câu vô nghĩa. Luôn viết dạng: *"phân vị X% trong N năm (n = số điểm)"*.

**Fail-soft khi thiếu điểm:** cửa sổ 5 năm chỉ đủ ở cấp ngành / toàn thị trường; ở cấp mã chỉ ~558/679 mã đủ 3 năm. Nếu chuỗi có **< 52 điểm** (dưới 1 năm) → **KHÔNG kết luận phân vị**, chỉ nêu giá trị tuyệt đối + so ngành, ghi rõ "chưa đủ lịch sử".

#### Bước 2 — Thang phân vị (một thang duy nhất cho toàn hệ)

phân vị = % số điểm trong cửa sổ **thấp hơn** giá trị hiện tại. Bỏ qua điểm thiếu `pe`/`pb`.

| Phân vị | Nhãn |
|---|---|
| < 30% | rẻ tương đối (re-rating opportunity) |
| 30–70% | trung tính |
| > 70% | đắt tương đối (de-rating risk) |

Các ngưỡng SÀNG LỌC riêng của từng pack (vd "< 40% mới vào danh sách earnings-beat", "> 75% cảnh báo quá mua") là **cutoff sàng lọc**, không phải nhãn — không mâu thuẫn với thang trên.

#### Bước 3 — BẮT BUỘC phân rã: rẻ đi vì GIÁ giảm hay vì LỢI NHUẬN tăng?

`P/E = vốn hoá / lợi nhuận`. Mỗi điểm trong `series` có **sẵn cả `marketcap` lẫn `eps`** → so hai đầu cửa sổ là ra ngay:

| Ví dụ thật (07/2024 → 07/2026) | P/E | vốn hoá (GIÁ) | EPS (LỢI NHUẬN) | Bản chất |
|---|---|---|---|---|
| HPG | −42% | **+3%** | **+34%** | Rẻ đi vì **làm ăn tốt lên** — lành mạnh |
| FPT | −55% | **−40%** | +15% | Rẻ đi vì **thị trường bán tháo** — phải truy vì sao |

Hai mã cùng "phân vị ~0%, rẻ nhất 2 năm" nhưng **bản chất ngược hẳn nhau**. Kết luận "rẻ" mà không phân rã = lỗi phân tích.

⚠ Chiều ngược lại: EPS tăng vọt do **lợi nhuận đột biến / đỉnh chu kỳ** cũng kéo P/E xuống thấp giả tạo (cyclical trap). Mã chu kỳ (thép, hoá chất, vận tải biển, BĐS) → đọc **P/B** thay vì chỉ P/E.

#### Bước 4 — Rẻ so với CHÍNH NÓ ≠ rẻ so với NGÀNH

Mã ở phân vị 10% của chính nó nhưng P/E vẫn gấp đôi ngành → không "rẻ", chỉ là "bớt đắt". Phải nói cả hai trục.

⚠ P/E ngành trong `history_finratios_industry` là **cap-weighted** (∑vốn hoá ÷ ∑lợi nhuận). KHÔNG so nó với trung bình cộng P/E các mã — hai đại lượng khác nhau.

#### Bước 5 — Đọc bối cảnh chung trước khi phán từng mã

Ví dụ thật 14/07/2026: **5/24 ngành cùng ở phân vị 0%** (Dệt may P/E 5.9 · Thi công Xây dựng 9.1 · Kim loại 9.2 · Nông nghiệp 9.9 · Bán lẻ 11.9). Đây KHÔNG phải "cả thị trường rẻ" mà là **lợi nhuận tăng nhanh hơn giá trên diện rộng**. Khi nhiều ngành cùng chạm đáy phân vị, phải nêu hiện tượng chung thay vì kể lể từng mã "rẻ kỷ lục".

#### 4 cái bẫy của chính bộ dữ liệu này

1. **Điểm dữ liệu là TUẦN, không phải phiên.** `$slice: -20` = 20 **tuần**. Cấm viết "P/E giảm 5 phiên liên tiếp" từ chuỗi này.
2. **Look-ahead 1–2 tháng.** BCTC được gán vào **ngày kết thúc kỳ** (31/12, 31/03…) chứ không phải ngày công bố → tại tuần đó thị trường **chưa biết** số ấy. Mô tả/so sánh thì được; **cấm** dùng làm tín hiệu backtest hay nói "lúc đó P/E đã rẻ rồi".
3. **`n_stocks` có survivorship bias** (đếm theo phân loại ngành hiện tại, gần như đứng im suốt lịch sử) → đừng suy ra độ tin cậy mẫu từ nó. Tín hiệu thiếu dữ liệu đúng là **sự VẮNG MẶT của `pe`/`pb`** (năm 2020 chỉ có `marketcap`).
4. **2021–2023 chỉ có BCTC NĂM** → `eps`/`bvps` đứng yên cả năm, chỉ giá đổi. EPS "phẳng" ở đoạn đó là **đúng**, không phải lỗi.

---

## E. Kết hợp 3 lăng kính + 4 kịch bản ticker

Đây là phần ứng dụng thực tế — gộp dòng tiền, kỹ thuật, cơ bản vào kịch bản quyết định. Agent nên lưu bảng criteria này trong đầu khi phân tích mã.

**Lưu ý dịch thuật (K hygiene):** Tên "Kịch bản E1/E2/E3" là taxonomy NỘI BỘ. KHÔNG nhắc "Kịch bản E1", "E2", "E3" trong output. Mô tả trực tiếp bằng ngôn ngữ tự nhiên: "mã đã tăng nhưng còn khoẻ" (E1), "mã đang tích luỹ, dòng tiền bắt đầu quay lại" (E2), "mã có nhiều cảnh báo đồng thời, rủi ro cao" (E3). Bảng dịch taxonomy ở đầu file này.

### E1. Kịch bản "Đã tăng nhưng còn khoẻ"

Mã đã có sóng tăng rõ nhưng tín hiệu dòng tiền, kỹ thuật, cơ bản đều chưa cho thấy exhaustion.

**Criteria đầy đủ:**

| Lăng kính | Tiêu chí |
|---|---|
| Dòng tiền | week_score ≥ 6 (top 25%); day_score gần đây dương hoặc gần 0; market_rank_pct ≥ 70; VSI trong 1-3 (có volume nhưng chưa spike cực đoan) |
| Kỹ thuật | overall.w ∈ {A, AA, AAA}; overall.m ∈ {AA, AAA}; overall.q ∈ {A, AA, AAA}; giá trên MA20, MA60; chưa vượt VAH khung tháng quá xa |
| Cơ bản | P/E không vượt 150% median ngành; ROE ≥ median ngành; biên không co hẹp QoQ; tăng trưởng LNST dương 2 quý gần nhất |
| Vĩ mô (nếu nhạy) | Chỉ số liên quan (dầu, thép, lãi suất) đang trong trend tích cực hoặc ổn định |

**Rủi ro chính:** pullback ngắn hạn có thể mạnh do giá đã tăng nhiều. Nếu vào, chấp nhận điều chỉnh 5-10% ngắn hạn.

**Bối cảnh thị trường phù hợp:** market trend w/m trong 0.4-0.7 (không quá mua). Tránh vào khi market trend > 0.75.

### E2. Kịch bản "Chưa tăng nhưng dòng tiền quay lại"

Mã đang tích luỹ hoặc vừa đảo chiều đáy, có tín hiệu sớm nhưng chưa xác nhận.

**Criteria đầy đủ:**

| Lăng kính | Tiêu chí |
|---|---|
| Dòng tiền | week_score từ âm chuyển sang gần 0 hoặc nhẹ dương; day_score bật lên dương mạnh 2-3 phiên gần nhất; market_rank_pct tăng từ thấp (< 30) lên ≥ 50 |
| Kỹ thuật | overall.w chuyển từ B/C lên B hoặc A; ma_zone đảo chiều (giá bắt đầu cắt lên ma20); VSI ≥ 1.3 trong phiên bật |
| Cơ bản | Định giá rẻ hơn median ngành; hiệu quả chưa cải thiện nhưng không xấu đi; chưa có warning sign (ICR vẫn trên 2, LNST không âm kéo dài) |
| Vĩ mô | Ngành có catalyst sắp tới hoặc giá hàng hoá liên quan bắt đầu hồi |

**Rủi ro chính:** false signal — bật lên nhưng không tạo đáy, có thể rơi sâu hơn. Cần confirm bằng 5-10 phiên day_score dương liên tiếp và week_score chuyển hẳn dương.

**Bối cảnh thị trường phù hợp:** market trend w < 0.3 (quá bán) hoặc market/sector trend đang đảo chiều từ đáy. Kịch bản này đặc biệt hiệu quả trong "Kịch bản F — đồng pha quá bán" của market.

### E3. Kịch bản "Rủi ro cao, tránh vào"

Mã có nhiều cảnh báo đồng thời, không nên mua dù giá đang rẻ hay dù có tin tốt.

**Warning signs (đủ ≥ 2 để xếp kịch bản này):**

| Lăng kính | Warning |
|---|---|
| Dòng tiền | week_score ≤ -15 (bottom 15%); market_rank_pct < 30 hoặc = 0; day_score âm kéo dài 5+ phiên |
| Kỹ thuật | overall.w = C; ma đảo xếp hạng (ma5 < ma20 < ma60); giá dưới ma20 và đang rơi xa; fibonacci_zone = C (vượt f618) |
| Cơ bản | P/E cao hơn 150% median ngành + ROE thấp; ICR < 2; LNST âm 2+ quý liên tiếp; biên co hẹp 3-4 quý |
| Vĩ mô | Ngành đang gặp headwind có cấu trúc (regulatory risk, lãi suất tăng với bank nhỏ, USD tăng với xuất khẩu) |

**Ghi chú đặc biệt:** Mã rank_pct = 0 tự động vào kịch bản này — không cần phân tích sâu, thanh khoản quá thấp nên loại.

### E4. Workflow full analysis 1 ticker (phân tích chi tiết)

Khi user yêu cầu phân tích chi tiết một mã, theo chuỗi 10 bước:

**Bước 1 — Nhận diện cơ bản:** Query `stock_info` lấy ngành, vốn hoá, category, cấu trúc sở hữu, tổng quan kinh doanh.

**Bước 2 — Trạng thái hôm nay:** Query `stock_snapshot` với projection đủ: price, money_flow_score, change, technical_zone (ít nhất overall 4 khung).

**Bước 3 — Chuỗi ngắn hạn:** Query `stock_recent` với $slice 5-10 phiên để thấy đồng đều của day_score và biến động giá.

**Bước 4 — Dòng tiền NN/TD:** Query `stock_nntd` lấy cả nn và td (latest/week/month).

**Bước 5 — Cơ bản:** Query `stock_finstats` lấy valuation_ratios + 4-8 quý quarterly gần nhất. Đọc theo type (D1/D2/D3/D4).

**Bước 6 — Benchmark ngành kỹ thuật:** Query `industry_snapshot` của ngành chứa mã để có breadth, trend, money_flow_score ngành.

**Bước 7 — Benchmark ngành cơ bản:** Query `industry_finstats` của cùng ngành. So P/E, P/B, ROE, các biên của mã với benchmark.

**Bước 8 — Tin tức:** Query `news_today_feed` và `news_history_feed` theo ticker. Chỉ dùng tin CÓ trong dữ liệu; nếu tin có thể mới hơn mốc dữ liệu, ghi rõ giới hạn cập nhật với user, KHÔNG bịa từ trí nhớ.

**Bước 9 — Vĩ mô (nếu mã nhạy):** Query `other_data` chỉ số liên quan (dầu Brent cho dầu khí, quặng sắt cho thép, lãi suất cho bank/BĐS). Diễn biến quốc tế ngoài dữ liệu → nói rõ không có thông tin cập nhật, không đoán.

**Bước 10 — Synthesis:** Tổng hợp 3 lăng kính, xếp mã vào một trong 4 kịch bản (E1/E2/E3 hoặc giữ vị thế). Đưa kết luận có cấu trúc:
- Luận điểm ủng hộ (3-5 điểm)
- Luận điểm phản đối (3-5 điểm)
- Điều kiện/giả định áp dụng
- Mức kỹ thuật tham khảo (hỗ trợ, kháng cự gần từ fibonacci/pivot/volume profile)
- Câu nhắc user: quyết định cuối do user cân nhắc

---

## F. Pitfalls & mâu thuẫn tín hiệu

Các tình huống agent dễ đọc sai. Mỗi pitfall có chẩn đoán và cách xử lý đúng.

**Lưu ý dịch thuật (K hygiene):** Tên "Pitfall F1/F2/.../F12" là taxonomy NỘI BỘ để agent tra cứu. KHÔNG nhắc "pitfall F2", "F5", "F12"... trong output. Khi áp dụng pitfall vào phân tích cho user, mô tả trực tiếp hiện tượng (VD: thay vì "đây là pitfall F5 bẫy giá trị", nói "đây là bẫy giá trị — P/E rẻ phản ánh kỳ vọng xấu có cơ sở, không phải undervalued"). Cũng không nhắc thuật ngữ tiếng Anh chưa dịch như "exhaustion", "dead-cat bounce", "Value Trap" — dịch theo bảng taxonomy ở đầu file này.

### F1. Day_score dương mạnh nhưng week_score âm

**Tình huống:** day_score hôm nay +50 (top 10%) nhưng week_score vẫn -20 (bottom 15%).

**Diễn giải sai:** "Dòng tiền mạnh, mua vào."

**Diễn giải đúng:** Cover ngắn hạn hoặc bounce kỹ thuật sau chuỗi phiên xấu. Chưa xác nhận đảo chiều tuần. Cần ít nhất 2-3 phiên day_score tiếp theo duy trì dương và week_score chuyển lên -10, sau đó gần 0 hoặc dương mới confirm.

**Xử lý:** nếu user hỏi vào lúc này, trình bày đây là "tín hiệu sớm cần xác nhận", không khẳng định mua.

### F2. Trend cực đoan nhưng giá vẫn tăng

**Tình huống:** market trend w = 0.82, m = 0.88 (quá mua cả 2 khung), nhưng VN-Index vẫn tăng tiếp.

**Diễn giải sai:** "Trend cảnh báo nhưng chỉ số vẫn tăng nên ngưỡng không chính xác, bỏ qua."

**Diễn giải đúng:** Đây là exhaustion signal — xu hướng có thể kéo dài thêm nhưng xác suất điều chỉnh lớn tăng dần. Lịch sử cho thấy trend có thể giữ > 0.8 trong nhiều tuần trước khi đảo.

**Xử lý:** giảm risk appetite, không vào vị thế mới ở vùng này, không ép mua đuổi. Chốt lời từng phần nếu đang cầm vị thế lãi lớn.

### F3. Overall.w AAA nhưng VSI giảm dần

**Tình huống:** mã có overall.w AAA 3 tuần liên tiếp, nhưng VSI giảm từ 2.5 xuống 1.2 xuống 0.8 qua 3 tuần.

**Diễn giải sai:** "Zone AAA = xu hướng mạnh, cứ giữ."

**Diễn giải đúng:** Rally đuối hơi. Zone AAA dựa trên vị trí giá, không phản ánh volume. Giá vẫn trên MA và Fibonacci đẹp, nhưng volume cạn dần = không còn người mua mới. Thường xuất hiện trước đỉnh ngắn hạn.

**Xử lý:** cân nhắc chốt từng phần. Cảnh báo user nếu đang phân tích để quyết định vào thêm.

### F4. Market_rank_pct cao nhưng ngành yếu

**Tình huống:** mã có market_rank_pct = 85 (top 15% thị trường), nhưng ngành nó thuộc xếp gần cuối khi tự tổng hợp rank theo `week_score` qua 24 ngành (vd rank 22/24) và trend ngành < 0.3.

**Diễn giải sai:** "Mã mạnh, mua."

**Diễn giải đúng:** Mã mạnh trong ngành yếu = chọn đúng mã sai ngữ cảnh. Rủi ro: khi ngành xuống tiếp, mã này dù mạnh nhất ngành cũng bị kéo theo. Tín hiệu market_rank chỉ có giá trị khi ngành cũng đang khoẻ.

**Xử lý:** nếu vào, giảm kích thước vị thế và định sẵn stop loss. Ưu tiên mã khác trong ngành đang mạnh.

### F5. P/E thấp + ROE thấp = bẫy giá trị

**Tình huống:** mã có P/E 6x (rẻ hơn 60% median ngành 14x), nhưng ROE chỉ 8% (ngành 15%), ICR 1.8, LNST âm tăng trưởng 3 quý liên tiếp.

**Diễn giải sai:** "P/E rẻ, undervalued, mua."

**Diễn giải đúng:** Value Trap. P/E rẻ phản ánh kỳ vọng xấu có cơ sở — LNST đang giảm, khả năng trả lãi yếu, ROE thấp hơn sector. Mua vào đây là bắt dao rơi.

**Xử lý:** P/E rẻ chỉ là tín hiệu cần xem sâu, không tự nó là buy signal. Luôn check ROE, ICR, trend biên qua 3-4 quý.

### F6. So sánh cross-type

**Tình huống:** "VCB P/B 2.2x, VNM P/B 3.7x — vậy VCB rẻ hơn VNM."

**Diễn giải sai:** P/B thấp hơn nghĩa là rẻ hơn.

**Diễn giải đúng:** VCB là bank (type NGANHANG), cấu trúc vốn khác hoàn toàn SXKD. P/B bank so với ROE bank; P/B SXKD so với ROE SXKD. Không có nghĩa khi so cross-type.

**Xử lý:** khi so sánh định giá, chỉ so với benchmark **cùng type** từ industry_finstats tương ứng.

### F7. ROE cao + D/E cao

**Tình huống:** mã có ROE 25% rất hấp dẫn, nhưng đòn bẩy 4.5x (cao so với SXKD median 2).

**Diễn giải sai:** "ROE cao = doanh nghiệp hiệu quả."

**Diễn giải đúng:** DuPont decomposition: ROE = Net Margin × Asset Turnover × Financial Leverage. Nếu ROE cao chủ yếu do leverage, khi ngành khó khăn, leverage cao = rủi ro vỡ nợ. ROE 25% với leverage 4.5x có thể chỉ tương đương ROE 15% với leverage 2x về chất lượng.

**Xử lý:** khi gặp ROE cao, tách DuPont. Tìm điểm yếu trong Margin hay Asset Turnover hay chỉ nhờ Leverage. Kết luận chất lượng ROE theo chiều sâu.

### F8. Week_score spike do 1 phiên

**Tình huống:** week_score = 45 (top 5%), nhưng khi xem 5 phiên chi tiết thấy chỉ có 1 phiên day_score = 55, 4 phiên còn lại gần 0.

**Diễn giải sai:** "Dòng tiền tuần khoẻ."

**Diễn giải đúng:** Week_score = cumsum 5 phiên, nên 1 phiên spike có thể kéo tuần lên cao dù 4 phiên đi ngang. Không bền — nếu phiên cũ rơi ra khỏi rolling window, week_score rớt ngay.

**Xử lý:** luôn verify bằng stock_recent, check độ đồng đều của day_score. Kết luận "dòng tiền tuần khoẻ" chỉ khi ít nhất 3/5 phiên có day_score dương.

### F9. Rank_pct = 0

**Tình huống:** mã có rank_pct = 0 nhưng week_score lại +20.

**Diễn giải sai:** "Rank_pct sai, mã vẫn mạnh."

**Diễn giải đúng:** Rank_pct = 0 thường do thanh khoản không đủ để xếp hạng. Mã có thanh khoản thấp — dù tín hiệu dòng tiền đẹp, slippage khi vào và ra sẽ lớn, không phù hợp đầu tư có quy mô.

**Xử lý:** bỏ qua mã rank_pct = 0 khi screening. Nếu user hỏi riêng về mã này, nhắc rủi ro thanh khoản rõ ràng.

### F10. Benchmark Q4/2025 chưa cập nhật realtime

**Tình huống:** user hỏi về tình hình Q1/2026 của một mã, nhưng `stock_finstats` kỳ gần nhất vẫn là Q4/2025.

**Diễn giải sai:** "BCTC mới nhất Q4/2025, vậy là dữ liệu cập nhật."

**Diễn giải đúng:** BCTC quý công bố chậm 1-2 tháng sau kết thúc quý. Nếu hôm nay là cuối tháng 4/2026, Q1/2026 đang trong kỳ công bố — có thể đã có hoặc chưa có trong DB. Kiểm tra period mới nhất và ghi rõ với user "số liệu cơ bản đến Q4/2025, Q1/2026 chưa cập nhật".

**Xử lý:** luôn check period mới nhất trong quarterly series. Nếu không phải quý ngay trước hiện tại, ghi chú rõ với user "số liệu cơ bản đến [quý], quý gần nhất chưa cập nhật trong dữ liệu".

### F11. Trend tăng nhưng week_score âm

**Tình huống:** trend w của ngành tăng từ 0.2 lên 0.4 qua 2 tuần, nhưng week_score ngành vẫn âm.

**Diễn giải sai:** "Trend tăng nhưng dòng tiền chưa vào, tín hiệu mâu thuẫn, bỏ qua."

**Diễn giải đúng:** Trend là tỷ lệ mã trên trend line theo khung, week_score là tổng day_score. Trend có thể tăng khi nhiều mã vượt trend line nhưng mỗi mã vượt chỉ vài %, tổng day_score vẫn chưa mạnh. Đây là **pha phục hồi sớm** — phần rộng thị trường bắt đầu quay lại nhưng magnitude chưa đủ.

**Xử lý:** đây là tín hiệu early entry cho kịch bản E2 (chưa tăng, dòng tiền bắt đầu quay lại). Quan sát xem week_score có dương trong 1-2 tuần tiếp để confirm.

### F12. Phân tích dựa chỉ 1 snapshot

**Tình huống:** agent phân tích 1 mã chỉ dựa `stock_snapshot` hiện tại, không query `stock_recent`.

**Diễn giải sai:** "day_score hôm nay +50, mã này mạnh."

**Diễn giải đúng:** 1 phiên không đủ kết luận. Cần xem chuỗi 5-10 phiên để thấy:
- day_score có đồng đều không hay chỉ 1 phiên spike
- pct_change có nhất quán với day_score không
- Volume có xác nhận không hay chỉ 1 phiên có volume
- Có divergence giữa giá và chỉ báo không

**Xử lý:** phân tích chi tiết bắt buộc có stock_recent trong chuỗi query. Tra cứu nhanh khi thời gian hạn chế có thể skip, nhưng phải ghi rõ "dựa trên trạng thái phiên hôm nay".
