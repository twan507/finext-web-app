# 03 — Backend (`finext-fastapi`)

> Stack, cấu trúc app, 18 API routers, RBAC, auth, market SSE, Finext AI và background jobs.

**Cập nhật:** 2026-07-21

---

## 3.1 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI ≥ 0.115.12, Uvicorn (`--workers 2`) *(2026-06-02)* |
| Language | Python 3.13+, codebase dùng type hints rộng rãi |
| Package manager | UV (Astral) — `pyproject.toml` |
| Validation/config | Pydantic v2 (≥ 2.11); `pydantic-settings` có trong deps nhưng `core/config.py` hiện dùng `python-dotenv` + `os.getenv` |
| Database | MongoDB **standalone** qua **Motor** (async) ≥ 3.7; pool `maxPoolSize=50, minPoolSize=5` |
| Auth | JWT (`python-jose`), `bcrypt`, Google OAuth (`google-auth` + `oauthlib`) |
| Email | `fastapi-mail`, `aiosmtplib`, Jinja2 templates |
| Storage | `boto3` — Cloudflare R2 / AWS S3 cho avatar và upload |
| Scheduler | APScheduler — cron jobs nội bộ (gated bằng fcntl lock cho multi-worker) |
| Data | `Pillow` (ảnh). `pandas` còn trong deps nhưng SSE đã không dùng *(2026-06-02)* |
| HTTP | `httpx` (async), `requests` (sync fallback) |
| Test | `pytest`, `pytest-asyncio` |

Entry point: [`finext-fastapi/app/main.py`](../../finext-fastapi/app/main.py).

### Multi-worker *(2026-06-02)*

- Uvicorn chạy `--workers 2` ([`dockerfile`](../../finext-fastapi/dockerfile)) → 2 process độc lập, mỗi process có event loop riêng → tránh nghẽn khi 1 worker bị block.
- **Scheduler gate qua fcntl**: file lock ở `/tmp/finext_scheduler.lock` ([`scheduler.py`](../../finext-fastapi/app/core/scheduler.py)). Chỉ worker leader chạy cron job → không gửi mail/cron duplicate. Worker leader die → OS release lock → worker khác take over.
- **Seeding chạy 2 lần**: lifespan mỗi worker đều gọi `seed_initial_data`. Hiện idempotent (upsert) nên OK, có thể thấy log `E11000 duplicate key` vô hại lần đầu.
- **Windows dev:** `scheduler.py` guard import `fcntl` và bỏ file lock trên Windows; phù hợp với dev một worker. Production Linux vẫn dùng lock leader.

---

## 3.2 Cấu Trúc App

```
finext-fastapi/app/
├── main.py                   # Entry — lifespan, CORS, exception handlers, include routers
├── agent/                    # Agent loop, provider adapters, context/KB, tool gateway
├── auth/                     # JWT, dependencies, permission checks
│   ├── jwt_handler.py
│   ├── dependencies.py       # get_current_user, require_permission
│   └── access.py
├── core/
│   ├── config.py             # os.getenv + python-dotenv, constants auth/OTP/agent
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
├── routers/                  # 18 API routers (mục 3.3), gồm chat.py
├── crud/                     # Data access layer — tách khỏi HTTP
│   ├── chat.py               # Persistence/quota/cost cho Finext AI
│   └── sse/                  # 49 market/reference query keywords
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
**Docs:** chỉ khi `ENVIRONMENT=development`: `/api/v1/docs` (Swagger), `/api/v1/redoc` và `/api/v1/openapi.json`. Mặc định/production đều tắt fail-safe.

REST business endpoints nhìn chung trả `StandardApiResponse[T]`:
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
| `sse` | `/sse` | Market SSE: `GET /stream?keyword=...&ticker=...`, `GET /keywords`, `GET /rest/{keyword}`. |
| `chat` | `/chat` | Finext AI: `POST /stream` (SSE), `GET /quota`, list/detail/delete hội thoại, pin/rename và feedback message. |
| `dashboard` | `/admin/dashboard` | `/stats` cho user có `transaction:read_any` hoặc `transaction:read_referred`; broker chỉ thấy dữ liệu referral của mình. |

Ngoại lệ không dùng wrapper gồm market/chat `StreamingResponse`, một số response auth token và hai root endpoint trả plain object.

### Response wrapper

File: [`finext-fastapi/app/utils/response_wrapper.py`](../../finext-fastapi/app/utils/response_wrapper.py)

```python
DataT = TypeVar("DataT")

class StandardApiResponse(BaseModel, Generic[DataT]):
    status: int
    message: str | None = None
    data: DataT | None = None
