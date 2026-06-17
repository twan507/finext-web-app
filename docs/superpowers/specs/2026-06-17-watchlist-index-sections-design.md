# Watchlist — thêm 2 section chỉ số (thị trường + ngành)

**Ngày:** 2026-06-17
**Trang:** `/watchlist` (`app/(main)/watchlist/`)

## Mục tiêu

Trên trang Danh sách theo dõi, thêm 2 khu vực thẻ chỉ số phía trên section watchlist
hiện có, để vừa xem cổ phiếu vừa xem chỉ số. Chia trang thành **3 section collapse được**:

```
Tiêu đề "Danh sách theo dõi"
├─ Section 1 ▾  CHỈ SỐ THỊ TRƯỜNG   → lưới 12 thẻ (cố định)
├─ Section 2 ▾  CHỈ SỐ NGÀNH        → lưới 24 thẻ (cố định)
└─ Section 3 ▾  DANH SÁCH THEO DÕI  → khối watchlist hiện tại (giữ nguyên)
```

2 section chỉ số **luôn hiển thị đủ** danh sách cố định (12 và 24), không thêm/bớt,
chỉ toggle collapse. Hiển thị dạng **lưới** (không theo từng watchlist như section CP).

## Danh sách mã cố định

**12 chỉ số thị trường:**
`VNINDEX, VN30, HNXINDEX, UPINDEX, LARGECAP, MIDCAP, SMALLCAP, ONDINH, SUKIEN, VUOTTROI, FNXINDEX, FNX100`

**24 ngành:**
`BANLE, BAOHIEM, BDS, CAOSU, CHUNGKHOAN, CONGNGHE, CONGNGHIEP, DAUKHI, DETMAY, DULICH, HOACHAT, KCN, KHOANGSAN, KIMLOAI, NGANHANG, NHUA, NONGNGHIEP, THUCPHAM, THUYSAN, TIENICH, VANTAI, VLXD, XAYDUNG, YTE`

**8 chỉ số Finext có trang chi tiết** (`INDEXES_WITH_DETAIL`):
`FNXINDEX, LARGECAP, MIDCAP, SMALLCAP, VUOTTROI, ONDINH, SUKIEN, FNX100`

## Thẻ chỉ số (IndexCard)

Dựng lại **đúng visual thẻ cổ phiếu** (`WatchlistColumn.renderStockRow`): nền gradient +
viền theo màu tăng/giảm, grid 3 cột × 2 hàng:

| | cột 1 | cột 2 (giữa) | cột 3 (phải) |
|---|---|---|---|
| hàng 1 | `mã` + icon chart | `%thay đổi` | `VSI` |
| hàng 2 | `giá` | `+/- điểm` | `GTGD` |

- **Khác thẻ CP:** bỏ nút xoá (X), không kéo-thả (danh sách cố định).
- Màu dùng `getTrendColor(pct_change*100, theme)` (chỉ số không có exchange).
- Cả thị trường lẫn ngành đều có đủ 6 ô (DB có vsi/trading_value cho mọi index). Ô nào
  thực sự thiếu giá trị → hiện `—` (theo format hiện có).
- Format: tái dùng đúng các formatter của `renderStockRow` (price/diff/pct/vsi/gtgd).

### Điều hướng
- **Tên:**
  - Thị trường thuộc 8 mã Finext → `/groups/{mã viết thường}`.
  - Thị trường big-4 (VNINDEX/VN30/HNXINDEX/UPINDEX) → không có trang chi tiết, tên không bấm được.
  - Ngành → `/sectors/{mã viết thường}`.
- **Icon chart** → `/charts/{mã viết thường}` cho mọi mã.

Logic chọn route nằm ở `IndexGrid`/parent (tính sẵn `detailHref?: string`), `IndexCard`
chỉ render — tách bạch dữ liệu/điều hướng khỏi trình bày.

## Data

- Thêm **1 subscription** trong `PageContent.tsx`:
  `useSseCache<IndexData[]>({ keyword: 'home_today_index', enabled: !!session })`.
- `home_today_index` (find_query `{}`) trả **toàn bộ** record `today_index` gồm cả 24 ngành
  (`type='industry'`), projection đã có sẵn `vsi, trading_value, breadth_*, diff, pct_change`.
- Build `indexDataMap: Map<code, IndexData>`; lọc theo 2 list cố định (bỏ qua record thừa
  như derivatives VN30F1M…).
- **Không đổi backend.**

`IndexData`: `{ ticker, ticker_name?, close, diff, pct_change, vsi?, trading_value?, type? }`.

## Component mới (đặt trong `watchlist/components/`)

1. **`CollapsibleSection.tsx`** — wrapper tái dùng cho cả 3 section.
   - Props: `{ title, storageKey, defaultOpen=true, children, headerRight? }`.
   - Header: chevron (▾/▸) + tiêu đề. Body collapse bằng `display:none` (theo pattern
     `WatchlistColumn`).
   - Trạng thái collapse lưu **localStorage** theo `storageKey`, mặc định **mở**.
2. **`IndexCard.tsx`** — 1 thẻ chỉ số (mô tả ở trên).
   - Props: `{ data?: IndexData, code, name, detailHref?, chartHref }`.
3. **`IndexGrid.tsx`** — lưới responsive map list mã → `IndexCard`.
   - `display:grid; gridTemplateColumns: repeat(auto-fill, minmax(~185px, 1fr)); gap`.
   - (Phone ~2 cột, tablet ~4, desktop ~6.)
4. **`indexSections.ts`** — hằng số: `MARKET_INDEX_CODES` (12), `INDUSTRY_CODES` (24),
   `INDEXES_WITH_DETAIL` (8). Tên hiển thị lấy từ `ticker_name` trong data (fallback = code).

## Thay đổi `PageContent.tsx`

- Thêm subscription + `indexDataMap` (cạnh `stockDataMap` hiện có).
- Trong nhánh render chính: chèn `<CollapsibleSection>` Section 1 + Section 2 (chứa
  `IndexGrid`) **trên** khối watchlist; bọc khối watchlist (page selector + columns) trong
  `<CollapsibleSection>` Section 3.
- 2 section chỉ số cũng hiển thị ở **empty-state** (0 watchlist) để người dùng mới vẫn thấy
  chỉ số.

## Ngoài phạm vi (không đụng)

- Toàn bộ logic watchlist columns: DnD, sort, add/remove mã, page, rename, move — giữ nguyên.
- `WatchlistColumn.tsx` không sửa (IndexCard là component riêng để không đụng code đang chạy).
- Backend không đổi.

## Tiêu chí hoàn thành (verify)

1. `npx tsc --noEmit` pass.
2. Trang watchlist hiện 3 section; cả 3 collapse/expand được; trạng thái collapse giữ qua
   reload (localStorage).
3. Section 1 đủ 12 thẻ, Section 2 đủ 24 thẻ, dạng lưới responsive; thẻ giống thẻ CP.
4. Thẻ hiện đúng giá/+/-/% /VSI/GTGD theo data SSE.
5. Bấm tên/icon điều hướng đúng (/groups, /sectors, /charts) theo quy tắc trên.
6. Section watchlist (3) hoạt động y như trước.
7. User tự test trực quan (theo [[feedback_ui_self_test]]).
