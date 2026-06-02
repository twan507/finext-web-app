# 04 — Frontend (`finext-nextjs`)

> Stack, route map App Router, mô tả từng trang, modules hỗ trợ và tối ưu UX.

---

## 4.1 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.5.x (App Router + Turbopack) |
| Runtime | React 19 |
| Language | TypeScript 5.7 **strict mode** |
| UI | MUI 7.1 (Material) + Emotion |
| Icons | `@mui/icons-material`, `@iconify/react` |
| Charts | `lightweight-charts` 5 (candlestick + custom primitive), `apexcharts` 5 + `react-apexcharts` (bar/line tài chính) |
| Data fetching | TanStack Query v5 + custom `apiClient` |
| Realtime | SSE (`sseClient.ts`) + polling fallback |
| Auth | JWT + `@react-oauth/google` (UI hiện disabled) |
| Drag & drop | `@dnd-kit/core`, `/sortable`, `/utilities` (watchlist reorder) |
| Theming | `next-themes` (light/dark + persist) |
| Date | `date-fns` 4 |
| URL parse | `query-string` |
| Test | Playwright |

---

## 4.2 Bố Cục Route (App Router)

```
finext-nextjs/app/
├── layout.tsx                   # Root — providers, metadata, JSON-LD, fonts, PWA
├── globals.css
├── manifest.ts                  # PWA manifest
├── robots.ts, sitemap.ts        # SEO
├── QueryProvider.tsx
├── (auth)/                      # Route group — không có main layout
│   ├── login/
│   ├── register/
│   ├── forgot-password/
│   └── components/
├── (main)/                      # Route group — public app, có header/sidebar/footer
│   ├── layout.tsx + LayoutContent.tsx
│   ├── page.tsx + home/         # Trang chủ
│   ├── markets/, stocks/[symbol]/, charts/[id]/
│   ├── sectors/[sectorId]/, groups/[groupId]/
│   ├── commodities/, international/, macro/
│   ├── news/, news/[articleId]/, news/category/, news/type/[type]/
│   ├── reports/, reports/[reportId]/, reports/type/[type]/
│   ├── watchlist/
│   ├── guides/{overview,stock-screener,charts-watchlist}/
│   ├── plans/, open-account/, policies/{privacy,content,disclaimer}/
│   ├── support/{email,live-chat,consultation}/
│   └── profile/{information,change-password,login-sessions,subscriptions}/
├── admin/                       # Admin area (role admin/manager/broker)
│   ├── layout.tsx + LayoutContent.tsx
│   ├── dashboard/, users/, roles/, permissions/, sessions/
│   ├── features/, licenses/, subscriptions/, transactions/
│   ├── brokers/, promotions/, otps/, watchlists/
│   ├── components/, hooks/
└── auth/google/                 # Callback Google OAuth (route 403 sau pivot)
```

> ⚠️ Routes bị 403 qua middleware: `/open-account`, `/profile/subscriptions`, `/auth/google/callback`. Danh sách trong [`lib/blocked-routes.ts`](../../finext-nextjs/lib/blocked-routes.ts).

---

## 4.3 Mô Tả Từng Trang

### 4.3.1 Auth — `(auth)/`

| Route | Mô tả |
|-------|-------|
| `/login` | Đăng nhập email + mật khẩu. Nút Google OAuth bị wrap `{false && ...}`. Link tới `/forgot-password` và `/register`. |
| `/register` | Đăng ký bằng email + mật khẩu. **Sau pivot:** bỏ OTP step → success Alert + nút "Quay lại đăng nhập" (chờ admin approve). |
| `/forgot-password` | Reset mật khẩu qua OTP; cũng là điểm vào cho **passwordless login** (`/auth/login-otp`). |

### 4.3.2 Main App — `(main)/`

#### Trang chủ — `/` (`home/PageContent.tsx`)
- Hero/welcome.
- **Market Index Overview** — VN-Index, VN30, HNX-Index realtime (`MarketIndexChart`, `IndexDetailPanel`).
- **Market Volatility** — top tăng / giảm / khối lượng cao (3 tab).
- **Featured Stocks** *(2026-05-05)* — carousel 2 slide: top 10 mã có dòng tiền vào / ra. Tái sử dụng `GroupStockTable`. Autoplay 10s.
- **Industry Section** — top nhóm ngành theo strength.
- **News Feed** + **Reports Carousel**.
- **ConsultationSection** *(post-pivot)* — CTA "Gia nhập cộng đồng" → Zalo group `https://zalo.me/g/rvogov075` (tab mới).
- Nguồn dữ liệu: SSE `home_today_stock`, REST qua TanStack Query.
- ⚠️ `document.title = "Trang chủ | Finext"` set bằng `useEffect` (override) — UX có chủ ý, **KHÔNG xóa**.

