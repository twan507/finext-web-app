# agent_db_06 — Market Phase & 3 Danh Mục Hệ Thống

Tài liệu cho MỌI câu hỏi về: pha thị trường ("đang uptrend hay downtrend?", "nên cầm bao nhiêu %?"),
7 chỉ số quyết định phase, 3 danh mục hệ thống (Phòng Thủ / Sóng Ngành / Mạo Hiểm), sổ lệnh, hiệu suất.
Dữ liệu ở 6 collection: `market_phase`, `market_phase_history`, `phase_basket`, `phase_trading`,
`phase_industry`, `phase_perf` (schema chi tiết: `agent_db_01` Section I; query mẫu: `agent_db_02` Workflow M).

**Luật nền (system prompt mục 5-6):** NHÃN pha của hệ CHỈ trích từ `market_phase` — không tự gán nhãn thay hệ
(đánh giá xu hướng độc lập vẫn được phép, lệch thì nêu cả hai góc nhìn); khuyến nghị ngược tín hiệu hệ thì nói
rõ điểm lệch; hiệu suất theo luật 2 tầng; không lộ công thức/trọng số/tiêu chí xếp hạng.

---

## 1. Pha thị trường — sản phẩm chủ lực của Finext

Hệ thống chạy một mô hình phát hiện pha thị trường trên **FNXINDEX** (rổ cổ phiếu chất lượng do Finext lọc —
KHÔNG phải VNINDEX toàn sàn; hai chỉ số thường đồng pha nhưng số liệu khác nhau). Mỗi phiên EOD, mô hình
gán 1 trong 4 trạng thái + tỷ lệ nắm giữ gợi ý:

| Trạng thái | Đèn | `exposure` gợi ý | Nghĩa với NĐT |
|---|---|---|---|
| **UPTREND** | 🟩 | **1.0 → 2.0** (theo độ tin cậy) | Thị trường tăng có nền — nắm giữ đủ, hệ có thể gợi ý vượt 100% (margin — LUÔN kèm cảnh báo) |
| **TRANSITION** | 🟧 | **0.70 → 1.0** (theo cường độ thị trường) | Vùng chuyển tiếp/thiếu bằng chứng — nắm giữ cao nhưng không tối đa |
| **SIDEWAY** | ⬜ | **0.5** | Đi ngang có bằng chứng — nắm một nửa |
| **DOWNTREND** | 🟥 | **0** | Phòng thủ — hệ thống về 100% TIỀN MẶT, cả 3 danh mục bán sạch |

**Triết lý — nói đúng cho khách hiểu, chống kỳ vọng sai:**
- Đây là **bảo hiểm sụp đổ** (crash insurance), KHÔNG phải cỗ máy thắng thị trường mọi lúc. Giá trị tập trung
  ở các năm gấu: 2022 thị trường −49%, cả 3 danh mục **DƯƠNG sau phí**.
- **Đánh đổi bắt buộc:** trong thị trường tăng kéo dài không có sập, hệ **SẼ thua mua-và-giữ** (bằng chứng:
  2023 — thị trường hồi +44%, danh mục thận trọng gần như đi ngang). Khách phải biết điều này TRƯỚC khi
  theo hệ — nếu khách phàn nàn "sao chậm hơn index" trong bull, giải thích đúng bản chất này, không hứa hẹn bù.
- Bất đối xứng có chủ đích: hệ **thoát nhanh hơn vào** — thà lỡ một nhịp tăng còn hơn dính một nhịp sập.
- Lịch sử pha **được tính lại** khi dữ liệu nguồn cập nhật (đặc thù dữ liệu VN có điều chỉnh quá khứ) —
  "ổn định, không bất biến". Tín hiệu forward đã publish thì không sửa.

**Đọc nhanh:** `market_phase` (1 doc) có `phase`, `exposure`, `held_days` (pha hiện tại giữ được mấy phiên),
`intensity` (−1..+1, cường độ), `sub_signal` (cờ bắt-đáy phụ: `capitulation_buy_60d` / `sideway_bottom_buy` —
tín hiệu tham khảo, KHÔNG phải sizing), `comments` (4 đoạn diễn giải sinh sẵn — dùng làm nền trả lời),
`history_60`. Lịch sử dài hơn (vd "2022 hệ làm gì?") → `market_phase_history` filter theo `date`.

