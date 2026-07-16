# agent_db_07 — Catalog Biểu Đồ (ECharts template · model điền số)

Tài liệu này liệt kê **12 loại biểu đồ + 1 khối ô số (kpi)** mà bạn vẽ được ngay trong câu trả lời. Nạp khi cần
VẼ: xem loại nào hợp, khuôn điền ra sao, ví dụ mẫu. FE dựng sẵn hình (trục/màu/legend/theme) — bạn CHỈ nhả JSON
mỏng `{template, ...số}`, không nhả markup/config thư viện.

**Luật nền (system prompt mục 3b + 15):** user yêu cầu vẽ → PHẢI vẽ, không từ chối · số là SỐ THẬT từ dữ liệu
(thiếu thì query thêm rồi vẽ, KHÔNG bịa) · nhãn (`title`/`label`/`name`) áp K-hygiene mục 15 — không lộ mã nội bộ.

---

## 0. Cú pháp fence — sai một ly là FE không render

Mỗi biểu đồ là MỘT khối:
- Mở bằng một dòng **ĐÚNG BA dấu backtick** liền nhau + `finext-widget` (không khoảng trắng chen giữa).
- Các dòng JSON — bắt buộc có `"template"` là một trong 13 tên dưới.
- Đóng bằng một dòng **ĐÚNG BA dấu backtick**.

FE chỉ render khi **đúng ba backtick**. Hai backtick, bốn backtick, hay quên `"template"` → hiện khối xám (mất
đẹp), KHÔNG ra hình. JSON phải hợp lệ. Ví dụ tối thiểu (giữ y hệt số backtick):

```finext-widget
{"template":"line","title":"P/E toàn thị trường 5 năm","x":["2021","2022","2023","2024","2025"],"series":[{"name":"P/E","data":[17.4,10.5,12.8,13.9,14.2]}]}
```

**Quy ước chung cho MỌI template:**
- Số trong `data`/`value`/`ohlc`… là **số thuần** (`13.29`, không phải chuỗi `"13,29 lần"`). Riêng `kpi.tiles.value`
  là CHUỖI đã format sẵn (xem mục 13).
- Tên field trong khuôn (`series`, `categories`, `items`…) là input kỹ thuật — cứ dùng đúng. Nhưng nội dung
  `title`/`label`/`name`/`note` là chữ HIỂN THỊ cho khách → ngôn ngữ tự nhiên, sạch mã nội bộ (mục 15). Mã cổ
  phiếu công khai (FPT, VCB, HPG…) và nhãn pha (UPTREND…) được dùng nguyên văn.
- Luôn kèm diễn giải bằng chữ bên cạnh biểu đồ — hình minh hoạ, không thay lời phân tích.
- Field có dấu `?` trong khuôn là tuỳ chọn, bỏ được. Tôn trọng trần số phần tử ghi ở từng loại.

---

## 1. `line` — đường (chuỗi thời gian)

**Khi nào dùng:** 1 chỉ số biến động qua thời gian — giá/định giá (P/E, P/B) qua các năm/tuần, VNINDEX theo phiên.
Thêm đường `dashed` làm mốc tham chiếu (trung vị / p25 / p75 lịch sử) để thấy "đang đắt hay rẻ so quá khứ".

**Khuôn:** `{template:"line", title?, x?:[str], series:[{name, data:[num], dashed?:bool, area?:bool}]}` — ≤4 đường.
`x` là nhãn trục hoành (bỏ qua thì đánh số 1,2,3…). `dashed`=đường đứt (mốc tham chiếu). `area`=tô nền dưới đường.

```finext-widget
{"template":"line","title":"P/E toàn thị trường 5 năm","x":["2021","2022","2023","2024","2025"],"series":[{"name":"P/E","data":[17.4,10.5,12.8,13.9,14.2]},{"name":"Trung vị 5 năm","data":[13.6,13.6,13.6,13.6,13.6],"dashed":true}]}
```

## 2. `area` — vùng (đường tô nền / cơ cấu chồng)

**Khi nào dùng:** như `line` nhưng nhấn khối lượng/độ lớn (dùng 1 series tô nền); hoặc `stacked` để thể hiện
**cơ cấu thay đổi theo thời gian** (dòng tiền theo nhóm vốn hoá qua các phiên, tỷ trọng ngành qua thời gian).

