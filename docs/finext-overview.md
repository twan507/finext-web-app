# Finext — Nền Tảng Phân Tích & Sàng Lọc Cổ Phiếu Thông Minh

> *Your Next Financial Step* — Nền tảng web phân tích chứng khoán toàn diện dành cho nhà đầu tư Việt Nam, cung cấp dữ liệu thị trường thời gian thực, công cụ phân tích kỹ thuật chuyên sâu, bộ lọc cổ phiếu và hệ thống quản lý thuê bao cho cộng đồng người dùng đa dạng.

**Website:** [finext.vn](https://finext.vn)
**Repository:** [twan507/finext-web-app](https://github.com/twan507/finext-web-app)

---

## 1. Tổng Quan Sản Phẩm

Finext là một **web application full-stack** được thiết kế cho nhà đầu tư cá nhân và tổ chức tại Việt Nam, tập trung vào ba giá trị cốt lõi:

1. **Dữ liệu & Phân tích chuyên sâu** — Theo dõi VNINDEX, VN30, HNX, UPCOM; phân tích nhóm ngành, dòng tiền, báo cáo thị trường.
2. **Công cụ hỗ trợ ra quyết định** — Biểu đồ kỹ thuật với nhiều chỉ báo, bộ lọc (screener) cổ phiếu, watchlist cá nhân, tín hiệu mua/bán.
3. **Hệ sinh thái đối tác** — Chương trình môi giới (broker/partner), mã khuyến mãi, gói thuê bao linh hoạt theo nhu cầu người dùng.

### Đối tượng người dùng

| Role | Mô tả |
|------|-------|
| **User** | Nhà đầu tư cá nhân, sử dụng tính năng theo gói license đã mua. |
| **Broker** | Đối tác giới thiệu, hưởng hoa hồng từ giao dịch referred. |
| **Manager** | Quản lý vận hành — CRUD users, subscriptions, transactions, promotions. |
| **Admin** | Toàn quyền hệ thống — quản lý roles, permissions, features, licenses. |

---

## 2. Kiến Trúc Tổng Thể

```
┌──────────────────────────────────────────────────────────────┐
│                      NGINX (reverse proxy, SSL)              │
└─────────────────┬─────────────────────────┬──────────────────┘
                  │                         │
      ┌───────────▼───────────┐   ┌─────────▼──────────────┐
      │  Next.js 15 Frontend  │   │  FastAPI Backend       │
      │  (TypeScript, MUI 7)  │◄──┤  (Python 3.13, Motor)  │
      │  Port 3000            │   │  Port 8000             │
      └───────────────────────┘   └─────────┬──────────────┘
                                            │
                                  ┌─────────▼──────────┐
                                  │     MongoDB        │
                                  │  (motor async)     │
                                  └────────────────────┘
```

**Deploy:** Docker Compose với 3 services (`nginx`, `fastapi`, `nextjs`) — Nginx handle SSL + proxy, FastAPI giới hạn 2GB/1.5 CPU, Next.js 2GB/2 CPU.

### Thư mục gốc

```
finext-web-app/
├── finext-fastapi/      # Python backend (FastAPI + MongoDB)
├── finext-nextjs/       # TypeScript frontend (Next.js 15)
├── nginx/               # Reverse proxy config
├── ssl/                 # SSL certificates
├── docs/                # Tài liệu (bao gồm file này)
├── docker-compose.yml   # Production orchestration
└── CLAUDE.md            # Hướng dẫn làm việc với AI assistant
```

---

## 3. Backend — `finext-fastapi`

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | FastAPI 0.115+, Uvicorn (standard) |
| **Language** | Python 3.13+, type-hinted toàn bộ |
| **Package manager** | UV (Astral) — nhanh hơn pip nhiều lần |
| **Validation** | Pydantic v2 + pydantic-settings |
| **Database** | MongoDB qua Motor (async) + PyMongo |
| **Auth** | JWT (python-jose), bcrypt, Google OAuth 2.0 |
| **Email** | fastapi-mail, aiosmtplib, Jinja2 templates |
| **Storage** | boto3 — Cloudflare R2 / AWS S3 cho avatars & uploads |
| **Scheduler** | APScheduler — cron jobs cho reminder, cleanup |
| **Data** | pandas, Pillow cho xử lý dữ liệu chart & ảnh |

### Cấu Trúc App

```
finext-fastapi/app/
├── main.py                # Entry point — lifespan, CORS, GZip, exception handlers
├── auth/                  # JWT handler, dependencies, permission checks
│   ├── jwt_handler.py
│   ├── dependencies.py    # get_current_user, require_permission
│   └── access.py
├── core/
│   ├── config.py          # Settings (env-driven)
│   ├── database.py        # Motor connection, get_database()
│   ├── scheduler.py       # APScheduler start/shutdown
│   └── seeding/           # Seed dữ liệu ban đầu khi khởi động
│       ├── _config.py             # DEFAULT_PERMISSIONS, FEATURES
│       ├── _seed_users.py
│       ├── _seed_roles.py
│       ├── _seed_permissions.py
│       ├── _seed_features.py
│       ├── _seed_licenses.py
│       ├── _seed_brokers.py
│       ├── _seed_promotions.py
│       └── _seed_subscriptions.py
├── routers/               # 17 API routers (xem bảng bên dưới)
├── crud/                  # Data access layer — tách rời khỏi HTTP
├── schemas/               # Pydantic models (request/response DTOs)
├── templates/             # HTML email templates
│   ├── consultation_request.html
│   ├── email_verification.html
│   ├── open_account_request.html
│   ├── plan_inquiry_request.html
│   ├── pwdless_login.html
│   ├── reset_password.html
│   └── subscription_reminder.html
└── utils/
    ├── security.py        # Password hashing, token utilities
    ├── google_auth.py     # Google OAuth verify
    ├── email_utils.py     # Send email, render template
    ├── otp_utils.py       # OTP generation & validation
    ├── storage.py         # R2/S3 upload
    ├── response_wrapper.py  # StandardApiResponse[T]
    └── types.py           # PyObjectId và custom types
```

### API Endpoints (prefix `/api/v1`)

| Router | Prefix | Trách nhiệm chính |
|--------|--------|-------------------|
| `auth` | `/auth` | Đăng ký, đăng nhập (email/password + Google), refresh token, quên mật khẩu, passwordless login. |
| `users` | `/users` | CRUD users, cập nhật profile cá nhân, đổi mật khẩu, upload avatar. |
| `roles` | `/roles` | CRUD vai trò, gán/thu hồi quyền theo role. |
| `permissions` | `/permissions` | CRUD permissions — admin only. |
| `sessions` | `/sessions` | Xem & đăng xuất các phiên đang hoạt động. |
| `subscriptions` | `/subscriptions` | Gán/gia hạn/hủy gói license cho người dùng. |
| `transactions` | `/transactions` | Tạo, xác nhận thanh toán, hủy, list giao dịch. |
| `brokers` | `/brokers` | Quản lý Đối tác & mã giới thiệu. |
| `licenses` | `/licenses` | CRUD gói dịch vụ — admin/manager. |
| `promotions` | `/promotions` | Mã khuyến mãi (validate + manage). |
| `emails` | `/emails` | Gửi email yêu cầu tư vấn, mở tài khoản, hỏi gói. |
| `otps` | `/otps` | Sinh & xác thực OTP — admin có thể quản lý tất cả. |
| `watchlists` | `/watchlists` | Danh sách theo dõi cổ phiếu cá nhân (CRUD). |
| `uploads` | `/uploads` | Upload file/image lên R2/S3. |
| `features` | `/features` | CRUD tính năng (gắn vào license). |
| `sse` | `/sse` | Server-Sent Events — push dữ liệu realtime. |
| `dashboard` | `/admin/dashboard` | Thống kê cho admin (revenue, user metrics). |

Response thống nhất qua `StandardApiResponse[T]`:
```json
{ "status": 200, "message": "OK", "data": { ... } }
```

### Phân Quyền — Role + Permission

- **4 roles** (thứ tự đặc quyền tăng dần): `user` → `broker` → `manager` → `admin`.
- **~40+ permissions** chia theo 6 categories: `user_management`, `transaction_management`, `broker_management`, `subscription_management`, `admin_system`, `others`.
- Mapping role → permission được seed tự động từ `DEFAULT_PERMISSIONS_DATA`.
- Ví dụ: `user:delete_any` chỉ admin; `user:update_own` dành cho tất cả; `transaction:read_referred` chỉ broker.

### Hệ Thống License & Feature

5 gói license mặc định:

| Key | Tên | Giá (VND) | Thời hạn | Dành cho |
|-----|-----|-----------|----------|----------|
| `ADMIN` | License Quản Trị Viên | 0 | ~∞ | Admin nội bộ |
| `MANAGER` | License Quản Lý | 0 | ~∞ | Nhân sự quản lý |
| `PARTNER` | License Đối Tác | 0 | ~∞ | Broker giới thiệu |
| `PATRON` | License Người ủng hộ | 10.000.000 | 365 ngày | Nhà đầu tư pro |
| `BASIC` | License Cơ bản | 0 | ~∞ | Người dùng miễn phí |

Features gắn vào license: `basic_feature`, `advanced_feature`, `broker_feature`, `manager_feature`, `admin_feature`. Frontend kiểm tra `feature_keys` của subscription để bật/tắt UI tương ứng.

### Lifecycle & Seeding

Khi `lifespan` khởi động:

1. Kết nối MongoDB (`connect_to_mongo`)
2. Seed dữ liệu mặc định (`seed_initial_data`) — idempotent, chỉ thêm record còn thiếu
3. Khởi động APScheduler (reminder email, cleanup OTP, v.v.)
4. Khi shutdown: dừng scheduler → đóng Mongo

---

## 4. Frontend — `finext-nextjs`

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15.5 (App Router + Turbopack) |
| **Language** | TypeScript 5.7 strict mode |
| **UI Library** | MUI 7 (Material UI) + Emotion |
| **Icons** | `@mui/icons-material`, `@iconify/react` |
| **Charts** | `lightweight-charts` (candlestick), `apexcharts` (thống kê) |
| **Data fetching** | TanStack Query v5 + custom `apiClient` |
| **Realtime** | Server-Sent Events (`sseClient.ts`) + polling fallback |
| **Auth** | JWT + `@react-oauth/google` cho Google Login |
| **Drag & Drop** | `@dnd-kit/*` — sắp xếp watchlist, indicators |
| **Theming** | `next-themes` — dark/light mode |
| **Testing** | Playwright |

### Cấu Trúc App Router

```
finext-nextjs/app/
├── layout.tsx              # Root — fonts, metadata SEO, providers, PWA
├── globals.css
├── manifest.ts             # PWA manifest
├── robots.ts, sitemap.ts   # SEO
├── (auth)/                 # Route group — không có main layout
│   ├── login/
│   ├── register/
│   └── forgot-password/
├── (main)/                 # Route group — public app với header/footer
│   ├── home/               # Trang chủ: market overview, industry, news
│   ├── markets/            # Tổng quan thị trường
│   ├── stocks/             # Sàng lọc cổ phiếu (screener)
│   │   ├── [symbol]/       # Chi tiết 1 mã
│   │   └── screenerConfig.ts
│   ├── charts/[id]/        # Biểu đồ kỹ thuật full-screen
│   │   ├── CandlestickChart.tsx
│   │   ├── IndicatorsPanel.tsx       # Chỉ báo kỹ thuật
│   │   ├── BandFillPrimitive.ts      # Custom primitive cho lightweight-charts
│   │   ├── WatchlistPanel.tsx
│   │   ├── DetailPanel.tsx
│   │   ├── PanelNewsList.tsx
│   │   ├── ChartToolbar.tsx
│   │   └── aggregateTimeframe.ts     # Aggregate candles theo timeframe
│   ├── sectors/            # Phân tích nhóm ngành
│   ├── groups/             # Nhóm cổ phiếu tùy chọn
│   ├── commodities/        # Thị trường hàng hóa
│   ├── international/      # Tài chính quốc tế
│   ├── macro/              # Kinh tế vĩ mô
│   ├── news/               # Tin tức
│   ├── reports/            # Báo cáo (có server-side fetch)
│   ├── watchlist/          # Danh sách theo dõi
│   ├── learning/           # Kiến thức đầu tư
│   ├── plans/              # Các gói dịch vụ
│   ├── open-account/       # Mở tài khoản chứng khoán
│   ├── policies/           # Điều khoản
│   ├── support/            # Hỗ trợ
│   └── profile/            # Hồ sơ cá nhân
└── admin/                  # Khu vực quản trị (yêu cầu role admin/manager)
    ├── dashboard/
    ├── users/
    ├── roles/
    ├── permissions/
    ├── sessions/
    ├── features/
    ├── licenses/
    ├── subscriptions/
    ├── transactions/
    ├── brokers/
    ├── promotions/
    ├── otps/
    └── watchlists/
```

### Modules Hỗ Trợ

```
finext-nextjs/
├── components/
│   ├── auth/            # AuthProvider, guards
│   ├── provider/        # Mui/Theme/Notification providers
│   ├── layout/          # Header, Sidebar, Footer
│   ├── states/          # LoadingState, EmptyState, ErrorState
│   ├── themeToggle/
│   └── common/
├── services/
│   ├── apiClient.ts     # Axios/fetch wrapper với JWT injection, refresh flow
│   ├── authService.ts   # Login, register, OAuth, session
│   ├── sseClient.ts     # Server-Sent Events client
│   ├── pollingClient.ts # Fallback polling
│   └── core/            # config, session, types
├── hooks/               # Custom React hooks
├── theme/               # MUI theme tokens (light/dark)
├── utils/
├── middleware.ts        # Next.js middleware — route guard
├── scripts/
└── public/              # Icons, PWA assets, finext-panel.png
```

### Tối Ưu & Trải Nghiệm

- **SEO toàn diện:** JSON-LD (`WebSite`, `Organization`, `SiteNavigationElement`), OpenGraph, Twitter cards, sitemap, robots.
- **PWA-ready:** Service worker, manifest, Apple touch icon, standalone mode.
- **Performance:** Dynamic import cho các section nặng (MarketSection, IndustrySection), GZip backend, font self-host (Roboto local).
- **Runtime API URL:** Biến `INTERNAL_API_URL` cho SSR fetch qua Docker internal network, còn `NEXT_PUBLIC_API_URL` cho client.

---

## 5. Tính Năng Nổi Bật

### Cho Nhà Đầu Tư
- **Biểu đồ kỹ thuật nâng cao** với lightweight-charts — nến Nhật, chỉ báo tùy biến (MA, RSI, MACD, Bollinger…), custom primitive, khung thời gian linh hoạt.
- **Screener cổ phiếu** đa tiêu chí — filter theo ngành, vốn hóa, tăng trưởng, chỉ số tài chính.
- **Watchlist & Drag-and-drop** sắp xếp danh sách quan tâm.
- **Tin tức & Báo cáo** theo nhóm ngành, mã cổ phiếu.
- **Dữ liệu realtime** qua SSE với fallback polling.

### Cho Quản Trị
- **Dashboard admin** — thống kê doanh thu, user growth, subscription metrics.
- **Quản lý subscription & transaction** — tạo đơn, xác nhận thanh toán, gia hạn, hủy.
- **Hệ thống Promotion** — phát hành mã, validate, áp dụng.
- **Broker program** — cấp mã giới thiệu, theo dõi giao dịch được giới thiệu.
- **Phân quyền chi tiết** qua role-permission matrix.

### Về Bảo Mật
- JWT access + refresh token, session management cho phép đăng xuất từ xa.
- OTP qua email cho login không mật khẩu & reset password.
- Google OAuth 2.0 hợp nhất với account truyền thống qua `google_id`.
- Bcrypt hashing, CORS whitelist (`finext.vn`, `twan.io.vn`, localhost dev).
- SSL/TLS qua Nginx với certificate chain hợp lệ.

---

## 6. Thiết Lập Môi Trường

### Yêu Cầu
- Python 3.13+ và [UV](https://docs.astral.sh/uv/)
- Node.js + npm
- MongoDB (local hoặc Atlas)
- Docker (cho production)

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

### Cấu Hình Env

| Môi trường | Backend | Frontend |
|------------|---------|----------|
| Development | `finext-fastapi/.env.development` | `finext-nextjs/.env` |
| Production | `.env.production` (root) | `.env.production` (root) |

Biến quan trọng: `MONGO_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `R2_*` (storage), SMTP config, `NEXT_PUBLIC_API_URL`, `INTERNAL_API_URL`.

---

## 7. Quy Ước Phát Triển

Được quy định chi tiết trong [CLAUDE.md](../CLAUDE.md):

- **Python:** type hints bắt buộc, không `except:` bare, không `print()` debug, hàm ≤ 40 dòng.
- **TypeScript:** `strict: true`, tránh `any`, components ≤ 150 dòng.
- **Git:** commit diff nhỏ, không chạm file ngoài scope, không thêm dependency không hỏi trước.
- **Session protocol:** một task/session, state rõ ràng, compact early khi context đầy.

---

## 8. Tương Lai & Mở Rộng

Các điểm neo đã có sẵn để phát triển tiếp:

- **AI agent integration** — thư mục `.claude/` và `docs/superpowers/` đã chuẩn bị cho workflow có AI hỗ trợ.
- **Scheduler** — APScheduler sẵn sàng cho các job analytics, báo cáo định kỳ.
- **SSE pipeline** — hạ tầng realtime có thể mở rộng cho alert, notification push.
- **Dashboard admin** — còn nhiều không gian cho biểu đồ thống kê chuyên sâu.
- **PWA** — đã configure, có thể đóng gói lên app store qua TWA/Capacitor.

---

## Liên Hệ

- **Email:** finext.vn@gmail.com
- **Website:** [finext.vn](https://finext.vn)
- **Ngôn ngữ:** Tiếng Việt (vi_VN)

---

*Tài liệu này được tạo bởi Claude Code dựa trên việc khảo sát mã nguồn thực tế. Cập nhật lần cuối: 2026-04-20.*