#### `/markets`
Tổng quan thị trường: chỉ số chính, định giá tổng (P/E, P/B, dividend yield), độ rộng (advance/decline), xoay vòng nhóm ngành (heatmap), chu kỳ thị trường. ISR ~5 phút.

#### `/stocks` — **Stock Screener**
Đa tiêu chí, cấu hình trong [`screenerConfig.ts`](../../finext-nextjs/app/(main)/stocks/screenerConfig.ts). Tiêu chí: kỹ thuật (RSI, MACD, MA cross), cơ bản (P/E, P/B, ROE, EPS growth), thanh khoản, vốn hóa. Bảng kết quả có sort/search, thao tác watchlist inline.

#### `/stocks/[symbol]` — Chi tiết mã
- Header giá realtime.
- Tab biểu đồ (lightweight-charts).
- Tab tài chính (`StockFinancialsFocusChart` + `StockFinancialsSection`) — **chọn kỳ click vào bar** *(2026-04-16)*.
- Tab tin tức theo mã.
- View mode store [`viewModeStore.ts`](../../finext-nextjs/app/(main)/stocks/[symbol]/viewModeStore.ts) (2026-05-07).
- `StockInfoSection` + `StockKeyMetricsPanel` enhanced metrics display (2026-05-07).
- ISR ~30 phút.

#### `/charts/[id]` — Workspace Biểu Đồ Kỹ Thuật
Toàn màn hình, tích hợp:
- Nến Nhật, volume, các chỉ báo (MA, RSI, MACD, Bollinger…) qua `IndicatorsPanel`.
- `BandFillPrimitive.ts` — custom primitive cho lightweight-charts (vẽ vùng).
- `aggregateTimeframe.ts` — gộp candle theo khung thời gian.
- **Warmup chỉ báo cho mã mới niêm yết**: `PageContent.tsx` trim leading candles có `close=0`; `CandlestickChart.tsx::extractFieldData` skip N điểm đầu cho mỗi chỉ báo (MA{n} = n, prefix `w_/m_/q_/y_` = 5/20/60/240, quy đổi theo timeframe 1W/1M) → tránh đường MA dốc đứng từ ngày 1.
- Side-panel: `WatchlistPanel`, `DetailPanel`, `PanelNewsList`.
- `ChartToolbar` — chọn timeframe, indicator, công cụ vẽ.
- Lưu mã đang xem qua store (URL `[id]`).
- State: `useChartStore` ([`hooks/useChartStore.ts`](../../finext-nextjs/hooks/useChartStore.ts)).

#### `/sectors`
Bảng xếp hạng strength của ~25 nhóm ngành, heatmap rotation.

#### `/sectors/[sectorId]`
Chi tiết ngành: composition, trend doanh thu/lợi nhuận/ROE (`FinancialsFocusChart` + `FinancialsSection` — cùng cơ chế chọn kỳ), top mã, so sánh peer.

#### `/groups` & `/groups/[groupId]`
- `/groups`: lưới các nhóm cổ phiếu (VN30, HNX30, penny, mid-cap, large-cap, liquid, volatile…). Card đếm số mã + chỉ số trung bình.
- `/groups/[groupId]`: bảng `GroupStockTable` 10 cột (giá, %thay đổi, KL, P/E, …), responsive về card trên mobile.

#### `/commodities` `/international` `/macro`
- `commodities/`: vàng, dầu (WTI/Brent), bạc, đồng, hàng hóa nông nghiệp. ISR ~10 phút.
- `international/`: S&P 500, Nasdaq, Nikkei 225, Hang Seng, DAX, FTSE, ASX… ISR ~10 phút.
- `macro/`: GDP, CPI, lãi suất, tỉ giá USD/VND, lịch kinh tế. ISR ~1 giờ.

