# Finext — Nền Tảng Phân Tích & Sàng Lọc Cổ Phiếu Thông Minh

> *Your Next Financial Step* — Web app phân tích chứng khoán toàn diện cho nhà đầu tư Việt Nam: dữ liệu thị trường thời gian thực, biểu đồ kỹ thuật chuyên sâu, screener đa tiêu chí, watchlist cá nhân và hệ thống thuê bao có phân tầng theo gói license.

**Website:** [finext.vn](https://finext.vn)
**Repository:** [twan507/finext-web-app](https://github.com/twan507/finext-web-app)
**Cập nhật:** 2026-05-06

---

## 1. Tổng Quan Sản Phẩm

Finext là một **web application full-stack** hướng đến nhà đầu tư cá nhân, môi giới và đội ngũ vận hành. Sản phẩm xoay quanh ba trục giá trị:

1. **Dữ liệu & phân tích chuyên sâu** — VNINDEX, VN30, HNX, UPCOM; nhóm ngành, dòng tiền, hàng hóa, chỉ số quốc tế, vĩ mô.
2. **Công cụ ra quyết định** — biểu đồ TradingView-like (lightweight-charts), screener với cấu hình tiêu chí phong phú, watchlist drag-and-drop, financial chart cho phép chọn kỳ.
3. **Hệ sinh thái kinh doanh** — gói license phân tầng, mã promotion, chương trình broker, luồng thanh toán bán-tự-động (manual confirm hôm nay, **SePay auto-confirm đang được thiết kế** — xem mục 6).

### Đối tượng người dùng

| Role | Mô tả | Truy cập |
|------|-------|----------|
| **user** | Nhà đầu tư cá nhân, dùng tính năng theo gói đang sở hữu. | (main) routes |
| **broker** | Đối tác giới thiệu, hưởng hoa hồng từ giao dịch referred. | (main) + một phần admin (dashboard, một số list) |
| **manager** | Vận hành — CRUD users, subscriptions, transactions, promotions, licenses, features. | admin (trừ roles/permissions/sessions/otps) |
| **admin** | Toàn quyền — quản lý roles, permissions, sessions, OTP, features, brokers. | admin (đầy đủ) |

Phân quyền được kiểm soát bằng matrix **role × permission** (chi tiết ở mục 3.4).

---

## 2. Kiến Trúc Tổng Thể

```
┌──────────────────────────────────────────────────────────────┐
│                      NGINX (reverse proxy, SSL)              │
└─────────────────┬─────────────────────────┬──────────────────┘
                  │                         │
      ┌───────────▼───────────┐   ┌─────────▼──────────────┐
      │  Next.js 15.5         │   │  FastAPI 0.115+        │
      │  (TS 5.7, MUI 7.1)    │◄──┤  (Python 3.13, Motor)  │
      │  Port 3000            │   │  Port 8000             │
      └───────────────────────┘   └─────────┬──────────────┘
                                            │
                                  ┌─────────▼──────────┐
                                  │     MongoDB        │
                                  │  (motor async)     │
                                  └────────────────────┘
```

**Deploy:** Docker Compose 3 services — `nginx` (256M), `fastapi` (2G/1.5 CPU), `nextjs` (2G/2 CPU). Network bridge `web-proxy`. Frontend dùng `INTERNAL_API_URL` (Docker DNS `http://fastapi:8000`) cho SSR fetch và `NEXT_PUBLIC_API_URL` cho client.

### Thư mục gốc

```
finext-web-app/
├── finext-fastapi/      # Python backend (FastAPI + MongoDB)
├── finext-nextjs/       # TypeScript frontend (Next.js 15)
├── nginx/               # Reverse proxy config
├── ssl/                 # SSL certificates
├── docs/                # Tài liệu (file này, plans, specs)
├── docker-compose.yml   # Production orchestration
├── readme.md
└── CLAUDE.md            # Hướng dẫn làm việc cùng AI assistant
```

---

## 3. Backend — `finext-fastapi`

### 3.1 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI ≥ 0.115.12, Uvicorn |
| Language | Python 3.13+, type-hinted toàn bộ |
| Package manager | UV (Astral) |
| Validation | Pydantic v2 (≥ 2.11) + pydantic-settings |
| Database | MongoDB qua Motor (async) ≥ 3.7, PyMongo cho index/admin |
| Auth | JWT (python-jose), bcrypt, Google OAuth (google-auth + oauthlib) |
| Email | fastapi-mail, aiosmtplib, Jinja2 templates |
| Storage | boto3 — Cloudflare R2 / AWS S3 cho avatar và upload |
| Scheduler | APScheduler — cron jobs nội bộ |
| Data | pandas, Pillow xử lý dữ liệu chart và ảnh |
| HTTP | httpx (async), requests (sync fallback) |
| Test | pytest, pytest-asyncio |

### 3.2 Cấu Trúc App

```
finext-fastapi/app/
├── main.py                   # Entry — lifespan, CORS, GZip, exception handlers
├── auth/                     # JWT, dependencies, permission checks
│   ├── jwt_handler.py
│   ├── dependencies.py       # get_current_user, require_permission
│   └── access.py
├── core/
│   ├── config.py             # Settings (env-driven)
│   ├── database.py           # Motor connection, get_database()
│   ├── scheduler.py          # APScheduler start/shutdown
│   └── seeding/              # Seed dữ liệu ban đầu (idempotent)
│       ├── _config.py        # DEFAULT_PERMISSIONS, FEATURES, LICENSES
│       ├── _seed_users.py
│       ├── _seed_roles.py
│       ├── _seed_permissions.py
│       ├── _seed_features.py
│       ├── _seed_licenses.py
│       ├── _seed_brokers.py
│       ├── _seed_promotions.py
│       └── _seed_subscriptions.py
├── routers/                  # 17 API routers (mục 3.3)
├── crud/                     # Data access layer — tách khỏi HTTP
├── schemas/                  # Pydantic DTOs request/response
├── templates/                # HTML email templates (Jinja2)
│   ├── consultation_request.html
│   ├── email_verification.html
│   ├── open_account_request.html
│   ├── plan_inquiry_request.html
│   ├── pwdless_login.html
│   ├── reset_password.html
│   └── subscription_reminder.html
└── utils/
    ├── security.py           # Hash, token utilities
    ├── google_auth.py        # Verify Google ID token
    ├── email_utils.py        # Render template + send
    ├── otp_utils.py          # Sinh & verify OTP
    ├── storage.py            # R2/S3 upload
    ├── response_wrapper.py   # StandardApiResponse[T]
    └── types.py              # PyObjectId và custom types
```

### 3.3 API Endpoints (prefix `/api/v1`)

Tất cả endpoint trả về `StandardApiResponse[T]`:
```json
{ "status": 200, "message": "OK", "data": { ... } }
```

| Router | Prefix | Trách nhiệm chính |
|--------|--------|-------------------|
| `auth` | `/auth` | Đăng ký, đăng nhập (email/pwd + Google), passwordless OTP login, refresh token, logout, `GET /me`, `GET /me/features`, `GET /me/permissions`. |
| `users` | `/users` | CRUD user, đổi mật khẩu, gán roles, list user được bảo vệ (`/protected`). |
| `roles` | `/roles` | CRUD role, gán/thu hồi permission cho role (admin-only). |
| `permissions` | `/permissions` | CRUD permission + `GET /categories` + `GET /category/{name}` (admin-only). |
| `sessions` | `/sessions` | `GET /me`, đăng xuất phiên cụ thể, admin xem/đăng xuất tất cả phiên. |
| `subscriptions` | `/subscriptions` | `GET /me`, CRUD subscription, activate/deactivate, gán license cho user. |
| `transactions` | `/transactions` | `POST /me/orders` (user tự tạo order), `POST /admin/create`, list/get, `PUT /admin/{id}/confirm-payment`, `PUT /admin/{id}/cancel`. |
| `licenses` | `/licenses` | CRUD license, activate/deactivate (manager+). |
| `features` | `/features` | CRUD feature flag (manager+), gắn vào license. |
| `promotions` | `/promotions` | CRUD mã khuyến mãi + `GET /{code}/validate` cho user trong checkout. |
| `brokers` | `/brokers` | CRUD broker (admin), `GET /me` cho user xem broker đang gắn, đổi mã broker. |
| `watchlists` | `/watchlists` | CRUD watchlist của user (`/me`), `POST /reorder` bulk drag-drop, admin moderation. |
| `otps` | `/otps` | `POST /request`, `POST /verify` (public); admin list & invalidate. |
| `emails` | `/emails` | Form gửi mail (rate-limited): `/send`, `/consultation`, `/open-account`. |
| `uploads` | `/uploads` | Upload + nén ảnh (Pillow) → R2/S3. |
| `sse` | `/sse` | Server-Sent Events: `/stream/{keyword}` (có thể filter `?ticker=...`), `/keywords`, `/rest/{keyword}` REST fallback. |
| `dashboard` | `/admin/dashboard` | `/stats` cho admin/manager — KPI doanh thu, user, transaction. |

### 3.4 Phân Quyền — Role + Permission

- **4 roles** (đặc quyền tăng dần): `user` → `broker` → `manager` → `admin`.
- **~50 permissions** chia theo 6 categories: `user_management`, `transaction_management`, `broker_management`, `subscription_management`, `admin_system`, `others`.
- Mapping role → permission được seed từ `app/core/seeding/_config.py` lúc `lifespan` khởi động (idempotent — chỉ thêm record còn thiếu).
- Frontend cache `permissions: string[]` của user trong localStorage và cung cấp `useAuth().hasPermission(key)` để bật/tắt UI; backend vẫn enforce ở từng endpoint qua `Depends(require_permission(resource, action))`.

Vài permission tiêu biểu:

| Permission | Vai trò được phép |
|------------|-------------------|
| `user:delete_any`, `user:manage_roles` | admin |
| `role:manage`, `permission:manage`, `session:manage_any`, `otp:manage`, `broker:create/update_any/delete_any` | admin |
| `user:create/list/read_any/update_any`, `subscription:*`, `transaction:read_any/confirm_payment_any/cancel_any`, `license:manage`, `feature:manage`, `promotion:manage`, `watchlist:manage_any` | admin + manager |
| `transaction:read_referred` | broker |
| `transaction:create_own/read_own`, `watchlist:manage_own/read_own`, `user:update_own` | tất cả user đã đăng nhập |

### 3.5 Hệ Thống License & Feature

5 gói license mặc định (seed):

| Key | Tên | Giá (VND) | Thời hạn | Dành cho |
|-----|-----|-----------|----------|----------|
| `ADMIN` | License Quản Trị Viên | 0 | ~∞ | Admin nội bộ |
| `MANAGER` | License Quản Lý | 0 | ~∞ | Nhân sự vận hành |
| `PARTNER` | License Đối Tác | 0 | ~∞ | Broker giới thiệu |
| `PATRON` | License Người Ủng Hộ | 10.000.000 | 365 ngày | Nhà đầu tư pro |
| `BASIC` | License Cơ Bản | 0 | ~∞ | Người dùng miễn phí |

Mỗi license gắn một danh sách **feature_keys** (`basic_feature`, `advanced_feature`, `broker_feature`, `manager_feature`, `admin_feature`). Frontend đọc `feature_keys` từ subscription đang active để bật/tắt UI; backend kiểm tra entitlement khi cần.

### 3.6 Lifecycle & Background Jobs

Khi `lifespan` khởi động (`main.py`):

1. `connect_to_mongo()` — Motor client.
2. `seed_initial_data()` — seed permissions/roles/features/licenses/brokers/promotions/users mẫu nếu thiếu.
3. `start_scheduler()` — APScheduler:
   - Nhắc subscription sắp hết hạn (gửi email từ template `subscription_reminder.html`).
   - Dọn OTP hết hạn.
   - (Job `auto-cancel pending orders` sẽ được thêm khi triển khai SePay — xem mục 6.)
4. Shutdown: stop scheduler → đóng Mongo.

---

## 4. Frontend — `finext-nextjs`

### 4.1 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.5.x (App Router + Turbopack) |
| Runtime | React 19 |
| Language | TypeScript 5.7 strict mode |
| UI | MUI 7.1 (Material) + Emotion |
| Icons | `@mui/icons-material`, `@iconify/react` |
| Charts | `lightweight-charts` 5 (candlestick + custom primitive), `apexcharts` 5 + `react-apexcharts` (bar/line tài chính) |
| Data fetching | TanStack Query v5 + custom `apiClient` |
| Realtime | Server-Sent Events (`sseClient.ts`) + polling fallback |
| Auth | JWT + `@react-oauth/google` |
| Drag & drop | `@dnd-kit/core`, `/sortable`, `/utilities` (watchlist reorder) |
| Theming | `next-themes` (light/dark + persist) |
| Date | `date-fns` 4 |
| URL parse | `query-string` |
| Test | Playwright |

### 4.2 Bố Cục Route (App Router)

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
│   ├── layout.tsx
│   ├── LayoutContent.tsx
│   ├── page.tsx + home/         # Trang chủ
│   ├── markets/
│   ├── stocks/                  # Screener + chi tiết mã
│   │   ├── [symbol]/
│   │   ├── components/
│   │   └── screenerConfig.ts
│   ├── charts/[id]/             # Workspace biểu đồ kỹ thuật
│   ├── sectors/                 # Phân tích nhóm ngành
│   │   └── [sectorId]/
│   ├── groups/                  # Nhóm cổ phiếu (VN30, mid-cap, …)
│   │   └── [groupId]/
│   ├── commodities/             # Hàng hóa
│   ├── international/           # Tài chính quốc tế
│   ├── macro/                   # Vĩ mô
│   ├── news/
│   │   ├── [articleId]/
│   │   ├── category/
│   │   ├── type/[type]/
│   │   ├── components/
│   │   └── serverFetch.ts
│   ├── reports/
│   │   ├── [reportId]/
│   │   ├── type/[type]/
│   │   ├── components/
│   │   └── serverFetch.ts
│   ├── watchlist/               # Watchlist cá nhân, drag-drop
│   ├── guides/                  # Hướng dẫn sử dụng (3 trang)
│   │   ├── overview/
│   │   ├── stock-screener/
│   │   ├── charts-watchlist/
│   │   └── components/
│   ├── plans/                   # Gói dịch vụ + mua
│   ├── open-account/            # CTA mở tài khoản chứng khoán
│   ├── policies/
│   │   ├── privacy/
│   │   ├── content/
│   │   └── disclaimer/
│   ├── support/
│   │   ├── email/
│   │   ├── live-chat/
│   │   └── consultation/
│   └── profile/
│       ├── information/
│       ├── change-password/
│       ├── login-sessions/
│       └── subscriptions/
├── admin/                       # Admin area (role admin/manager/broker)
│   ├── layout.tsx + LayoutContent.tsx
│   ├── dashboard/
│   ├── users/
│   ├── roles/
│   ├── permissions/
│   ├── sessions/
│   ├── features/
│   ├── licenses/
│   ├── subscriptions/
│   ├── transactions/
│   ├── brokers/
│   ├── promotions/
│   ├── otps/
│   ├── watchlists/
│   ├── components/
│   └── hooks/
└── auth/google/                 # Callback Google OAuth
```

### 4.3 Mô Tả Chi Tiết Từng Trang

#### 4.3.1 Auth — `(auth)/`

| Route | Mô tả |
|-------|-------|
| `/login` | Đăng nhập email + mật khẩu, có nút Google OAuth, link tới `/forgot-password` và `/register`. |
| `/register` | Đăng ký bằng email + mật khẩu, kèm xác thực OTP qua email, checkbox đồng ý điều khoản. |
| `/forgot-password` | Reset mật khẩu qua OTP; cũng là điểm vào cho **passwordless login** (`/auth/login-otp`). |

#### 4.3.2 Main App — `(main)/`

**Trang chủ — `/`** (`home/PageContent.tsx`)
- Hero/welcome.
- **Market Index Overview** — VN-Index, VN30, HNX-Index thời gian thực (`MarketIndexChart`, `IndexDetailPanel`).
- **Market Volatility** — top tăng / giảm / khối lượng cao trong phiên (3 tab).
- **Featured Stocks** *(2026-05-05)* — carousel 2 slide: top 10 mã có dòng tiền vào và top 10 mã dòng tiền ra; tái sử dụng `GroupStockTable` từ `/groups/[groupId]`. Autoplay 10s.
- **Industry Section** — top nhóm ngành theo strength.
- **News Feed** + **Reports Carousel** — tin tức và báo cáo mới nhất.
- Nguồn dữ liệu: SSE `home_today_stock`, REST qua TanStack Query.

**`/markets`** — Tổng quan thị trường: chỉ số chính, định giá tổng (P/E, P/B, dividend yield), độ rộng thị trường (advance/decline), xoay vòng nhóm ngành (heatmap), chu kỳ thị trường. ISR ~5 phút.

**`/stocks`** — **Stock screener** đa tiêu chí, cấu hình trong `screenerConfig.ts`. Tiêu chí gồm kỹ thuật (RSI, MACD, MA cross), cơ bản (P/E, P/B, ROE, EPS growth), thanh khoản, vốn hóa. Bảng kết quả có sort/search, thao tác watchlist inline.

**`/stocks/[symbol]`** — Chi tiết mã: header giá, tab biểu đồ (lightweight-charts), tab tài chính (`StockFinancialsFocusChart` + `StockFinancialsSection` — **chọn kỳ click vào bar**, 2026-04-16), tab tin tức theo mã. ISR ~30 phút.

**`/charts/[id]`** — Workspace biểu đồ kỹ thuật toàn màn hình:
- Nến Nhật, volume, các chỉ báo (MA, RSI, MACD, Bollinger…) qua `IndicatorsPanel`.
- `BandFillPrimitive.ts` — custom primitive cho lightweight-charts (vẽ vùng).
- `aggregateTimeframe.ts` — gộp candle theo khung thời gian.
- Side-panel: `WatchlistPanel`, `DetailPanel`, `PanelNewsList`.
- `ChartToolbar` chọn timeframe, indicator, công cụ vẽ.
- Lưu mã đang xem qua store (URL `[id]`).

**`/sectors`** — Bảng xếp hạng strength của ~25 nhóm ngành, heatmap rotation.
**`/sectors/[sectorId]`** — Chi tiết ngành: composition, trend doanh thu/lợi nhuận/ROE (`FinancialsFocusChart` + `FinancialsSection` cùng cơ chế chọn kỳ), top mã trong ngành, so sánh peer.

**`/groups`** — Lưới các nhóm cổ phiếu (VN30, HNX30, penny, mid-cap, large-cap, liquid, volatile…). Card đếm số mã + chỉ số trung bình.
**`/groups/[groupId]`** — Bảng `GroupStockTable` 10 cột (giá, %thay đổi, KL, P/E, …), responsive về dạng card trên mobile.

**`/commodities`** — Vàng, dầu (WTI/Brent), bạc, đồng, hàng hóa nông nghiệp; ISR ~10 phút.
**`/international`** — S&P 500, Nasdaq, Nikkei 225, Hang Seng, DAX, FTSE, ASX… ISR ~10 phút.
**`/macro`** — GDP, CPI, lãi suất, tỉ giá USD/VND, lịch kinh tế; ISR ~1 giờ.

**`/news`** — Feed tin tức + filter theo `category/` và `type/[type]`. SSE realtime.
**`/news/[articleId]`** — Chi tiết bài (full text, metadata, related). ISR ~30 phút.

**`/reports`** — Danh mục báo cáo (daily/weekly market, sector deep-dive, stock analysis), filter theo `type/[type]`. Dùng `serverFetch.ts` cho SSR.
**`/reports/[reportId]`** — Chi tiết báo cáo, có thể giới hạn truy cập theo subscription. ISR ~1 giờ.

**`/watchlist`** — **Lưới watchlist cá nhân**, drag-and-drop sắp xếp giữa cột/hàng *(2026-03-23)*. Component: `SortableWatchlistCard` (`useSortable`), `WatchlistColumn`. Khi thả, gọi `POST /api/v1/watchlists/reorder` với mảng `{id, coordinate: [col, row]}` — backend dùng `bulk_write` cập nhật atomic.

**`/guides`** *(2026-04-22)* — 3 trang hướng dẫn dùng (thay cho khu `learning` cũ):
- `/guides/overview` — 7+ accordion section giới thiệu Home, Markets, Stocks, Sectors, Groups, News, Reports, Charts.
- `/guides/stock-screener` — giải thích bộ lọc và cách dùng từng tiêu chí, kèm screenshot.
- `/guides/charts-watchlist` — hướng dẫn biểu đồ và watchlist drag-drop.
- Style: glass card (`getGlassCard`), breadcrumb điều hướng. Public — không cần đăng nhập.

**`/plans`** — Bảng so sánh các gói license + nút "Mua ngay". Khi user mua, FE gọi `POST /api/v1/transactions/me/orders`. *(Khi SePay được triển khai, sẽ redirect tới `/checkout/{orderId}` — xem mục 6.)*

**`/open-account`** — Trang giới thiệu lợi ích + form mở tài khoản chứng khoán; submit gửi mail nội bộ qua `POST /api/v1/emails/open-account`.

**`/support/`** — 3 kênh hỗ trợ:
- `/support/email` — form gửi mail (`/api/v1/emails/send`).
- `/support/live-chat` — placeholder chờ tích hợp vendor chat.
- `/support/consultation` — đặt lịch tư vấn (`/api/v1/emails/consultation`).

**`/profile/`** — 4 trang con (auth bắt buộc):
- `/profile/information` — họ tên, email, SĐT, avatar, broker đang gắn (`GET/PUT /api/v1/users/me`).
- `/profile/change-password` — đổi mật khẩu.
- `/profile/login-sessions` — danh sách phiên đang đăng nhập, đăng xuất từ xa (`GET /api/v1/sessions/me`).
- `/profile/subscriptions` — gói đang sở hữu, hạn, lịch sử.

**`/policies/`** — 3 trang static:
- `/policies/privacy` — chính sách bảo mật.
- `/policies/content` — điều khoản nội dung.
- `/policies/disclaimer` — miễn trừ trách nhiệm đầu tư.

#### 4.3.3 Admin Area — `admin/`

Layout riêng (`admin/LayoutContent.tsx`) với sidebar lọc theo role *(2026-03-26 RBAC)*. Manager không thấy Roles/Permissions/Sessions/OTPs.

| Route | Vai trò tối thiểu | Chức năng |
|-------|------------------|-----------|
| `/admin/dashboard` | broker+ | KPI: active users, doanh thu, transaction pending, cảnh báo (license sắp hết hạn, webhook fail). |
| `/admin/users` | manager | CRUD user, đổi mật khẩu user, gán role (riêng `delete` & `manage_roles` cần admin). |
| `/admin/brokers` | admin | CRUD broker, đổi mã, kích hoạt/khóa. |
| `/admin/transactions` | manager | Bảng giao dịch + filter status/date/user, **xác nhận thanh toán thủ công**, hủy đơn, xóa (admin). |
| `/admin/subscriptions` | manager | Tạo/extend/deactivate subscription, gán license cho user. |
| `/admin/licenses` | manager | CRUD license key, activate/deactivate. |
| `/admin/features` | manager | CRUD feature flag, gắn vào license. |
| `/admin/promotions` | manager | CRUD mã khuyến mãi, test validate, deactivate. |
| `/admin/roles` | admin | CRUD role, gán permission. |
| `/admin/permissions` | admin | Liệt kê & chỉnh sửa định nghĩa permission, lọc theo category. |
| `/admin/sessions` | admin | Xem mọi phiên đăng nhập, đăng xuất bắt buộc. |
| `/admin/otps` | admin | Theo dõi & invalidate OTP. |
| `/admin/watchlists` | manager | Moderation watchlist của user. |

#### 4.3.4 Auth Callback — `auth/google/`

Trang callback xử lý token Google OAuth → đổi lấy access/refresh token của Finext → redirect về `/`.

### 4.4 Modules Hỗ Trợ

```
finext-nextjs/
├── components/
│   ├── auth/            # AuthProvider, route guards
│   ├── provider/        # Mui/Theme/Notification providers
│   ├── layout/          # Header, Sidebar, Footer
│   ├── states/          # LoadingState, EmptyState, ErrorState
│   ├── themeToggle/
│   └── common/
├── services/
│   ├── apiClient.ts     # JWT inject, refresh flow, error mapping
│   ├── authService.ts   # Login, register, OAuth, session
│   ├── sseClient.ts     # SSE client với reconnect
│   ├── pollingClient.ts # Fallback khi SSE không khả dụng
│   └── core/            # config, session, types (permissions[], features[])
├── hooks/               # useAuth, usePermission, useFeature, ...
├── theme/               # MUI tokens light/dark
├── utils/
├── middleware.ts        # Route guard cấp Next.js middleware
├── scripts/
└── public/              # Icons, PWA assets, finext-panel.png
```

### 4.5 Tối Ưu & Trải Nghiệm

- **SEO toàn diện** — JSON-LD (`WebSite`, `Organization`, `SiteNavigationElement`), OpenGraph, Twitter cards, sitemap, robots.
- **PWA-ready** — service worker, manifest, Apple touch icon, standalone mode, dark/light theme color.
- **Performance** — dynamic import cho các section nặng (MarketSection, IndustrySection, FeaturedStocks), GZip backend, font Roboto self-host (TTF local, không gọi Google Fonts).
- **Auth UX** — `AuthProvider` cache `permissions[]` và `features[]` trong localStorage; `useAuth().hasPermission()` / `hasFeature()` cho phép FE bật/tắt UI nhanh; backend vẫn enforce.
- **Loading skeleton** thống nhất qua `LoadingState`/`Skeleton`.

---

## 5. Tính Năng Nổi Bật

### Cho nhà đầu tư
- Biểu đồ kỹ thuật cấp pro (lightweight-charts + custom primitive, multi-timeframe).
- Screener cổ phiếu đa tiêu chí với cấu hình tập trung.
- Watchlist drag-and-drop nhiều cột × hàng, lưu vị trí trên server.
- Tài chính theo kỳ — click bar trên biểu đồ ApexCharts để xem giá trị và delta của kỳ đó (sectors & stocks).
- Carousel "Featured Stocks" theo dòng tiền trên trang chủ.
- Tin tức & báo cáo có phân loại + SSR cho SEO.
- SSE realtime cho dữ liệu nóng + polling fallback.

### Cho vận hành / quản trị
- Dashboard admin với KPI trực quan.
- Quản lý subscription, transaction, promotion, license tách bạch.
- Broker program — gán mã, theo dõi giao dịch referred (`transaction:read_referred`).
- Phân quyền chi tiết qua role × permission, FE và BE cùng enforce.
- Moderation watchlist của user.

### Bảo mật
- JWT access + refresh, session table cho phép logout từ xa hoặc từ admin.
- OTP qua email cho register/reset/passwordless login.
- Google OAuth 2.0 hợp nhất với account thường qua `google_id`.
- Bcrypt, CORS whitelist (`finext.vn`, `twan.io.vn`, localhost dev).
- Email rate-limit ở các endpoint công khai (`/emails/*`).
- SSL/TLS qua Nginx với chain hợp lệ.

---

## 6. Roadmap Đang Triển Khai — SePay Auto-Confirm

Theo spec `docs/superpowers/specs/2026-05-06-sepay-integration-design.md` và plan tương ứng, hệ thống đang chuẩn bị thay luồng "admin xác nhận thanh toán thủ công" bằng webhook tự động từ SePay (gói FREE 50 giao dịch/tháng).

**Trạng thái:** Đã thống nhất design và plan. **Chưa có code triển khai trong repo** (`app/routers/sepay_webhooks.py`, `app/(main)/checkout/[orderId]/` chưa tồn tại). Khi triển khai sẽ thêm:

**Backend**
- File mới: `app/utils/sepay_security.py`, `app/schemas/sepay.py`, `app/crud/sepay.py`, `app/routers/sepay_webhooks.py` (`POST /sepay/webhook`).
- `app/schemas/transactions.py` thêm: `order_code` (FNX + 8 ký tự, UNIQUE sparse), `payment_provider` (`sepay` | `manual`), `paid_at`, `sepay_transaction_id`.
- `app/routers/transactions.py` thêm: `GET /me/{id}/qr-info`, `GET /me/{id}/status`.
- `app/crud/transactions.py`: tự hủy order pending cũ khi tạo order mới; `confirm_transaction_payment_via_webhook()` atomic.
- `app/core/scheduler.py`: job auto-cancel pending order quá hạn (mặc định 30 phút), chạy mỗi 5 phút.
- `app/core/config.py` thêm 9 biến môi trường: `SEPAY_ENABLED`, `SEPAY_API_TOKEN`, `SEPAY_WEBHOOK_API_KEY`, `SEPAY_BANK_NAME`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_HOLDER`, `SEPAY_ALLOWED_IPS`, `SEPAY_ORDER_TIMEOUT_MINUTES`, `SEPAY_FREE_TIER_MONTHLY_LIMIT`.
- Collection mới `sepay_webhook_logs` (UNIQUE index `sepay_transaction_id`, TTL 90 ngày trên `received_at`).

**Frontend**
- `services/sepayService.ts` — gọi qr-info + polling status.
- `app/(main)/checkout/[orderId]/page.tsx` (server) + `PageContent.tsx` (client): hiển thị QR động (VietQR), thông tin tài khoản với nút copy, đếm ngược 30 phút, polling status mỗi 5s, thành công thì redirect `/profile/subscriptions`.
- `/plans` được cập nhật: sau khi tạo order, redirect tới `/checkout/{orderId}`.

**Cơ chế an toàn**
- IP whitelist (6 IP của SePay) + API key constant-time compare ở webhook.
- Idempotent: UNIQUE index + atomic `findOneAndUpdate` (PENDING → SUCCEEDED only).
- Strict amount match (không tolerance), regex parse memo `FNX[A-Z2-9]{8}`.
- Kill-switch `SEPAY_ENABLED=false` để tạm tắt và bật lại admin manual confirm.

---

## 7. Thiết Lập Môi Trường

### Yêu cầu
- Python 3.13+ và [UV](https://docs.astral.sh/uv/)
- Node.js + npm
- MongoDB (local hoặc Atlas)
- Docker (production)

### Development

**Backend:**
```bash
cd finext-fastapi
uv sync
uv run uvicorn app.main:app --reload --env-file .env.development
# API: http://127.0.0.1:8000
# Docs: http://127.0.0.1:8000/api/v1/docs
```

**Frontend:**
```bash
cd finext-nextjs
npm install
npm run dev
# App: http://localhost:3000
```

### Production (Docker)
```bash
docker compose --env-file .env.production up -d --build
```

### Cấu hình env

| Môi trường | Backend | Frontend |
|------------|---------|----------|
| Development | `finext-fastapi/.env.development` | `finext-nextjs/.env` |
| Production | `.env.production` (root) | `.env.production` (root) |

Biến quan trọng: `MONGO_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `R2_*` (storage), SMTP config, `NEXT_PUBLIC_API_URL`, `INTERNAL_API_URL`. Khi triển khai SePay sẽ thêm bộ `SEPAY_*` ở mục 6.

---

## 8. Quy Ước Phát Triển

Quy định chi tiết trong [CLAUDE.md](../CLAUDE.md):

- **Python:** type hints bắt buộc, không `except:` bare, không `print()` debug, hàm ≤ 40 dòng.
- **TypeScript:** `strict: true`, tránh `any`, components ≤ 150 dòng.
- **Git:** diff nhỏ, không chạm file ngoài scope, không thêm dependency không hỏi trước.
- **Session protocol:** một task / session, state rõ ràng, compact sớm khi context đầy.
- **Plans/Specs:** mọi feature lớn được mô tả trong `docs/superpowers/specs/` (design) và `docs/superpowers/plans/` (kế hoạch triển khai) trước khi code.

---

## 9. Tham Chiếu Plans & Specs

| Spec / Plan | Mô tả |
|-------------|-------|
| `2026-03-23-watchlist-drag-drop` | Drag-and-drop watchlist + endpoint `POST /watchlists/reorder` (bulk). ✅ Đã triển khai. |
| `2026-03-26-admin-rbac` | Admin RBAC: backend `require_permission`, FE cache permissions, sidebar lọc theo role. ✅ Đã triển khai. |
| `2026-04-16-period-selection` | Click bar trên ApexCharts để chọn kỳ tài chính (sectors & stocks). ✅ Đã triển khai. |
| `2026-04-22-user-guide-pages` | 3 trang `/guides/*` thay khu `learning`. ✅ Đã triển khai. |
| `2026-05-05-home-featured-stocks` | Carousel "Featured Stocks" trên home theo dòng tiền. ✅ Đã triển khai. |
| `2026-05-06-sepay-integration` | Auto-confirm thanh toán qua SePay webhook + trang `/checkout/[orderId]`. 🛠 Đang ở giai đoạn spec/plan, chưa có code. |

---

## Liên Hệ

- **Email:** finext.vn@gmail.com
- **Website:** [finext.vn](https://finext.vn)
- **Ngôn ngữ:** Tiếng Việt (vi_VN)

---

*Tài liệu này được tạo bởi Claude Code dựa trên khảo sát mã nguồn thực tế và các spec/plan trong `docs/superpowers/`. Cập nhật lần cuối: 2026-05-06.*
