# 03 — Backend (`finext-fastapi`)

> Stack, cấu trúc app, 17 API routers, RBAC, hệ thống license/feature và background jobs.

---

## 3.1 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI ≥ 0.115.12, Uvicorn |
| Language | Python 3.13+, type-hinted toàn bộ |
| Package manager | UV (Astral) — `pyproject.toml` |
| Validation | Pydantic v2 (≥ 2.11) + pydantic-settings |
| Database | MongoDB qua **Motor** (async) ≥ 3.7; PyMongo cho index/admin |
| Auth | JWT (`python-jose`), `bcrypt`, Google OAuth (`google-auth` + `oauthlib`) |
| Email | `fastapi-mail`, `aiosmtplib`, Jinja2 templates |
| Storage | `boto3` — Cloudflare R2 / AWS S3 cho avatar và upload |
| Scheduler | APScheduler — cron jobs nội bộ |
| Data | `pandas`, `Pillow` (chart data + ảnh) |
| HTTP | `httpx` (async), `requests` (sync fallback) |
| Test | `pytest`, `pytest-asyncio` |

Entry point: [`finext-fastapi/app/main.py`](../../finext-fastapi/app/main.py).

---

## 3.2 Cấu Trúc App

```
finext-fastapi/app/
├── main.py                   # Entry — lifespan, CORS, GZip, exception handlers
├── auth/                     # JWT, dependencies, permission checks
│   ├── jwt_handler.py
│   ├── dependencies.py       # get_current_user, require_permission
│   └── access.py
├── core/
│   ├── config.py             # Settings (env-driven, pydantic-settings)
│   ├── database.py           # Motor connection, get_database()
│   ├── scheduler.py          # APScheduler start/shutdown
│   └── seeding/              # Seed dữ liệu ban đầu (idempotent)
│       ├── _config.py        # DEFAULT_PERMISSIONS, FEATURES, LICENSES (~17KB)
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
│   └── sse/                  # SSE-specific data fetchers
├── schemas/                  # Pydantic DTOs request/response
├── templates/                # HTML email templates (Jinja2)
│   ├── account_activated.html       (compliance pivot)
│   ├── consultation_request.html
│   ├── email_verification.html
│   ├── open_account_request.html
│   ├── plan_inquiry_request.html
│   ├── pwdless_login.html
│   ├── registration_received.html   (compliance pivot)
│   ├── reset_password.html
│   └── subscription_reminder.html
└── utils/
    ├── security.py           # Hash, token utilities
    ├── google_auth.py        # Verify Google ID token
    ├── email_utils.py        # Render template + send (with MX check)
    ├── otp_utils.py          # Sinh & verify OTP
    ├── storage.py            # R2/S3 upload
    ├── response_wrapper.py   # StandardApiResponse[T]
    └── types.py              # PyObjectId và custom types
```

**Quy ước layering:** `routers/` chỉ chứa HTTP logic + validation. Business logic và Mongo queries nằm trong `crud/`. Schemas đặt ở `schemas/` (mỗi module 1 file).

---

## 3.3 API Endpoints

**Prefix chung:** `/api/v1`
**Docs:** `/api/v1/docs` (Swagger), `/api/v1/redoc`

Tất cả endpoint trả về `StandardApiResponse[T]`:
```json
{ "status": 200, "message": "OK", "data": { ... } }
```

### Bảng routers

