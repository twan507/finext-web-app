# Chat charts v2 — ECharts template registry (LLM fill-data) — Spec/Contract

> **Chốt (owner 2026-07-16):** thay `finext-widget` (4 loại + apexcharts) bằng **template dựng sẵn render bằng ECharts**; LLM CHỈ điền số vào khuôn mỏng (an toàn, ít lỗi, đa dạng). Owner duyệt mockup 12 loại × 3 biến thể (artifact 13a46c46). Engine = ECharts (LLM cách ly khỏi config lib). Nhánh: `feat/chart-echarts`.

## Nguyên tắc
- **Model KHÔNG nhả markup/config lib** — chỉ nhả JSON mỏng `{template, title?, ...data}`. FE map → ECharts option (giấu hết phần khó: trục/scale/legend/tooltip/theme).
- **Giữ fence `` ```finext-widget `` ** (MessageBubble.splitWidgets + sanitize._WIDGET_BLOCK_RE tái dùng, KHÔNG đổi). Chỉ đổi schema JSON bên trong.
- **An toàn:** whitelist `template`, coerce field lồng (như WidgetRenderer.normalize cũ), JSON hỏng / template lạ → fallback xám. ErrorBoundary giữ. ECharts option = data thuần, không eval/formatter nguy hiểm.
- **Theme:** lấy từ MUI `useTheme().palette` (`mode`, `text`, `divider`, `background`, `trend.up/down`, `component.chart.*`, `primary.main`) — khớp brand. Re-render khi mode đổi.
- **Lazy-load echarts** (dynamic import) — chỉ tải khi có chart. v1 dùng full `echarts` (không tree-shake — ưu tiên đúng trước, tối ưu bundle sau).

## Contract fill (model-facing) — 12 template + kpi
Mọi khối: fence ` ```finext-widget ` chứa JSON có `"template"`. Số = SỐ THẬT từ dữ liệu.

| template | Fill schema | Ghi chú |
|---|---|---|
| `line` | `{template:"line", title?, x?:[str], series:[{name, data:[num], dashed?:bool, area?:bool}]}` | ≤4 series. `dashed` cho đường tham chiếu (median/p25/p75). `area` = tô nền. |
| `area` | `{template:"area", title?, x?:[str], series:[{name, data:[num]}], stacked?:bool}` | = line area=true; `stacked` cho cơ cấu. |
| `bar` | `{template:"bar", title?, categories:[str], series:[{name, data:[num]}], stacked?:bool, diverging?:bool}` | cột dọc. `diverging`=tô xanh/đỏ theo dấu. `stacked`=chồng. |
| `bar_h` | `{template:"bar_h", title?, items:[{label, value:num, note?}]}` | thanh ngang xếp hạng, ≤20; tô xanh/đỏ theo dấu tự động. |
| `grouped_bar` | `{template:"grouped_bar", title?, categories:[str], series:[{name, data:[num]}]}` | nhóm cột, ≤4 series. |
| `pie` | `{template:"pie", title?, items:[{name, value:num}], donut?:bool, rose?:bool}` | tròn/vành, ≤10 phần. |
| `candlestick` | `{template:"candlestick", title?, dates:[str], ohlc:[[open,close,low,high],…], volume?:[num], ma?:{"MA20":[num],"MA50":[num]}}` | nến. `volume`→panel phụ. `ma`→đường trung bình. |
| `heatmap` | `{template:"heatmap", title?, xLabels:[str], yLabels:[str], data:[[xi,yi,val],…], min?, max?, diverging?:bool}` | `diverging`=đỏ-trắng-xanh; else theo brand. |
| `scatter` | `{template:"scatter", title?, xName?, yName?, points:[{name?, x:num, y:num, size?:num, group?}]}` | `size`→bubble; `group`→màu theo nhóm. |
| `treemap` | `{template:"treemap", title?, nodes:[{name, value:num, children?, color?}]}` | phân cấp. `color`=hex override (vd theo %). |
| `radar` | `{template:"radar", title?, indicators:[{name, max:num}], series:[{name, values:[num]}]}` | đa chỉ tiêu, ≤3 series. |
| `gauge` | `{template:"gauge", title?, value:num, min?:num, max?:num, unit?, zones?:[{to:num, color}]}` | đồng hồ 1 chỉ số. |
| `kpi` | `{template:"kpi", tiles:[{label, value:str, delta?:str, tone?:"up"\|"down"\|"flat", spark?:[num]}]}` | ô số CSS (không ECharts). `value` là CHUỖI đã format. `spark`→mini line. ≤6 ô. |