**Khuôn:** `{template:"area", title?, x?:[str], series:[{name, data:[num]}], stacked?:bool}` — ≤4 series.
`stacked:true`=các series chồng lên nhau thành tổng.

```finext-widget
{"template":"area","title":"Giá trị giao dịch theo nhóm vốn hoá (tỷ đồng)","x":["T2","T3","T4","T5","T6"],"series":[{"name":"Vốn hoá lớn","data":[9200,8800,10100,9600,11200]},{"name":"Vốn hoá vừa","data":[5100,4800,5400,5000,5600]},{"name":"Vốn hoá nhỏ","data":[3200,3000,3300,3100,3400]}],"stacked":true}
```

## 3. `bar` — cột dọc

**Khi nào dùng:** so sánh giá trị rời rạc theo hạng mục — thay đổi giá các ngành trong 1 phiên, EPS theo quý.
`diverging` (1 series) tự tô xanh cho số dương / đỏ cho số âm — hợp cho biến động ±. `stacked` để chồng cơ cấu.

**Khuôn:** `{template:"bar", title?, categories:[str], series:[{name, data:[num]}], stacked?:bool, diverging?:bool}`
— ≤4 series. `diverging` chỉ có tác dụng khi đúng 1 series.

```finext-widget
{"template":"bar","title":"Thay đổi giá theo ngành phiên hôm nay (%)","categories":["Ngân hàng","Chứng khoán","Thép","BĐS","Bán lẻ","Dầu khí"],"series":[{"name":"% thay đổi","data":[1.2,2.4,-0.8,-1.5,0.6,-0.3]}],"diverging":true}
```

## 4. `bar_h` — thanh ngang xếp hạng

**Khi nào dùng:** **xếp hạng** nhiều mã/ngành theo MỘT tiêu chí — mua/bán ròng khối ngoại, điểm dòng tiền tuần,
top tăng/giảm giá. Tự sắp lớn nhất trên cùng, tự tô xanh/đỏ theo dấu. Loại chủ lực cho câu "xếp hạng / top".

**Khuôn:** `{template:"bar_h", title?, items:[{label, value:num, note?}]}` — ≤20 thanh. `value` âm/dương đều được.

```finext-widget
{"template":"bar_h","title":"Mua/bán ròng khối ngoại tuần (tỷ đồng)","items":[{"label":"FPT","value":420},{"label":"MWG","value":215},{"label":"HPG","value":90},{"label":"VNM","value":-140},{"label":"VHM","value":-310}]}
```

## 5. `grouped_bar` — nhóm cột

**Khi nào dùng:** so **nhiều đối tượng × nhiều chỉ tiêu** cạnh nhau — vài mã ngân hàng trên P/E và P/B, doanh
thu vài quý của nhiều mã. Khác `bar_h` (1 tiêu chí, nhiều mã) ở chỗ đây gộp nhiều tiêu chí cho mỗi nhóm.

**Khuôn:** `{template:"grouped_bar", title?, categories:[str], series:[{name, data:[num]}]}` — ≤4 series;
`categories` là các nhóm (mã), mỗi `series` là một chỉ tiêu, `data` khớp thứ tự `categories`.

```finext-widget
{"template":"grouped_bar","title":"So sánh định giá nhóm ngân hàng","categories":["VCB","BID","CTG","TCB"],"series":[{"name":"P/E","data":[15.2,12.8,9.5,7.8]},{"name":"P/B","data":[2.6,2.1,1.5,1.2]}]}
```

## 6. `pie` — tròn / vành

**Khi nào dùng:** **tỷ trọng cơ cấu** (phần của một tổng) — cơ cấu vốn hoá theo ngành, phân bổ danh mục, tỷ trọng
GTGD theo nhóm. `donut`=vành rỗng giữa. `rose`=hoa hồng (bán kính theo giá trị). Không dùng khi >10 phần.

**Khuôn:** `{template:"pie", title?, items:[{name, value:num, tone?:"up"|"down"|"flat"}], donut?:bool, rose?:bool}` — ≤10 phần. Với dữ liệu độ rộng (Tăng/Giảm/Đứng) đặt `tone` để tô đúng màu (Tăng→xanh, Giảm→đỏ, Đứng→vàng); tên phần bắt đầu bằng "Tăng/Giảm/Đứng" cũng tự nhận màu.

