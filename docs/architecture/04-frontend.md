# 04 — Frontend (`finext-nextjs`)

> Stack, route map App Router, mô tả từng trang, modules hỗ trợ và tối ưu UX.

**Cập nhật:** 2026-07-21

---

## 4.1 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.5.x (App Router + Turbopack) |
| Runtime | React 19 |
| Language | TypeScript 5.7 **strict mode** |
| UI | MUI 7.1 (Material) + Emotion |
| Icons | `@mui/icons-material`, `@iconify/react` |
| Charts | `lightweight-charts` 5, `apexcharts` 5 + `react-apexcharts`, `echarts` 5 (template chart trong chat) |
| Data fetching | TanStack Query v5 + custom `apiClient` |
| Realtime | SSE (`sseClient.ts`); `pollingClient.ts` là client riêng, không automatic fallback |
| Auth | JWT access/refresh + `@react-oauth/google` (UI đang bật) |
| Drag & drop | `@dnd-kit/core`, `/sortable`, `/utilities` (watchlist reorder) |
| Theming | `next-themes` (light/dark + persist) |
| Date | `date-fns` 4 |
| URL parse | `query-string` |
| Test | Node test runner (`npm test`) + Playwright dependency |

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
│   ├── markets/, stocks/[symbol]/, charts/, charts/[id]/
│   ├── sectors/[sectorId]/, groups/[groupId]/
│   ├── commodities/, international/, macro/
│   ├── phase/
│   ├── chat/, chat/[id]/
│   ├── news/, news/[articleId]/, news/type/[type]/
│   ├── reports/, reports/[reportId]/, reports/type/[type]/
│   ├── watchlist/
│   ├── guides/{overview,stock-screener,charts-watchlist,tools-data}/
│   ├── plans/, open-account/, policies/{privacy,content,disclaimer}/
│   ├── support/{email,live-chat,consultation}/
│   └── profile/{information,change-password,login-sessions,subscriptions,ai-usage}/
├── admin/                       # Admin area (role admin/manager/broker)
│   ├── layout.tsx + LayoutContent.tsx
│   ├── dashboard/, users/, roles/, permissions/, sessions/
│   ├── features/, licenses/, subscriptions/, transactions/
│   ├── brokers/, promotions/, otps/, watchlists/
│   ├── components/, hooks/
└── auth/google/callback/        # Callback Google OAuth đang hoạt động
```

> Routes bị 403 qua middleware hiện chỉ có **`/open-account`** và **`/profile/subscriptions`**. `/auth/google/callback` đã được gỡ khỏi danh sách ngày 2026-07-21. Source of truth: [`lib/blocked-routes.ts`](../../finext-nextjs/lib/blocked-routes.ts).

---

## 4.3 Mô Tả Từng Trang

### 4.3.1 Auth — `(auth)/`

| Route | Mô tả |
|-------|-------|
| `/login` | Đăng nhập email + mật khẩu hoặc Google OAuth. User inactive có thể xin/nhập OTP xác thực ngay trong form. |
| `/register` | Đăng ký email + mật khẩu → nhập OTP 6 số → tự kích hoạt; có lựa chọn Google OAuth. Không cần admin duyệt tay. |
| `/forgot-password` | Xin OTP email rồi gọi `/api/v1/auth/reset-password-otp` để đặt lại mật khẩu. |

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
Tổng quan thị trường: chỉ số chính, định giá tổng (P/E, P/B, dividend yield), độ rộng (advance/decline), xoay vòng nhóm ngành (heatmap), chu kỳ thị trường. `page.tsx` cung cấp metadata/Suspense; dữ liệu nằm ở client sections, không cấu hình ISR tại route.

#### `/phase` — Giai Đoạn Thị Trường
Page bốn tab theo Phase v3.4.2: Phân tích thị trường (free) và ba danh mục tham khảo (strict advanced+). Dữ liệu `phase_*` lấy one-shot qua `GET /api/v1/sse/rest/{keyword}`; riêng xu hướng FNXINDEX kết hợp REST history + market SSE hôm nay. Chi tiết: [`08-market-phase.md`](08-market-phase.md).

#### `/stocks` — **Stock Screener**
Đa tiêu chí, cấu hình trong [`screenerConfig.ts`](../../finext-nextjs/app/(main)/stocks/screenerConfig.ts). Cột/bộ lọc hiện có phủ thông tin sàn-ngành-vốn hoá, giá/OHLCV và biến động theo khung, thanh khoản, dòng tiền/xếp hạng, cùng các vùng kỹ thuật W/M/Q/Y (zone, MA, pivot, Fibonacci, Volume Profile). Screener hiện **không có** RSI, MACD, P/E, P/B, ROE hay EPS growth. Bảng kết quả có sort/search và thao tác watchlist inline.

#### `/stocks/[symbol]` — Chi tiết mã
- Header giá realtime.
- Tab biểu đồ (lightweight-charts).
- Tab tài chính (`StockFinancialsFocusChart` + `StockFinancialsSection`) — **chọn kỳ click vào bar** *(2026-04-16)*.
- Tab tin tức theo mã.
- View mode store [`viewModeStore.ts`](../../finext-nextjs/app/(main)/stocks/[symbol]/viewModeStore.ts) (2026-05-07).
- `StockInfoSection` + `StockKeyMetricsPanel` enhanced metrics display (2026-05-07).

#### `/charts/[id]` — Workspace Biểu Đồ Kỹ Thuật
Toàn màn hình, tích hợp:
- Nến Nhật/đường giá, volume và các nhóm chỉ báo hiện có qua `IndicatorsPanel`: MA, Open/High/Low, Pivot, Fibonacci, Volume Profile và Volume MA.
- `BandFillPrimitive.ts` — custom primitive cho lightweight-charts (vẽ vùng).
- `aggregateTimeframe.ts` — gộp candle theo khung thời gian.
- **Warmup chỉ báo cho mã mới niêm yết**: `PageContent.tsx` trim leading candles có `close=0`; `CandlestickChart.tsx::extractFieldData` skip N điểm đầu cho mỗi chỉ báo (MA{n} = n, prefix `w_/m_/q_/y_` = 5/20/60/240, quy đổi theo timeframe 1W/1M) → tránh đường MA dốc đứng từ ngày 1.
- Side-panel: `WatchlistPanel`, `DetailPanel`, `PanelNewsList`.
- `ChartToolbar` — tìm/chọn mã, đổi nến/đường và timeframe; bật/tắt indicator, volume, legend/price tag, các side-panel và fullscreen. Chưa có công cụ vẽ trendline/annotation.
- Lưu mã đang xem qua store (URL `[id]`).
- State: `useChartStore` ([`hooks/useChartStore.ts`](../../finext-nextjs/hooks/useChartStore.ts)).
- `/charts` là route chuyển hướng client tới mã gần nhất từ `loadLastTicker()`.

#### `/sectors`
Bảng xếp hạng strength của ~25 nhóm ngành, heatmap rotation.

#### `/sectors/[sectorId]`
Chi tiết ngành: composition, trend doanh thu/lợi nhuận/ROE (`FinancialsFocusChart` + `FinancialsSection` — cùng cơ chế chọn kỳ), top mã, so sánh peer.

#### `/groups` & `/groups/[groupId]`
- `/groups`: lưới các nhóm cổ phiếu (VN30, HNX30, penny, mid-cap, large-cap, liquid, volatile…). Card đếm số mã + chỉ số trung bình.
- `/groups/[groupId]`: bảng `GroupStockTable` 10 cột (giá, %thay đổi, KL, P/E, …), responsive về card trên mobile.

#### `/commodities` `/international` `/macro`
- `commodities/`: vàng, dầu (WTI/Brent), bạc, đồng, hàng hóa nông nghiệp.
- `international/`: S&P 500, Nasdaq, Nikkei 225, Hang Seng, DAX, FTSE, ASX…
- `macro/`: GDP, CPI, lãi suất, tỉ giá USD/VND, lịch kinh tế.

#### `/news` & `/news/[articleId]`
- Feed tin tức + route filter `type/[type]`. SSE realtime. Thư mục `news/category/[category]` hiện chỉ có `PageContent.tsx`, không có `page.tsx` nên chưa tạo route App Router.
- `/news/[articleId]` server-fetch bài viết cho metadata/JSON-LD với `revalidate: 300` (5 phút); content page vẫn dùng client component.
- ⚠️ **Sau pivot:** không render full `html_content` — thay bằng Alert "Đây là bản tóm tắt..." + text-link "Đọc đầy đủ" → external `article.link`. Tránh re-publish nội dung báo chí. Code render full content vẫn còn (wrap `{false && ...}`).

#### `/reports` & `/reports/[reportId]`
Danh mục báo cáo (daily/weekly market, sector deep-dive, stock analysis), filter `type/[type]`. Detail server-fetch metadata/JSON-LD qua `serverFetch.ts` với `revalidate: 300` (5 phút).

#### `/watchlist`
**Lưới watchlist cá nhân, drag-and-drop** *(2026-03-23)*. Component: `SortableWatchlistCard` (`useSortable`), `WatchlistColumn`. Khi thả → `POST /api/v1/watchlists/reorder` với mảng `{id, coordinate: [col, row]}` — backend dùng `bulk_write` cập nhật atomic.

#### `/chat` & `/chat/[id]` — Finext AI
- Cả hai dùng chung `PageContent`; route `[id]` deep-link tới hội thoại đã lưu. `OptionalAuthWrapper requireAuth` chặn UI khi chưa đăng nhập.
- `useChatStore` điều phối POST SSE, thinking toggle, tool state, hội thoại và quota warnings.
- Sidebar hỗ trợ list/detail/delete, pin, rename; message assistant có feedback. ECharts render một số template trực quan.
- Chat bubble dùng cùng store/API, truyền `page_context` của trang đang xem và chỉ mount agent state sau lần mở đầu tiên.

#### `/guides/*` *(2026-04-22)*
4 trang hướng dẫn dùng (thay khu `learning` cũ); `/guides` redirect tới `/guides/overview`:
- `/guides/overview` — 7+ accordion section giới thiệu Home, Markets, Stocks, Sectors, Groups, News, Reports, Charts.
- `/guides/stock-screener` — giải thích từng tiêu chí lọc kèm screenshot.
- `/guides/charts-watchlist` — biểu đồ và watchlist drag-drop.
- `/guides/tools-data` — Phase, Finext AI, macro, quốc tế và hàng hóa.
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
- `/profile/ai-usage` — hạn mức Finext AI theo cửa sổ 5 giờ và tuần (`GET /api/v1/chat/quota`).
- `/profile/subscriptions` ❌ — 403 sau pivot, code giữ nguyên.
- `/profile` redirect tới `/profile/information`.

#### `/policies/*`
3 static page: `/privacy`, `/content`, `/disclaimer`.

### 4.3.3 Admin Area — `admin/`

Layout riêng ([`admin/LayoutContent.tsx`](../../finext-nextjs/app/admin/LayoutContent.tsx)) với **sidebar lọc theo role** *(2026-03-26 RBAC)*. Manager không thấy Roles/Permissions/Sessions/OTPs.

| Route | Vai trò tối thiểu | Chức năng |
|-------|------------------|-----------|
| `/admin/dashboard` | broker+ | KPI: active users, doanh thu, transaction pending, cảnh báo. |
| `/admin/users` | manager | CRUD user, đổi mật khẩu user, gán role (`delete` & `manage_roles` cần admin). |
| `/admin/brokers` | manager (read), admin (mutate) | Manager có `broker:list/read_any`; tạo/sửa/xóa cần admin. |
| `/admin/transactions` | broker+ | Broker chỉ đọc giao dịch referred; manager/admin đọc toàn bộ và xác nhận/hủy thủ công. |
| `/admin/subscriptions` | manager | Tạo/extend/deactivate, gán license cho user. |
| `/admin/licenses` | manager | CRUD license key, activate/deactivate. |
| `/admin/features` | manager | CRUD feature flag, gắn vào license. |
| `/admin/promotions` | manager | CRUD mã khuyến mãi, test validate, deactivate. |
| `/admin/roles` | admin | CRUD role, gán permission. |
| `/admin/permissions` | admin | Liệt kê/chỉnh sửa permission, lọc category. |
| `/admin/sessions` | admin | Xem mọi phiên, đăng xuất bắt buộc. |
| `/admin/otps` | admin | Theo dõi & invalidate OTP. |
| `/admin/watchlists` | manager | Moderation watchlist user. |

### 4.3.4 Auth Callback — `/auth/google/callback`
Route `/auth/google/callback` đang hoạt động. Page gửi authorization code + `redirect_uri` tới `POST /api/v1/auth/google/callback`, nạp user/features/permissions, lưu session Finext rồi full-page redirect về `/`.

---

## 4.4 Modules Hỗ Trợ

```
finext-nextjs/
├── components/
│   ├── auth/            # AuthProvider, route guards, features.ts (tier bypass)
│   ├── provider/        # Mui/Theme/Notification providers
│   ├── layout/          # Header, Sidebar, Footer
│   ├── chatBubble/      # Chat nổi + teaser theo page
│   ├── states/          # LoadingState, EmptyState, ErrorState
│   ├── themeToggle/
│   └── common/
├── services/
│   ├── apiClient.ts     # JWT inject, refresh flow, error mapping
│   ├── authService.ts   # Login, register, OAuth, session
│   ├── sseClient.ts     # SSE với reconnect
│   ├── pollingClient.ts # Client polling cho các flow riêng (không auto-fallback SSE)
│   ├── chatClient.ts    # Parse POST SSE Finext AI
│   ├── chatConversations.ts, chatQuota.ts, chatPageContext.ts
│   └── core/            # config, session, types (permissions[], features[])
├── hooks/               # useChartStore, useScreenerStore, usePriceMapStore, useChatStore, ...
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

### Polling Client
[`services/pollingClient.ts`](../../finext-nextjs/services/pollingClient.ts) — helper gọi `GET /api/v1/sse/rest/{keyword}` theo interval cho các flow chủ động chọn polling. `useSseCache` **không tự chuyển** sang client này khi SSE lỗi.

### State Stores (Zustand-like)
| Store | Mục đích |
|-------|---------|
| `useChartStore` | State biểu đồ kỹ thuật `/charts/[id]` |
| `useScreenerStore` | State screener `/stocks` (filter, sort) |
| `usePriceMapStore` | Map giá realtime toàn app, feed bởi SSE |
| `useMarketUpdateTime` | Timestamp cập nhật cuối |
| `useRegisterModal`, `useSignInModal` | UI modal triggers |
| `useChatStore` | POST SSE, message/tool state, conversation persistence, thinking/quota cho page chat và bubble |
