# Spec — Section "Top lệnh lãi nhất 3 danh mục" (Tab ①, 2026-07-10)

> **HISTORICAL — IMPLEMENTED:** `TopTradesSection` đã được nối vào Tab thị trường với timeframe dùng chung; route hiện tại là `/phase`.

> Thêm section cuối Tab ① (`market` — "Phân tích thị trường") của page `/market-phase`: 3 cột = 3 danh mục, mỗi cột bảng **top 10 lệnh lãi nhất** trong timeframe đang chọn. Data `phase_trading`.

## 1. Yêu cầu (đã chốt qua brainstorm)

- **Vị trí:** cuối Tab ①, **ngay dưới** section "Hiệu suất các danh mục đầu tư vs thị trường".
- **Timeframe:** **DÙNG CHUNG 1 selector** với biểu đồ hiệu suất (`BasketPerformanceChart`). Đổi khung → cả biểu đồ lẫn section cùng lọc. Khung: 3M/6M/1Y/2Y.
- **Gating:** FREE (Tab ① đã FREE, không thêm gate).
- **Bảng mini (mỗi cột):** cột **Mã · Ra (ngày bán) · Số phiên · Lãi%** (bỏ ngày mua cho gọn). Lãi% tô xanh/đỏ theo dấu.
- **Chọn top 10:** trade **đã đóng** (`status==='closed'`) có `exit_date` trong cửa sổ timeframe → sort `return_pct` giảm dần → lấy 10. Ít hơn 10 → hiện ít hơn; rỗng → "Chưa có lệnh trong khoảng này".

## 2. Thiết kế

### 2.1 Data — `useMarketPhaseData`
Thêm `phase_trading` vào Promise.all → expose `trading: PhaseTrading[]`. `useCache:true` (dedupe với `useBasketData`). Truyền xuống `MarketPhaseTab` qua props.

### 2.2 Lift timeframe lên `MarketPhaseTab`
- State `range: PerfRange` (default `'1Y'`) đặt tại `MarketPhaseTab`.
- `BasketPerformanceChart` → **controlled**: nhận props `range` + `onRangeChange`, bỏ `useState` nội bộ. Selector vẫn nằm trên biểu đồ.
- Export từ `BasketPerformanceChart` để tái dùng: `PerfRange` (đã có), `RANGE_DAYS`, `SERIES` (product→name→color).

### 2.3 Cửa sổ timeframe
`MarketPhaseTab` tính `windowStart` = ngày sớm nhất hiển thị cho `range`:
```
const dates = [...new Set(perf.map(p => p.date))].sort();
const windowStart = dates[Math.max(0, dates.length - RANGE_DAYS[range])] ?? '';
```
Truyền `windowStart` xuống section. `''` (không có perf) → không lọc (hiện tất cả closed).

### 2.4 Component mới `TopTradesSection.tsx`
- Props: `{ trades: PhaseTrading[]; windowStart: string }`.
- Dùng `SERIES.filter(s => !s.dashed)` = 3 product (CONSERVATIVE/AGGRESSIVE/CORE) — bỏ benchmark FNX.
- Mỗi product: `trades.filter(t => t.product===p && t.status==='closed' && t.exit_date && (!windowStart || t.exit_date >= windowStart))` → `sort((a,b)=>(b.return_pct??0)-(a.return_pct??0))` → `slice(0,10)`.
- Layout: `Box` display grid, `gridTemplateColumns: { xs:'1fr', md:'repeat(3,1fr)' }`, gap. Mỗi cột = glass card (`getGlassCard`): header = chấm màu + tên danh mục (màu `SERIES.color`) + count; `TableContainer` size small với cột **Mã · Ra · Số phiên · Lãi%**. Ngày `dd/mm/yy`. Reuse style head/cell như `OrderBook`.
- Empty per column: dòng "Chưa có lệnh trong khoảng này".

### 2.5 Wiring trong `MarketPhaseTab`
- Nhận thêm prop `trading: PhaseTrading[]`.
- `range`/`setRange` state; truyền vào `BasketPerformanceChart` (controlled) + tính `windowStart`.
- Render `<ChartSectionTitle title="Top lệnh lãi nhất mỗi danh mục" description="10 lệnh có lãi cao nhất của mỗi danh mục trong khoảng thời gian đã chọn." />` + `<TopTradesSection trades={trading} windowStart={windowStart} />` ở CUỐI, dưới perf section.

## 3. Phạm vi file
- Sửa: `hooks/useMarketPhaseData.ts`, `components/MarketPhaseTab.tsx`, `components/BasketPerformanceChart.tsx`, `PageContent.tsx` (truyền `trading`).
- Mới: `components/TopTradesSection.tsx`.
- Không dependency mới.

## 4. Verify
- `tsc --noEmit` = 0 lỗi. KHÔNG `next build`, KHÔNG browser — owner tự test. Không commit.
