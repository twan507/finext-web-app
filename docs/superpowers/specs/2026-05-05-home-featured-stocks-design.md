# Home — Featured Stocks Section Design

**Date:** 2026-05-05
**Status:** Approved (brainstorming) — pending implementation plan
**Owner:** finext.vn@gmail.com

---

## 1. Mục tiêu

Thêm một section mới trên trang chủ (`/`, file `app/(main)/home/PageContent.tsx`) hiển thị **Top 10 cổ phiếu có dòng tiền vào mạnh** và **Top 10 cổ phiếu có dòng tiền ra mạnh**, dạng bảng 10 cột (giống bảng ở `/groups/[groupId]`), bọc trong carousel 2 slide.

Vị trí: ngay sau Section 1.5 "Diễn biến thị trường" (`MarketVolatility`), trước Section 3 "Ngành" (`IndustrySection`).

Section công khai cho mọi user (không gate auth).

---

## 2. Quyết định thiết kế đã chốt

| # | Quyết định |
|---|---|
| Score sort | `t0_score × min(vsi, 2)` (cap vsi ở 2 = 200%) |
| Filter universe | `vsi < 5 && vsma5 > 500_000` (đồng nhất `MarketVolatility`) |
| Phạm vi tickers | Toàn bộ Finext universe (`FNXINDEX` — mọi stocks Finext theo dõi) |
| Top vào | Sort `score` desc, lấy 10 mã đầu |
| Top ra | Sort `score` asc, lấy 10 mã đầu |
| Cấu trúc UI | Carousel 2 slide × 10 dòng, autoplay 10s |
| Auth | Công khai cho mọi user |

---

## 3. Approach (đã chọn)

**Approach 1 — Reuse `GroupStockTable` + section wrapper mới.**

Lý do chọn:
- Bảng 10 cột yêu cầu khớp 100% với `GroupStockTable` hiện có ở `app/(main)/groups/[groupId]/components/GroupStockTable.tsx` (cùng cột, cùng format, cùng sort, cùng responsive rules).
- Codebase đã có pattern cross-import giữa các route trong `(main)`: ví dụ `groups/[groupId]/PageContent.tsx` đã import `IndexDetailPanel` và `MarketIndexChart` từ `home/components/marketSection/`.
- Tránh duplicate ~500 LOC logic format/color/sort.
- Tuân thủ "Surgical Changes" trong `CLAUDE.md`: không sửa `GroupStockTable`, không refactor sang shared location.

Reject:
- Approach 2 (move `GroupStockTable` lên `components/common/`): vi phạm Surgical Changes, phải đụng `groups/[groupId]/PageContent.tsx`.
- Approach 3 (tạo bảng mới hoàn toàn): vi phạm Simplicity First, ~500 LOC duplicate.

---

## 4. File changes

**File mới (1 file):**

```
finext-nextjs/app/(main)/home/components/featuredStocks/
└── FeaturedStocksSection.tsx     (~140 LOC)
```

**File sửa (1 file):**

```
finext-nextjs/app/(main)/home/PageContent.tsx
  - Dynamic import FeaturedStocksSection (theo pattern các section khác)
  - Render <FeaturedStocksSection ... /> trong 1 <Box> giữa Section 1.5 và Section 3
```

**File KHÔNG sửa:**
- `app/(main)/groups/[groupId]/components/GroupStockTable.tsx` — chỉ cross-import, không thay đổi behavior để tránh regression `/groups/[groupId]`.

**Cross-import:**

```ts
import GroupStockTable, { GroupStockRowData }
    from '../../../groups/[groupId]/components/GroupStockTable';
```

---

## 5. Data flow

`PageContent.tsx` đã có sẵn state `todayStockData` (từ SSE `home_today_stock`, LUỒNG 4) và `isStockDataLoading`. Truyền thẳng xuống `FeaturedStocksSection` mà không cần fetch thêm:

```tsx
<FeaturedStocksSection
    stockData={todayStockData}
    isLoading={isStockDataLoading}
/>
```

Bên trong section:

```ts
const SCORE_VSI_CAP = 2;

// Dedupe theo ticker (SSE có thể gửi trùng) — pattern lấy từ MarketVolatility:313-316
const deduped = stockData.reduce<Record<string, StockData>>((acc, s) => {
    acc[s.ticker] = s;
    return acc;
}, {});

// Filter thanh khoản — đồng nhất MarketVolatility:317
const filtered = Object.values(deduped).filter(
    s => (s.vsi || 0) < 5 && (s.vsma5 || 0) > 500_000
);

const getScore = (s: StockData) =>
    (s.t0_score || 0) * Math.min(s.vsi || 0, SCORE_VSI_CAP);

const topInflow = [...filtered]
    .sort((a, b) => getScore(b) - getScore(a))
    .slice(0, 10)
    .map(toRowData);

const topOutflow = [...filtered]
    .sort((a, b) => getScore(a) - getScore(b))
    .slice(0, 10)
    .map(toRowData);
```