```finext-widget
{"template":"pie","title":"Cơ cấu vốn hoá thị trường theo nhóm ngành","items":[{"name":"Ngân hàng","value":34},{"name":"BĐS","value":18},{"name":"Chứng khoán","value":9},{"name":"Thép","value":7},{"name":"Bán lẻ","value":6},{"name":"Ngành khác","value":26}],"donut":true}
```

## 7. `heatmap` — bản đồ nhiệt

**Khi nào dùng:** ma trận 2 chiều — ví dụ điểm dòng tiền theo **ngành × phiên**, hiệu suất tháng × năm. Đọc nhanh
"ô nào nóng/lạnh". `diverging`=thang đỏ–trắng–xanh (hợp cho số có âm/dương quanh 0).

**Khuôn:** `{template:"heatmap", title?, xLabels:[str], yLabels:[str], data:[[xi,yi,val],…], min?, max?, diverging?:bool}`.
Mỗi ô là `[chỉ-số-trong-xLabels, chỉ-số-trong-yLabels, giá-trị]` (đánh số từ 0). `min`/`max` cố định thang nếu muốn.

```finext-widget
{"template":"heatmap","title":"Điểm dòng tiền ngành 3 phiên","xLabels":["T4","T5","T6"],"yLabels":["Ngân hàng","Thép","BĐS"],"data":[[0,0,32],[1,0,45],[2,0,51],[0,1,-12],[1,1,-4],[2,1,8],[0,2,-28],[1,2,-19],[2,2,-9]],"diverging":true}
```

## 8. `scatter` — phân tán / bong bóng

**Khi nào dùng:** quan hệ giữa 2 biến của nhiều mã — P/E vs ROE, tăng trưởng vs định giá. `size` biến điểm thành
bong bóng (vd theo vốn hoá); `group` tô màu theo nhóm (ngành) và hiện chú thích.

**Khuôn:** `{template:"scatter", title?, xName?, yName?, points:[{name?, x:num, y:num, size?:num, group?}]}`.
`xName`/`yName` là nhãn trục. `name` hiện khi ít điểm.

```finext-widget
{"template":"scatter","title":"Định giá và hiệu quả nhóm ngân hàng","xName":"P/E (lần)","yName":"ROE (%)","points":[{"name":"VCB","x":15.2,"y":21,"size":520,"group":"Quốc doanh"},{"name":"CTG","x":9.5,"y":17,"size":280,"group":"Quốc doanh"},{"name":"TCB","x":7.8,"y":15,"size":190,"group":"Tư nhân"},{"name":"VPB","x":8.9,"y":13,"size":160,"group":"Tư nhân"}]}
```

## 9. `treemap` — cây ô phân cấp

**Khi nào dùng:** cơ cấu **phân cấp + kích thước** — bản đồ vốn hoá ngành → mã (ô to = vốn hoá lớn), phân rã danh
mục. `color` (hex) override màu từng ô, ví dụ tô theo % tăng/giảm giá phiên.

**Khuôn:** `{template:"treemap", title?, nodes:[{name, value:num, children?, color?}]}`. Nút có `children` thì
bỏ `value` (tự cộng con); nút lá cần `value`. Lồng tối đa vài tầng.

```finext-widget
{"template":"treemap","title":"Bản đồ vốn hoá theo ngành","nodes":[{"name":"Ngân hàng","children":[{"name":"VCB","value":520,"color":"#16a34a"},{"name":"BID","value":260,"color":"#16a34a"},{"name":"CTG","value":210,"color":"#ef4444"}]},{"name":"BĐS","children":[{"name":"VHM","value":230,"color":"#ef4444"},{"name":"VIC","value":180,"color":"#16a34a"}]},{"name":"Thép","children":[{"name":"HPG","value":190,"color":"#16a34a"}]}]}
```

## 10. `radar` — mạng nhện đa chỉ tiêu

**Khi nào dùng:** hồ sơ nhiều tiêu chí cho 1–3 đối tượng — so điểm dòng tiền/kỹ thuật/định giá/tăng trưởng của
vài mã, chân dung sức khoẻ một mã trên nhiều lăng kính. Cần ≥3 chỉ tiêu.