#### `/news` & `/news/[articleId]`
- Feed tin tức + filter `category/` và `type/[type]`. SSE realtime.
- `/news/[articleId]`: ISR ~30 phút.
- ⚠️ **Sau pivot:** không render full `html_content` — thay bằng Alert "Đây là bản tóm tắt..." + text-link "Đọc đầy đủ" → external `article.link`. Tránh re-publish nội dung báo chí. Code render full content vẫn còn (wrap `{false && ...}`).

#### `/reports` & `/reports/[reportId]`
Danh mục báo cáo (daily/weekly market, sector deep-dive, stock analysis), filter `type/[type]`. SSR qua `serverFetch.ts`. ISR ~1 giờ.

#### `/watchlist`
**Lưới watchlist cá nhân, drag-and-drop** *(2026-03-23)*. Component: `SortableWatchlistCard` (`useSortable`), `WatchlistColumn`. Khi thả → `POST /api/v1/watchlists/reorder` với mảng `{id, coordinate: [col, row]}` — backend dùng `bulk_write` cập nhật atomic.

#### `/guides/*` *(2026-04-22)*
3 trang hướng dẫn dùng (thay khu `learning` cũ):
- `/guides/overview` — 7+ accordion section giới thiệu Home, Markets, Stocks, Sectors, Groups, News, Reports, Charts.
- `/guides/stock-screener` — giải thích từng tiêu chí lọc kèm screenshot.
- `/guides/charts-watchlist` — biểu đồ và watchlist drag-drop.
- Style: glass card (`getGlassCard`), breadcrumb điều hướng. **Public** — không cần đăng nhập.

> Convention: content `/guides/*` hướng đến NĐT phổ thông — ngôn ngữ thân thiện, **không** dùng thuật ngữ kỹ thuật (SSE, treemap, render...). Không ghi tên gói cụ thể (Advanced, Basic, Pro) — dùng "gói hội viên phù hợp" để ổn định khi rebrand.

#### `/plans`
Bảng so sánh các gói license + nút "Mua ngay". FE gọi `POST /api/v1/transactions/me/orders` → admin/manager confirm thủ công.

#### `/open-account` ❌ (403 sau pivot)
Code page giữ nguyên, chỉ bị block qua middleware.

#### `/support/*`
- `/support/email` — form gửi mail (`POST /api/v1/emails/send`).
- `/support/live-chat` — placeholder.
- `/support/consultation` — đặt lịch tư vấn (`POST /api/v1/emails/consultation`).

#### `/profile/*` (auth bắt buộc)
- `/profile/information` — họ tên, email, SĐT, avatar, broker đang gắn (`GET/PUT /api/v1/users/me`).
- `/profile/change-password` — đổi mật khẩu.
- `/profile/login-sessions` — phiên đang đăng nhập, đăng xuất từ xa (`GET /api/v1/sessions/me`).
- `/profile/subscriptions` ❌ — 403 sau pivot, code giữ nguyên.

#### `/policies/*`
3 static page: `/privacy`, `/content`, `/disclaimer`.

### 4.3.3 Admin Area — `admin/`

Layout riêng ([`admin/LayoutContent.tsx`](../../finext-nextjs/app/admin/LayoutContent.tsx)) với **sidebar lọc theo role** *(2026-03-26 RBAC)*. Manager không thấy Roles/Permissions/Sessions/OTPs.

| Route | Vai trò tối thiểu | Chức năng |
|-------|------------------|-----------|
| `/admin/dashboard` | broker+ | KPI: active users, doanh thu, transaction pending, cảnh báo. |
| `/admin/users` | manager | CRUD user, đổi mật khẩu user, gán role (`delete` & `manage_roles` cần admin). |
| `/admin/brokers` | admin | CRUD broker, đổi mã, kích hoạt/khóa. |
| `/admin/transactions` | manager | Filter status/date/user, **xác nhận thanh toán thủ công**, hủy, xóa (admin). |
| `/admin/subscriptions` | manager | Tạo/extend/deactivate, gán license cho user. |
| `/admin/licenses` | manager | CRUD license key, activate/deactivate. |
| `/admin/features` | manager | CRUD feature flag, gắn vào license. |
| `/admin/promotions` | manager | CRUD mã khuyến mãi, test validate, deactivate. |
| `/admin/roles` | admin | CRUD role, gán permission. |
| `/admin/permissions` | admin | Liệt kê/chỉnh sửa permission, lọc category. |
| `/admin/sessions` | admin | Xem mọi phiên, đăng xuất bắt buộc. |
| `/admin/otps` | admin | Theo dõi & invalidate OTP. |
| `/admin/watchlists` | manager | Moderation watchlist user. |