| Router | Prefix | Trách nhiệm chính |
|--------|--------|-------------------|
| `auth` | `/auth` | Đăng ký, đăng nhập (email/pwd + Google), passwordless OTP login, refresh token, logout, `GET /me`, `GET /me/features`, `GET /me/permissions`. |
| `users` | `/users` | CRUD user, đổi mật khẩu, gán roles, list user được bảo vệ (`/protected`). |
| `roles` | `/roles` | CRUD role, gán/thu hồi permission cho role (admin-only). |
| `permissions` | `/permissions` | CRUD permission + `GET /categories` + `GET /category/{name}` (admin-only). |
| `sessions` | `/sessions` | `GET /me`, đăng xuất phiên cụ thể, admin xem/đăng xuất tất cả phiên. |
| `subscriptions` | `/subscriptions` | `GET /me`, CRUD subscription, activate/deactivate, gán license cho user. |
| `transactions` | `/transactions` | `POST /me/orders` (user tự tạo order), `POST /admin/create`, list/get, `PUT /admin/{id}/confirm-payment`, `PUT /admin/{id}/cancel`. **Confirm thủ công bởi admin/manager.** |
| `licenses` | `/licenses` | CRUD license, activate/deactivate (manager+). |
| `features` | `/features` | CRUD feature flag (manager+), gắn vào license. |
| `promotions` | `/promotions` | CRUD mã khuyến mãi + `GET /{code}/validate` cho user trong checkout. |
| `brokers` | `/brokers` | CRUD broker (admin), `GET /me` cho user xem broker đang gắn, đổi mã broker. |
| `watchlists` | `/watchlists` | CRUD watchlist của user (`/me`), `POST /reorder` bulk drag-drop, admin moderation. |
| `otps` | `/otps` | `POST /request`, `POST /verify` (public); admin list & invalidate. |
| `emails` | `/emails` | Form gửi mail (rate-limited): `/send`, `/consultation`, `/open-account`. |
| `uploads` | `/uploads` | Upload + nén ảnh (Pillow) → R2/S3. |
| `sse` | `/sse` | Server-Sent Events: `/stream/{keyword}` (filter `?ticker=...`), `/keywords`, `/rest/{keyword}` REST fallback. |
| `dashboard` | `/admin/dashboard` | `/stats` cho admin/manager — KPI doanh thu, user, transaction. |

### Response wrapper

File: [`finext-fastapi/app/utils/response_wrapper.py`](../../finext-fastapi/app/utils/response_wrapper.py)

```python
class StandardApiResponse[T](BaseModel):
    status: int
    message: str
    data: T | None = None
```

Exception handlers trong `main.py` đảm bảo cả `HTTPException` và `RequestValidationError` cũng trả format này (422 với mảng `errors`).

---

## 3.4 Phân Quyền — RBAC

### Cấu trúc

- **4 roles** (đặc quyền tăng dần): `user` → `broker` → `manager` → `admin`.
- **~50 permissions** trong 6 categories: `user_management`, `transaction_management`, `broker_management`, `subscription_management`, `admin_system`, `others`.
- Mapping role → permission được **seed** từ [`app/core/seeding/_config.py`](../../finext-fastapi/app/core/seeding/_config.py) lúc lifespan khởi động (idempotent — chỉ thêm record còn thiếu).

### Enforce 2 lớp

| Lớp | Cơ chế |
|-----|--------|
| **Frontend** | Cache `permissions: string[]` trong localStorage; `useAuth().hasPermission(key)` để bật/tắt UI |
| **Backend** | `Depends(require_permission(resource, action))` ở từng endpoint — single source of truth |

### Permissions tiêu biểu

| Permission | Vai trò được phép |
|------------|-------------------|
| `user:delete_any`, `user:manage_roles` | admin |
| `role:manage`, `permission:manage`, `session:manage_any`, `otp:manage`, `broker:create/update_any/delete_any` | admin |
| `user:create/list/read_any/update_any`, `subscription:*`, `transaction:read_any/confirm_payment_any/cancel_any`, `license:manage`, `feature:manage`, `promotion:manage`, `watchlist:manage_any` | admin + manager |
| `transaction:read_referred` | broker |
| `transaction:create_own/read_own`, `watchlist:manage_own/read_own`, `user:update_own` | tất cả user đã đăng nhập |

---

## 3.5 Hệ Thống License & Feature

### 5 gói license mặc định (seed)

| Key | Tên | Giá (VND) | Thời hạn | Dành cho |
|-----|-----|-----------|----------|----------|
| `ADMIN` | License Quản Trị Viên | 0 | ~∞ | Admin nội bộ |
| `MANAGER` | License Quản Lý | 0 | ~∞ | Nhân sự vận hành |
| `PARTNER` | License Đối Tác | 0 | ~∞ | Broker giới thiệu |
| `PATRON` | License Người Ủng Hộ | 10.000.000 | 365 ngày | Nhà đầu tư pro |
| `BASIC` | License Cơ Bản | 0 | ~∞ | Người dùng miễn phí |