**Khuôn:** `{template:"radar", title?, indicators:[{name, max:num}], series:[{name, values:[num]}]}` — ≤3 series.
`indicators` là các trục (kèm giá trị `max` để chuẩn hoá); `series.values` khớp thứ tự `indicators`.

```finext-widget
{"template":"radar","title":"Hồ sơ điểm số FPT vs MWG","indicators":[{"name":"Dòng tiền","max":100},{"name":"Kỹ thuật","max":100},{"name":"Định giá","max":100},{"name":"Tăng trưởng","max":100},{"name":"Thanh khoản","max":100}],"series":[{"name":"FPT","values":[82,75,60,88,90]},{"name":"MWG","values":[68,80,55,72,78]}]}
```

## 11. `gauge` — đồng hồ 1 chỉ số

**Khi nào dùng:** một chỉ số duy nhất trên thang có ngưỡng — tỷ lệ mã trên xu hướng, mức độ tham gia thị trường,
tỷ lệ nắm giữ gợi ý. `zones` chia dải màu theo ngưỡng (đỏ/vàng/xanh) để đọc nhanh "đang ở vùng nào".

**Khuôn:** `{template:"gauge", title?, value:num, min?:num, max?:num, unit?, zones?:[{to:num, color}]}`.
`zones` sắp theo `to` tăng dần, dải cuối phủ hết tới `max`.

```finext-widget
{"template":"gauge","title":"Tỷ lệ mã trên xu hướng tuần","value":62,"min":0,"max":100,"unit":"%","zones":[{"to":33,"color":"#ef4444"},{"to":66,"color":"#f59e0b"},{"to":100,"color":"#16a34a"}]}
```

## 12. `kpi` — hàng ô số nhấn mạnh

**Khi nào dùng:** 3–6 con số cốt lõi cần bật lên (không phải chuỗi/quan hệ) — snapshot thị trường, bộ chỉ số một
mã. Không phải biểu đồ ECharts mà là các ô CSS; `spark` vẽ mini-đường xu hướng trong ô.

**Khuôn:** `{template:"kpi", tiles:[{label, value:str, delta?:str, tone?:"up"|"down"|"flat", spark?:[num]}]}` — ≤6 ô.
⚠ `value` và `delta` là **CHUỖI đã format sẵn** (`"1.776,89"`, `"-0,29%"`) — khác mọi template trên (số thuần).
`tone` chọn màu: `up` xanh · `down` đỏ · `flat` trung tính.

```finext-widget
{"template":"kpi","tiles":[{"label":"VNINDEX","value":"1.776,89","delta":"-0,29%","tone":"down","spark":[1782,1779,1780,1777,1777]},{"label":"Giá trị giao dịch","value":"18.400 tỷ","delta":"+5,2%","tone":"up"},{"label":"Khối ngoại","value":"+320 tỷ","delta":"mua ròng","tone":"up"},{"label":"Độ rộng","value":"127/171","delta":"tăng/giảm","tone":"down"}]}
```

---

## Bảng tra nhanh — muốn thể hiện gì → template nào

| Muốn thể hiện | Template |
|---|---|
| 1 chỉ số biến động qua thời gian (giá, P/E theo năm/tuần) | `line` (thêm `area:true` nếu muốn tô nền) |
| Cơ cấu thay đổi theo thời gian (dòng tiền theo nhóm qua phiên) | `area` + `stacked:true` |
| So giá trị theo hạng mục, có số âm/dương | `bar` + `diverging:true` |
| Xếp hạng nhiều mã/ngành theo 1 tiêu chí (top, ròng khối ngoại) | `bar_h` |
| So nhiều mã × nhiều chỉ tiêu cạnh nhau | `grouped_bar` |
| Tỷ trọng cơ cấu (phần của một tổng) | `pie` (`donut`/`rose` tuỳ chọn) |
| Ma trận 2 chiều (ngành × phiên, tháng × năm) | `heatmap` |
| Quan hệ giữa 2 biến của nhiều mã (P/E vs ROE) | `scatter` |
| Cơ cấu phân cấp + kích thước (vốn hoá ngành → mã) | `treemap` |
| Hồ sơ đa tiêu chí, so 1–3 đối tượng | `radar` |
| Một chỉ số trên thang có ngưỡng màu | `gauge` |
| 3–6 con số cốt lõi cần nhấn mạnh | `kpi` |