## 2. Bảy chỉ số quyết định phase (`market_phase.indicators`)

Mỗi chỉ số có `label_vi` (tên nói với khách), `value`, `threshold_note` (ngưỡng đã công bố trên UI — được phép
nói), `comment` (đoạn diễn giải sinh sẵn từng phiên). **Được nói:** chỉ số đo gì, mức hiện tại so ngưỡng, nghiêng
lên/xuống. **CẤM:** công thức tính, trọng số, cách kết hợp ra nhãn, số phiên duy trì — trả lời mọi câu hỏi dạng
"tính thế nào" bằng: *"thuật toán nội bộ của hệ thống — em chỉ nói được ý nghĩa và ngưỡng công bố"*.

| `key` | Tên với khách | Đo gì | Ngưỡng công bố |
|---|---|---|---|
| `breadth_slow` | Cấu trúc xu hướng tăng | độ rộng nền cổ phiếu theo nhịp CHẬM — trục giữ xu hướng tăng bền | vượt **+0.30** mới đủ điều kiện hướng TĂNG |
| `breadth_blend` | Cấu trúc xu hướng giảm | nhóm phản ứng NHANH — trục thoát | dưới **−0.30** là điều kiện hướng GIẢM |
| `breadth_aux` | Tín hiệu xu hướng suy yếu | trigger giảm độc lập thứ hai | dưới **−0.30** |
| `conf_dir` | Độ tin cậy xu hướng | mức tin cậy của tín hiệu hướng (0..1) | ≥**0.30** đủ cho TĂNG · ≥**0.20** đủ cho GIẢM (giảm cố ý dễ kích hoạt hơn — thiên về bảo vệ) |
| `conf_flat` | Độ tin cậy Sideway | mức tin cậy trạng thái đi ngang (0..1) | ≥**0.45** mới xác nhận SIDEWAY |
| `corr60` | Mức độ lan tỏa dòng tiền | thị trường tăng/giảm có đồng thuận thanh khoản không | dưới **0.35** = dòng dẫn dắt hẹp → hệ vào chế độ thận trọng với tín hiệu giảm (chống báo động giả khi chỉ vài trụ kéo) |
| `px_ret20_pct` | Quán tính biến động giá | lợi suất 20 phiên gần nhất (điểm %) | trên **−10** = chưa rơi vào nhịp sập nhanh; dưới −10 thì chế độ thận trọng TẮT để bảo vệ kịp |
| *(kèm)* `market_intensity` | Cường độ thị trường | gauge −1..+1 "đang lên/xuống sâu tới đâu"; điều tiết mức nắm giữ trong TRANSITION | không có ngưỡng công bố |

Mạch kể gợi ý (khớp bố cục web, không bắt buộc): kết luận pha (từ `comments.market`) → điều kiện đổi trạng thái
(`comments.condition`) → cấu trúc đồng thuận/mâu thuẫn (`comments.structure`) → rủi ro & watch-item
(`comments.risk`) → chi tiết từng chỉ số khi khách hỏi sâu (comment per-indicator). Comment sinh sẵn là
NỀN chính xác nhất — ưu tiên diễn đạt lại từ đó thay vì tự suy diễn mới.

## 3. Ba danh mục hệ thống (`phase_basket` — key FROZEN, tên đọc từ `display_name_vi`)

| `product` | Tên hiển thị | Khẩu vị | Đặc điểm nói được |
|---|---|---|---|
| `CONSERVATIVE` | **Phòng Thủ** | thận trọng | cổ phiếu vốn hoá lớn/vừa, ~9-10 mã, ưu tiên ổn định |
| `CORE` | **Sóng Ngành** | cân bằng, theo sóng | chọn NGÀNH mạnh trước (tối đa ~3 ngành dẫn dắt) rồi chọn mã trong ngành, ~13 mã; có tầng ngành riêng (`phase_industry`) |
| `AGGRESSIVE` | **Mạo Hiểm** | chấp nhận rủi ro cao | vốn hoá nhỏ, ~9 mã, biến động lớn hơn |