### Feature flags

Mỗi license gắn danh sách **feature_keys**:
- `basic_feature`
- `advanced_feature`
- `broker_feature`
- `manager_feature`
- `admin_feature`

Frontend đọc `feature_keys` từ subscription đang active để bật/tắt UI; backend kiểm tra entitlement khi cần.

> ⚠️ **Sau compliance pivot 2026-05-07:** `ADVANCED_AND_ABOVE` ở frontend (`components/auth/features.ts`) đã include `FEATURES.BASIC` ở đầu list → mọi user logged-in (kể cả gói BASIC) xem được toàn bộ content gated trước đây. Xem [`06-compliance-pivot.md`](06-compliance-pivot.md).

---

## 3.6 Lifecycle & Background Jobs

Trong `lifespan` của `main.py`:

1. **`connect_to_mongo()`** — khởi tạo Motor client.
2. **`seed_initial_data()`** — seed permissions / roles / features / licenses / brokers / promotions / users mẫu nếu thiếu (idempotent).
3. **`start_scheduler()`** — APScheduler khởi động các job:
   - Nhắc subscription sắp hết hạn (gửi mail từ template `subscription_reminder.html`).
   - Dọn OTP hết hạn.
4. **Shutdown:** `shutdown_scheduler()` → `close_mongo_connection()`.

---

## 3.7 Auth Flow Highlights

### Token model
- **Access token** (JWT) — short-lived, gửi trong header `Authorization: Bearer <token>`.
- **Refresh token** — lưu trong DB collection `sessions`, cho phép admin/user logout từ xa.

### Đăng ký (sau compliance pivot)
- ❌ Không còn OTP self-verify.
- ✅ DNS MX check (`email-validator` + `dnspython`) trước khi tạo user → catch domain không tồn tại.
- ✅ Gửi mail "yêu cầu đã ghi nhận" (`registration_received.html`) **SYNC**, fail → rollback delete user.
- ✅ User `is_active=False`, chờ admin manual approve.

### Admin activation
- Endpoint `PUT /api/v1/users/{id}` detect transition `is_active False → True` → MX check + gửi mail "tài khoản đã kích hoạt" (`account_activated.html`) SYNC → fail → rollback DB.

### Passwordless login
- Endpoint `POST /api/v1/auth/login/otp` — user nhập email → gửi OTP qua mail (template `pwdless_login.html`) → verify → cấp JWT. Dùng cho forgot-password flow.

### Google OAuth
- ⚠️ **Disabled UI** sau pivot. Backend code vẫn còn (route `/auth/google/callback` bị 403 qua `BLOCKED_ROUTES` ở frontend middleware).

Chi tiết thay đổi auth flow: [`06-compliance-pivot.md`](06-compliance-pivot.md#auth-flow-be--fe).

---

## 3.8 Database

- **MongoDB** qua Motor async driver.
- Database chính: `user_db`.
- Collections: `users`, `roles`, `permissions`, `sessions`, `subscriptions`, `transactions`, `licenses`, `features`, `promotions`, `brokers`, `watchlists`, `otps`, etc.
- Indexes được tạo trong seeding hoặc lần đầu insert (UNIQUE trên `email`, `code`, ...).
- **PyObjectId** custom type (trong `utils/types.py`) để bridge ObjectId ↔ JSON.

---

## 3.9 SSE (Server-Sent Events)

- Endpoint: `GET /api/v1/sse/stream/{keyword}` (optional `?ticker=...` filter).
- Mỗi `keyword` map tới một data source/cron trong [`finext-fastapi/app/crud/sse/`](../../finext-fastapi/app/crud/sse/).
- Backend dùng `EventSourceResponse` (sse-starlette).
- Client (Next.js) dùng `services/sseClient.ts` với auto-reconnect.
- REST fallback: `GET /api/v1/sse/rest/{keyword}` — trả snapshot khi SSE không khả dụng.

Keywords phổ biến: `home_today_stock`, `vnindex_today`, `vn30_today`, `sector_strength`, ... (xem `GET /api/v1/sse/keywords` để list runtime).