## File structure (FE, `app/(main)/chat/components/`)
- **Tạo** `chart/EChart.tsx` — client wrapper: `dynamic` import echarts, `echarts.init` vào ref, `setOption(option, true)`, `resize` on window + ResizeObserver, `dispose` on unmount, re-init khi `option` hoặc `mode` đổi. Height mặc định (prop).
- **Tạo** `chart/templates.ts` — `type ChartPalette` (từ MUI theme) + `chartPalette(theme)` + `buildOption(payload: unknown, p: ChartPalette): EChartsOption | null` (whitelist 12 template + coerce; trả null khi không dựng được) + 12 builder. Adapt config từ mockup: `scratchpad/chart-mockup-body.html` (đã có option builder cho mọi loại — coordinator cấp).
- **Tạo** `chart/KpiTiles.tsx` — render `kpi` (ô CSS, tone màu, delta, mini sparkline qua EChart nhỏ). Sửa lỗi cột cao (dùng flex, KHÔNG height cứng).
- **Sửa** `WidgetRenderer.tsx` — parse JSON → `template==="kpi"` ? `<KpiTiles>` : `buildOption` → `<EChart option>`. Giữ Fallback xám + ErrorBoundary. Bỏ import 4 widget cũ.
- **Xoá** `widgets/{BarList,GroupedBars,LineChart,StatTiles}.tsx` (thay hết; LineChart cũ dùng apexcharts — bỏ dùng apexcharts trong chat, KHÔNG gỡ dep apexcharts vì nơi khác còn dùng).
- **MessageBubble.tsx**: KHÔNG đổi (splitWidgets fence `finext-widget` giữ nguyên).
- **Test route TẠM** `app/(main)/chart-test/page.tsx` (hoặc route public tạm) render WidgetRenderer với payload mẫu của CẢ 12 template × biến thể → để Playwright chụp verify. XOÁ trước khi chốt.

## Backend (`finext-fastapi/app/agent/`)
- **Tạo** KB catalog `kb/agent_db_07.md` (hoặc chèn mục): liệt kê 12 template + `khi nào dùng` + fill schema + 1 ví dụ mỗi loại (nội dung = bảng trên, văn phong pack). Thêm vào manifest mục 13 system_prompt + read_kb tự expose (glob *.md).
- **Sửa** `system_prompt` mục 3b: thay 4 loại cũ → giới thiệu ngắn "vẽ được nhiều loại (đường/vùng/cột/thanh/nhóm/tròn/nến/heatmap/phân tán/treemap/radar/gauge/ô số) — xem `read_kb({doc:"agent_db_07"})` để biết khuôn fill từng loại + khi nào dùng" + giữ luật "PHẢI vẽ khi user yêu cầu" + "ĐÚNG BA backtick" + ví dụ 1 khối line.
- **sanitize.py**: fence `finext-widget` giữ nguyên → chừa-widget đã có, KHÔNG đổi. (Kiểm test_sanitize vẫn PASS với schema mới — schema nằm trong fence nên không bị đụng.)

## Verify (test kĩ — owner yêu cầu)
1. `cd finext-nextjs && npx tsc --noEmit` = 0 lỗi.
2. **Playwright render** `/chart-test` (next dev) chụp cả light+dark → coordinator xem ảnh, mọi template render đúng, không tràn/lỗi. Iterate tới sạch.
3. **Live**: chạy agent qua M3 với câu yêu cầu vẽ (nhiều loại) → model nhả `finext-widget` template hợp lệ, sanitize giữ fence, render OK.
4. `cd finext-fastapi && uv run pytest -q` vẫn PASS (sanitize/context không vỡ).
5. Xoá route test, tsc lại, commit.

## Ngoài scope v1
Tree-shake echarts (bundle) · candle interactive nâng cao · streaming widget partial (giữ skeleton fence-chưa-đóng như cũ).