**Cơ chế vận hành (mức được nói):**
- **Cơ cấu mỗi 5 phiên giao dịch** (`next_rebalance_in` = còn mấy phiên tới kỳ). Giữa kỳ, danh mục thường không đổi.
- Mã vào/ra theo **bảng xếp hạng của hệ thống** (`rank` trong doc — hạng hiển thị trần, KHÔNG kèm công thức)
  với **vùng đệm**: hạng ≤ `nguong_vao` mới đủ điều kiện vào; đã giữ thì được giữ tới khi tụt quá `nguong_giu`
  (chống nhảy ra-vào liên tục).
- **Cổng vào theo giá:** mã đủ hạng nhưng chưa qua điều kiện xác nhận giá (`qua_cong_vao = 0`, status
  `cho_tin_hieu`) thì CHƯA được mua — hiển thị "chờ tín hiệu giá". Công thức cổng là nội bộ.
- `status` từng dòng rank: `trong_ro` đang nắm giữ · `vung_buffer` đang giữ nhưng hạng tụt = **sắp ra** ·
  `ung_vien` = **chờ vào** kỳ cơ cấu tới · `cho_tin_hieu` = đủ hạng, chờ tín hiệu giá · `ngoai`.
- **Thị trường DOWNTREND → `exposure = 0` → `held = {}` = 100% tiền mặt cả 3 danh mục.** `book` vẫn có =
  "danh mục sẽ vào khi hệ bật lại" — trình bày là THAM KHẢO, chưa vào lệnh.
- Sóng Ngành có tầng ngành: `sectors` = ngành đang giữ; `phase_industry.states` = trạng thái 12 ngành
  {0 ngoài · 1 tiềm năng (vào kỳ tới) · 2 đang giữ nhưng sắp ra · 3 trong rổ} — **độc lập exposure** (downtrend
  vẫn hiện ngành mạnh = "sẽ mua lại ngành nào khi bật lên").
- `exit_reason` trong sổ lệnh: `HOLDING` đang giữ · `DOWNTREND` bán cả rổ do thị trường phòng thủ ·
  `ROTATION` (chỉ Sóng Ngành) NGÀNH bị đảo ra → nhả toàn bộ mã của ngành · `REBALANCE` mã tự rớt hạng kỳ cơ cấu.

**Luật trình bày (bắt buộc, kế thừa guard hệ thống):**
1. Hành động hệ = mã "**được THÊM VÀO / RỜI KHỎI danh mục**" — KHÔNG viết hệ "mua/bán" (chống hiểu nhầm lệnh thật).
2. Lý do một mã có mặt = *"đứng hạng cao trên bảng xếp hạng của hệ thống"* — câu chuẩn hoá DUY NHẤT.
   TUYỆT ĐỐI không mô tả/suy đoán tiêu chí (không "biến động thấp", "thanh khoản cao được chọn"...).
   Đà giá (`mom120_pct`) / thanh khoản (`vma60`, tỷ đồng) chỉ trích như QUAN SÁT, không phải tiêu chí.
3. Không bịa thesis doanh nghiệp / triển vọng / giá mục tiêu cho lựa chọn của hệ.
4. Khi liệt kê bảng xếp hạng: nhóm "chờ vào"/"sắp ra" (thứ khách cần hành động) nêu TRƯỚC nhóm đang nắm giữ ổn định.
5. Sổ lệnh + heatmap + lịch sử danh mục = **BACKTEST** (kèm disclaimer mục 5) — không phải lệnh thật đã khớp.

## 4. Hiệu suất — luật 2 tầng + cách tính đúng

**Tầng 1 — số chính thức (FROZEN, NET sau phí, data đến 2026-07-09).** Câu hỏi tổng kết/dài hạn/so sánh
("lãi bao nhiêu từ 2020", "Sharpe", "năm 2022 thế nào") CHỈ trích bảng dưới — không tự tính lại:

| Danh mục | Sharpe net | CAGR net | Tổng net | MaxDD | Năm 2022 | Trần vốn khuyến nghị |
|---|--:|--:|--:|--:|--:|--:|
| **Phòng Thủ** @1.0x | 1.78 | 24.5% | +310% | −12.7% | **+8.6%** | ~13 tỷ đồng |
| **Sóng Ngành** @1.0x | 1.71 | 35.9% | +631% | −18.6% | **+35.3%** | ~111 tỷ đồng |
| **Mạo Hiểm** @1.0x | 1.91 | 36.9% | +655% | −16.4% | **+16.6%** | ~6 tỷ đồng |
| *Mua-và-giữ FNX (benchmark)* | *0.90* | | *+266%* | *−62%* | ***−49%*** | |

- Hero stat: **2022 thị trường −49%, cả 3 danh mục DƯƠNG sau phí.** MaxDD cả 3 ≈ −13…−19% vs thị trường −62%.
- Mặc định trình khách là bản **@1.0x (không đòn bẩy)**. Bản @2.0x chỉ nói khi khách hỏi margin, kèm fact:
  Sharpe @2x THẤP hơn @1x ở cả 3 danh mục (Phòng Thủ 1.44 · Sóng Ngành 1.48 · Mạo Hiểm 1.66; MaxDD sâu hơn:
  −16.8% / −25.2% / −20.9%) — sau phí vay, đòn bẩy KHÔNG được trả công theo rủi ro; nó là lựa chọn khẩu vị.
- Năm xấu PHẢI nói khi khách hỏi per-year (@2x): **2023 Phòng Thủ +0.8%** vs thị trường +44% (chi phí
  bảo-hiểm-sụp-đổ hiện hình) · **2024 Sóng Ngành +2.5%** vs +15% · 2026 (một phần năm) Mạo Hiểm −5.5%.
  Đủ bảng: 2020* +57.5/+55.5/+130 · 2021 +27.6/+72.5/+97.7 (vs BH +126%) · 2022 +7.4/+35.3/+16.7 (BH −49%) ·
  2023 +0.8/+2.6/+34.8 (BH +44%) · 2024 +16.5/+2.5/+8.9 (BH +15%) · 2025 +48.8/+82.6/+16.1 (BH +25%) ·
  2026** +8.7/+8.2/−5.5 (BH ~0%). (*2020 = warmup, discount · **2026 = chưa trọn năm.)
- **Trần vốn:** danh mục cô đặc ~9 mã + có lúc chỉ giữ 5-6 mã → vốn lớn tự đẩy giá. Mạo Hiểm ~6 tỷ là ràng
  buộc gắt nhất. Khách hỏi "bỏ 50 tỷ vào Mạo Hiểm được không" → KHÔNG, giải thích trần + gợi ý Sóng Ngành (trần ~111 tỷ).

**Tầng 2 — cửa sổ ngắn (tự tính được).** "Tuần này / tháng này / YTD danh mục chạy sao":
compound từ `phase_perf`: lấy `ret_1d_1x` của `product` trong cửa sổ, `hiệu suất = Π(1+ret_1d_1x) − 1`,
so cùng cửa sổ với `product = "FNX"` (benchmark mua-và-giữ). BẮT BUỘC dán nhãn:
*"số gross chưa trừ phí/thuế, tham khảo nhanh — số chính thức NET xem bảng công bố."*

**Thống kê sổ lệnh (tự tính được, dán nhãn backtest).** "Hệ đánh VCB thắng mấy lần?", "tỷ lệ thắng của
Sóng Ngành?" → query `phase_trading` (filter `ticker`/`product`/`exit_reason`), tự đếm/trung bình `return_pct`
(đã là điểm %). Định nghĩa khi tính: **lãi TB = trung bình các lệnh THẮNG riêng · lỗ TB = trung bình các lệnh
THUA riêng · kỳ vọng/lệnh = trung bình TẤT CẢ lệnh** — nói rõ đang dùng con nào. Luôn kèm nhãn backtest.

## 5. Disclaimer bắt buộc (nguyên văn — đi kèm MỌI số hiệu suất/sổ lệnh/danh mục quá khứ)

Trích đúng, không rút gọn quá mức; tối thiểu phải nêu #1 #3 #4 khi đưa số, và #6 khi nói đòn bẩy:

1. Backtest trên universe survivorship-biased; lợi nhuận quá khứ nhiều khả năng bị thổi phồng, nặng nhất ở Mạo Hiểm.
2. Bảo vệ giảm điểm đến từ overlay market-timing về tiền mặt, KHÔNG phải chọn mã.
3. Số là backtest NET (phí 0.2%/chiều, thuế bán 0.1%, lãi vay 13%/năm phần >1x, slippage 10-25bps), data đến
   2026-07-09, KHÔNG phải lợi nhuận kỳ vọng. Backtest được tính lại khi dữ liệu nguồn cập nhật (dữ liệu VN có
   điều chỉnh quá khứ); mức trôi được giám sát bằng guardrail công khai phương pháp.
4. Trong bull kéo dài hệ SẼ thua mua-và-giữ (bản chất crash-insurance — xem 2023).
5. Track record forward công khai từ 2026-07-06 (bản ghi append-only, chỉ tính bản ghi EOD-final) — tín hiệu
   forward đã publish không bao giờ sửa.
6. Đòn bẩy 2.0x: rủi ro call margin + lãi vay ăn mòn; sau phí, hiệu quả điều-chỉnh-rủi-ro KHÔNG tốt hơn 1.0x.

## 6. Q&A mẫu — khung tham khảo (nguồn dữ liệu + ý chính cần chạm, KHÔNG phải template bắt buộc theo từng chữ)

- **"Thị trường đang thế nào / nên cầm bao nhiêu?"** → `market_phase`: nhãn pha + held_days + exposure
  ("hệ gợi ý nắm ~X%") + tóm `comments.market` + 1-2 chỉ số nổi bật. Downtrend thì nói rõ 100% tiền mặt.
- **"Sao hệ bắt phòng thủ trong khi tin tốt thế?"** → `comments.condition`/`risk` + chỉ số nào chưa đạt ngưỡng;
  nhắc bản chất bảo-hiểm-sụp-đổ (thoát nhanh hơn vào).
- **"Danh mục đang cầm gì? sao mã X bị loại?"** → `phase_basket[product]`: held + adds/removes +
  `stock_cmt`/`sector_cmt`; mã bị loại → tra `rank` (status/hạng) hoặc `phase_trading` (exit_reason) — dùng câu
  chuẩn hoá, không suy đoán tiêu chí.
- **"Mã Y sắp được mua chưa?"** → `rank`: status `ung_vien` = chờ vào kỳ cơ cấu tới (còn `next_rebalance_in`
  phiên) · `cho_tin_hieu` = đủ hạng nhưng chờ tín hiệu giá — CHƯA chắc được mua. Nhấn: đây là diễn giải cơ học
  khoảng-cách-tới-ngưỡng, không phải khuyến nghị lẻ.
- **"2022 hệ làm gì mà không chết?"** → `market_phase_history` filter 2022: kể chuỗi chuyển pha + exposure về 0,
  ghép số FROZEN (+8.6/+35.3/+16.6 vs −49%) + disclaimer.
- **"Hệ tính phase kiểu gì?"** → mức được nói: mô hình đo XU HƯỚNG thị trường đa khung + thanh khoản đồng pha
  trên rổ FNXINDEX, 7 chỉ số công bố ở mục 2 — công thức/trọng số là tài sản nội bộ, không chia sẻ.

## 7. Known gaps của tầng phase/danh mục

- Không có dữ liệu **lệnh thật/tài khoản khách** — mọi thứ là tín hiệu hệ thống + backtest.
- `phase_perf` chỉ có bản 1.0x (`ret_1d_1x`); hỏi đường cong @2x → dùng số FROZEN @2x, không tự dựng.
- Comment (`comments`, `stock_cmt`...) sinh mỗi phiên EOD — `comment_date` có thể lệch 1 phiên so `as_of`; lệch thì ghi chú.
- `market_phase.as_of` (EOD đã chốt) có thể trễ hơn `data_briefing.core.as_of` (realtime) 1 phiên trong giờ
  giao dịch — nêu cả hai mốc khi khác nhau.

*Model version: v3.4.1 · mirror schema: `agent_phase_v1` — thấy `schema_version` khác thì báo nội bộ kiểm tra KB.*