```

Exception handlers trong `main.py` đảm bảo `HTTPException` và `RequestValidationError` trước khi stream mở cũng trả format này (422 có mảng `errors`).

---

## 3.4 Phân Quyền — RBAC

### Cấu trúc

- **4 roles** (đặc quyền tăng dần): `user` → `broker` → `manager` → `admin`.
- **44 permission được seed** trong 6 categories: `user_management`, `transaction_management`, `broker_management`, `subscription_management`, `admin_system`, `others`.
- Mapping role → permission được **seed** từ [`app/core/seeding/_config.py`](../../finext-fastapi/app/core/seeding/_config.py) lúc lifespan khởi động (idempotent — chỉ thêm record còn thiếu).

### Enforce 2 lớp

| Lớp | Cơ chế |
|-----|--------|
| **Frontend** | Cache `permissions: string[]` trong localStorage; `useAuth().hasPermission(key)` để bật/tắt UI |
| **Backend** | Endpoint self-service dùng current-user/ownership checks; endpoint quản trị dùng `require_permission(...)` hoặc permission check tương ứng — đây là security boundary |

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

> **Sau compliance pivot 2026-05-07:** `ADVANCED_AND_ABOVE` include `FEATURES.BASIC` → bypass tier ở các khu vực cũ. Ngoại lệ hiện hành: ba tab danh mục của `/phase` dùng `ADVANCED_AND_ABOVE_STRICT`, không gồm BASIC. Xem [`06-compliance-pivot.md`](06-compliance-pivot.md).

---

## 3.6 Lifecycle & Background Jobs

Trong `lifespan` của `main.py`:

1. **`connect_to_mongo()`** — khởi tạo Motor client.
2. **`seed_initial_data()`** — seed permissions / roles / features / licenses / brokers / promotions / users mẫu nếu thiếu (idempotent).
3. **`start_scheduler()`** — APScheduler chạy job hằng ngày lúc 00:00:
   - Deactivate subscription hết hạn.
   - Deactivate promotion hết hạn.
   - Gửi mail nhắc subscription còn 7 ngày.
4. **Shutdown:** `shutdown_scheduler()` → `close_mongo_connection()`.

---

## 3.7 Auth Flow Highlights

### Token model
- **Access token** (JWT) — TTL 60 phút (`ACCESS_TOKEN_EXPIRE_MINUTES=60`), gửi trong header `Authorization: Bearer <token>`.
- **Refresh token** — TTL cố định 7 ngày trong `config.py`; cookie HttpOnly tên `finext_refresh_token`. Collection `sessions` lưu `access_jti` và `refresh_jti` để revoke/logout từ xa.
- **Device metadata**: `sessions.device_info` lưu User-Agent raw để hiển thị ở `/profile/login-sessions` và `/admin/sessions`. Không strict-compare User-Agent khi refresh; refresh lookup theo `refresh_jti` trong DB.

### Đăng ký (OTP self-verify — khôi phục 2026-07-21)
- ✅ DNS MX check (`email-validator` + `dnspython`) trước khi tạo user → catch domain không tồn tại. *(Giữ lại từ pivot — không liên quan compliance.)*
- ✅ User tạo với `is_active=False` → sinh OTP `email_verification` (TTL 5 phút) → gửi mail qua `BackgroundTasks`.
- ✅ Không tạo được OTP record → rollback delete user (tránh user "mồ côi" không thể active).
- ✅ User nhập mã ở `POST /api/v1/otps/verify` → tự động set `is_active=True`. **Không cần admin duyệt.**
- Mail `registration_received.html` đã bỏ (mail OTP thay thế); template vẫn giữ trong repo.

### Admin activation (vẫn dùng được)
- Endpoint `PUT /api/v1/users/{id}` detect transition `is_active False → True` → MX check + gửi mail "tài khoản đã kích hoạt" (`account_activated.html`) SYNC → fail → rollback DB. Giờ là đường phụ, không còn bắt buộc.

### Passwordless login
- `POST /api/v1/otps/request` phát OTP loại passwordless; `POST /api/v1/auth/login-otp` nhận email + OTP đã phát để verify và cấp JWT. Template mail: `pwdless_login.html`.

### Google OAuth
- ✅ **Đã bật lại 2026-07-21.** Backend chưa từng bị tắt; frontend gỡ `{false &&}` ở Login/RegisterForm và bỏ `/auth/google/callback` khỏi `BLOCKED_ROUTES`.
- Login Google với user đang `is_active=False` sẽ tự activate ([`crud/users.py`](../../finext-fastapi/app/crud/users.py) `get_or_create_user_from_google_sub_email`) — hành vi mong muốn theo mô hình self-verify.

Chi tiết thay đổi auth flow: [`06-compliance-pivot.md §6.7`](06-compliance-pivot.md#67-rollback-một-phần-2026-07-21).

---

## 3.8 Database

- **MongoDB** qua Motor async driver. `database.py` khởi tạo sẵn `user_db`, `stock_db`, `agent_db`; `get_database()` có thể mở lazy database khác như `ref_db`.
- **`user_db`:** auth/RBAC, sessions, thuê bao/giao dịch/watchlist/OTP và `chat_conversations`, `chat_messages`, `chat_quota`.
- **`stock_db`:** market feeds và các collection `phase_*` phục vụ page Giai đoạn thị trường.
- **`agent_db`:** nguồn dữ liệu chỉ đọc cho Finext AI qua policy/tool gateway (`find`, `aggregate`, `stats`).
- **`ref_db`:** map/reference data; hiện được query lazy bởi các keyword như `index_map`.
- Indexes được tạo trong seeding hoặc lần đầu insert (UNIQUE trên `email`, `code`, ...).
- **PyObjectId** custom type (trong `utils/types.py`) để bridge ObjectId ↔ JSON.

---

## 3.9 SSE (Server-Sent Events)

- Stream: `GET /api/v1/sse/stream?keyword=<k>&ticker=<t>`; `keyword` bắt buộc, `ticker` optional.
- Registry có đúng **49 keyword** tại HEAD (gồm legacy `phase_signal`). Mỗi keyword map tới một query function trong [`finext-fastapi/app/crud/sse/`](../../finext-fastapi/app/crud/sse/).
- Backend dùng `StreamingResponse` thuần FastAPI (không sse-starlette).
- Client (Next.js) dùng `services/sseClient.ts` với connection sharing + auto-reconnect.
- REST snapshot/polling: `GET /api/v1/sse/rest/{keyword}`. Query optional gồm `ticker`, `nntd_type`, `news_type`, `categories`, `report_type`, `article_slug`, `report_slug`, `page`, `limit` (1..5000), `skip`, `sort_by`, `sort_order=asc|desc`, `projection` JSON và `search`.

### Lý do dùng polling (không change stream)

MongoDB là **standalone**, không có oplog → không hỗ trợ change streams. Vì vậy backend phải poll DB định kỳ mỗi 3s. Mọi tối ưu realtime đều xoay quanh polling.

### Shared in-process cache *(2026-06-02)*

[`finext-fastapi/app/routers/sse.py`](../../finext-fastapi/app/routers/sse.py) — refactor lớn để tránh N subscriber × N poll/3s.

```
       ┌─── client A ──────────┐
       ├─── client B ──────────┤      asyncio.Queue per client
       └─── client C ──────────┘              ▲
                                              │ broadcast (put_nowait)
                                      ┌───────┴────────┐
                                      │  _poller task   │  1 task / (keyword, ticker)
                                      │  poll 3s → hash │  trong mỗi worker process
                                      │  → broadcast    │
                                      └───────┬─────────┘
                                              │
                                              ▼
                                          MongoDB