### 4.3.4 Auth Callback — `auth/google/`
⚠️ Bị 403 sau pivot. Code xử lý token Google → đổi JWT Finext → redirect `/` vẫn còn.

---

## 4.4 Modules Hỗ Trợ

```
finext-nextjs/
├── components/
│   ├── auth/            # AuthProvider, route guards, features.ts (tier bypass)
│   ├── provider/        # Mui/Theme/Notification providers
│   ├── layout/          # Header, Sidebar, Footer
│   ├── states/          # LoadingState, EmptyState, ErrorState
│   ├── themeToggle/
│   └── common/
├── services/
│   ├── apiClient.ts     # JWT inject, refresh flow, error mapping
│   ├── authService.ts   # Login, register, OAuth, session
│   ├── sseClient.ts     # SSE với reconnect
│   ├── pollingClient.ts # Fallback khi SSE không khả dụng
│   └── core/            # config, session, types (permissions[], features[])
├── hooks/               # useChartStore, useScreenerStore, usePriceMapStore, useMarketUpdateTime, ...
├── lib/
│   └── blocked-routes.ts # Centralized 403 list (post-pivot)
├── theme/               # MUI tokens light/dark
├── utils/
├── middleware.ts        # Route guard cấp Next.js middleware
├── scripts/
└── public/              # Icons, PWA assets, finext-panel.png
```

### Convention quan trọng

- **MUI Tabs** chỉ dùng để switch tab **trong cùng page**; cross-page nav dùng **breadcrumb** (xem `NewsBreadcrumb` pattern).
- **MUI sx units**: `width:1` = 100%, `m:1` = 8px (KHÔNG phải 1px). Để dùng pixel, quote `'1px'` string. Sai dễ gây overflow viewport.
- Accordion content `/guides/*` cần layout **đa dạng** (split row, steps, feature grid, timeline...), mỗi tab/section nhỏ có ảnh riêng, không dập khuôn.

---

## 4.5 Tối Ưu & Trải Nghiệm

- **SEO toàn diện** — JSON-LD (`WebSite`, `Organization`, `SiteNavigationElement`), OpenGraph, Twitter cards, sitemap, robots.
- **PWA-ready** — service worker, manifest, Apple touch icon, standalone mode, dark/light theme color.
- **Performance** — dynamic import cho các section nặng (`MarketSection`, `IndustrySection`, `FeaturedStocks`), **gzip ở nginx** (đã chuyển từ FastAPI, 2026-06-02), font Roboto self-host (TTF local, không gọi Google Fonts), **nginx cache `/_next/static/` 365d immutable + `/_next/image` 7d** (xem [`nginx.conf`](../../nginx/nginx.conf)).
- **Auth UX** — `AuthProvider` cache `permissions[]` và `features[]` trong localStorage; `useAuth().hasPermission()` / `hasFeature()` cho phép FE bật/tắt UI nhanh; backend vẫn enforce.
- **Loading skeleton** thống nhất qua `LoadingState` / `Skeleton`.

---

## 4.6 Realtime & State Management

### SSE Client
[`services/sseClient.ts`](../../finext-nextjs/services/sseClient.ts) (18KB) — wrapper EventSource với:
- Auto-reconnect (exponential backoff)
- Pause/resume khi tab inactive
- Type-safe event handlers
- Tích hợp với `usePriceMapStore`

### Polling Fallback
[`services/pollingClient.ts`](../../finext-nextjs/services/pollingClient.ts) — gọi `GET /api/v1/sse/rest/{keyword}` khi SSE không khả dụng.

### State Stores (Zustand-like)
| Store | Mục đích |
|-------|---------|
| `useChartStore` | State biểu đồ kỹ thuật `/charts/[id]` |
| `useScreenerStore` | State screener `/stocks` (filter, sort) |
| `usePriceMapStore` | Map giá realtime toàn app, feed bởi SSE |
| `useMarketUpdateTime` | Timestamp cập nhật cuối |
| `useRegisterModal`, `useSignInModal` | UI modal triggers |