Ghi chú:
- Không filter `t0_score > 0` ở `topInflow`: score đã âm/dương theo `t0_score` và sort sẽ tự đẩy âm xuống cuối. Tương tự `topOutflow`.
- `toRowData(s: StockData): GroupStockRowData` chỉ pick các field cần: `ticker`, `close`, `diff`, `pct_change`, `industry_name`, `category_name`, `marketcap_name`, `t0_score`, `t5_score`, `vsi`, `exchange`.
- Type `StockData` import từ `home/components/marketSection/MarketVolatility.tsx` (đã export).

---

## 6. UI layout

```tsx
<Box sx={{ mt: 5 }}>
  <ChartSectionTitle
    title="Cổ phiếu nổi bật"
    description="Top 10 cổ phiếu có dòng tiền vào và ra mạnh nhất phiên hôm nay."
    updateTime={updateTime}     // dùng useMarketUpdateTime()
    sx={{ mb: 2 }}
  />

  <Card sx={cardStyle}>          // getGlassCard pattern, đồng nhất MarketVolatility
    <Box sx={{ px: 2, pt: 2, pb: 1 }}>
      <Carousel
        slides={isLoading ? skeletonSlides : [inflowSlide, outflowSlide]}
        autoPlayInterval={isLoading ? 0 : 10000}  // = STOCKS_INTERVAL của MarketVolatility
        minHeight="auto"
        height="100%"
      />
    </Box>
  </Card>
</Box>
```

**Mỗi slide:**

```tsx
{
  id: 'top-inflow',
  component: (
    <Box>
      <Typography sx={{
          fontSize: getResponsiveFontSize('h6'),
          fontWeight: fontWeight.semibold,
          color: theme.palette.trend.up,            // xanh cho vào, đỏ cho ra
          mb: 1.5
      }}>
          Top dòng tiền vào mạnh
      </Typography>
      <GroupStockTable
          data={topInflow}
          isLoading={false}
          skeletonRows={10}
      />
    </Box>
  )
}
```

**Skeleton state:** 1 slide skeleton dùng `<GroupStockTable data={[]} isLoading skeletonRows={10} />`.

**Responsive:** đã handle bởi `GroupStockTable`:
- Mobile (xs): hiện `Mã CP / Giá / +/- / % / Thanh khoản`.
- Tablet (md): thêm `Dòng tiền phiên / Dòng tiền tuần`.
- Desktop (lg+): full 10 cột.

Section wrapper không cần custom responsive.

**Carousel auto-play:** 10s (cùng `STOCKS_INTERVAL` MarketVolatility) để feel nhất quán; user có thể stop bằng dot navigation/swipe.

---

## 7. Edge cases

| Case | Handling |
|---|---|
| `stockData = []` (chưa load) | `isLoading=true` → skeleton 10 dòng × 2 slide |
| `stockData` đã load nhưng filter rỗng | Render slide với `data=[]` → `GroupStockTable` đã có empty state "Không có dữ liệu" sẵn |
| Score = 0 cho nhiều mã (đầu phiên) | Sort vẫn deterministic (slice top 10), không cần handle riêng |
| SSE gửi data trùng ticker | `deduped` dictionary đã xử lý (giữ record cuối) |
| `vsi` hoặc `t0_score` = `undefined` | `(s.vsi \|\| 0)` và `(s.t0_score \|\| 0)` → score = 0, rớt khỏi top |

Không thêm error boundary mới: lỗi data lan ra cấp PageContent đã đủ.

Không gọi API mới: tái dùng 100% `todayStockData` đã có.

---

## 8. Verification criteria

1. **Build pass:** `npm run build` trong `finext-nextjs/` không lỗi TS.
2. **Render check (manual trên dev server):**
   - Section xuất hiện đúng vị trí: dưới "Diễn biến thị trường", trên "Ngành".
   - Carousel hiển thị 2 slide, autoplay 10s, dot/swipe chuyển slide.
   - Slide 1: title xanh "Top dòng tiền vào mạnh", 10 mã có `t0_score × min(vsi,2)` lớn nhất.
   - Slide 2: title đỏ "Top dòng tiền ra mạnh", 10 mã có score nhỏ nhất.
   - Bảng có 10 cột giống ảnh tham khảo; format số / màu / sort đồng nhất với `/groups/[groupId]`.
   - Skeleton 10 dòng khi `isStockDataLoading=true`.
3. **Responsive check** (xs / md / lg+).
4. **Click ticker** → `/stocks/{ticker}`; **click icon chart** → `/charts/{ticker}` (`GroupStockTable` đã handle).
5. **Regression check:** `/groups/[groupId]` không thay đổi behavior (vì `GroupStockTable` không bị sửa).

Không viết unit test mới: codebase home không có test framework setup hiện tại.

---

## 9. Out of scope

- Không tạo API endpoint mới.
- Không sửa `GroupStockTable` (kể cả khi muốn config column visibility).
- Không thêm filter UI / time-range selector cho section này (chỉ phiên hôm nay).
- Không link section này vào header navigation.