```

- Mỗi `(keyword, ticker)` chỉ có **1 background task** chạy trong worker process.
- Subscriber mới: thêm vào `Set[asyncio.Queue]` của cache entry, **nhận ngay `last_payload`** cached (không phải chờ 3s).
- Subscriber slow: queue đầy → drop frame (`QueueFull` ignored) thay vì block poller.
- Last subscriber unsubscribe → task tự cancel + cache entry bị xoá.
- Heartbeat `: heartbeat\n\n` mỗi 10s khi không có dữ liệu mới (giữ connection alive qua proxy).
- ⚠️ Cache **per-worker** — với `--workers 2`, mỗi keyword có thể có 2 poller (mỗi worker 1) nhưng vẫn giảm tải N→2 thay vì N→N.
- Hardening runtime: tối đa 200 poller/worker, 1.000 subscriber/cache entry; ticker tối đa 64 ký tự và 30 token comma-separated. Mỗi subscriber có queue 8 frame.

### Helper query — `get_collection_records()` *(2026-06-02)*

[`finext-fastapi/app/crud/sse/_helpers.py`](../../finext-fastapi/app/crud/sse/_helpers.py) — các query phù hợp trả thẳng `List[Dict]` từ Motor cursor, **không qua pandas DataFrame**. NaN/Inf được xử lý ở tầng response (`bson_to_json_str.clean_nan_values`).

Keywords phổ biến: `home_today_stock`, `home_today_index`, `home_today_industry`, `home_itd_index`, `home_itd_stock`, `chart_today_data`, `market_update_time`, ... (xem `GET /api/v1/sse/keywords` để list runtime).

---

## 3.10 Finext AI / Chat

- `POST /api/v1/chat/stream` là **POST SSE** có auth, khác market SSE dùng GET. Backend kiểm tra quota trước khi mở stream.
- Luồng: request + history/page context → build system blocks → provider adapter → agent loop → tool gateway → stream các event `meta`, `token`, `tool_start`, `tool_end`, `done`, ... về frontend.
- Gateway mặc định `AGENT_GATEWAY=mongo` chỉ đọc allowlist trong `agent_db`; có các operation `find`, `aggregate`, `stats`. Không cho agent ghi database.
- Hội thoại, message, feedback và quota/cost được lưu trong `user_db`. Khi stream hoàn tất, backend lưu assistant message; stream bị hủy/lỗi trước `done` thì không lưu câu trả lời dở.
- REST chat có list/detail/delete conversation, pin/rename, feedback message và `GET /quota`. Frontend dùng các route này cho `/chat`, `/chat/[id]`, chat bubble và `/profile/ai-usage`.
- Chi tiết runtime/policy: [`../finext_agent/`](../finext_agent/).
