# 02 — Kiến Trúc Tổng Thể & Deploy

> Topology hệ thống, Docker compose, network, thư mục gốc và quy ước env.

**Cập nhật:** 2026-07-21

---

## 2.1 Topology

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
                                  │ MongoDB standalone │
                                  │ user/stock/agent DB│
                                  └────────────────────┘
```

**Lưu ý:** Frontend SSR fetch backend qua **Docker DNS** (`http://fastapi:8000`) bằng biến `INTERNAL_API_URL`; client-side dùng `NEXT_PUBLIC_API_URL` (public domain).

---

## 2.2 Docker Compose

File: [`docker-compose.yml`](../../docker-compose.yml)

3 services trong network `web-proxy` (bridge):

| Service | Image/Build | Resources | Port |
|---------|-------------|-----------|------|
| `nginx` | nginx:latest + custom config | 256M RAM | 80, 443 (host) |
| `fastapi` | Build từ [`finext-fastapi/dockerfile`](../../finext-fastapi/dockerfile) | 1.5G RAM, 1.5 CPU | 8000 (internal) |
| `nextjs` | Build từ [`finext-nextjs/dockerfile`](../../finext-nextjs/dockerfile) | 1.5G RAM, 2 CPU | 3000 (internal) |

**Budget RAM VPS 8GB** *(2026-06-02)*: MongoDB standalone (~1.5-2G) + MSSQL standalone (1.5G) + OS (~1G) → web app share ~3.3G (`nginx 256M + fastapi 1.5G + nextjs 1.5G`).

**SSL:** Certificates trong `ssl/` (chain hợp lệ). Nginx terminate TLS, proxy HTTP đến container nội bộ.

**Mongo:** **Standalone** bên ngoài compose (host/instance ngoài). Kết nối qua `MONGODB_CONNECTION_STRING`. Backend khởi tạo `user_db`, `stock_db`, `agent_db`; `ref_db` được lấy lazy khi cần. Không có change streams trong topology production hiện tại → market realtime dùng polling (xem [`03-backend.md`](03-backend.md#39-sse-server-sent-events)).

Compose hiện gắn cùng `.env.production` bằng `env_file` vào cả ba service. Các biến `NEXT_PUBLIC_*` được whitelist riêng làm build args cho Next.js, nhưng secret backend vẫn hiện diện thừa trong container `nginx` và `nextjs` ở runtime. Đây là rủi ro vận hành hiện hữu cần lưu ý; tài liệu chỉ phản ánh code, chưa thay đổi Compose.

**Vận hành container:** cả ba service dùng log rotation `json-file` (`10m × 3`); `fastapi` và `nextjs` có healthcheck HTTP, còn `nginx` phụ thuộc hai service này.

---

## 2.3 Thư Mục Gốc

```
finext-web-app/
├── finext-fastapi/      # Python backend (FastAPI + MongoDB)
├── finext-nextjs/       # TypeScript frontend (Next.js 15)
├── nginx/               # Reverse proxy config
├── ssl/                 # SSL certificates
├── docs/                # Tài liệu
│   ├── architecture/    # Architecture docs (file này thuộc đây)
│   └── superpowers/     # Specs & plans (xem 07-dev-guide.md)
├── docker-compose.yml   # Production orchestration
├── .env.production      # Env cho production (root)
├── readme.md            # README ngắn
└── CLAUDE.md            # Hướng dẫn làm việc cùng AI assistant
```

---

## 2.4 Quy Ước Biến Môi Trường

| Tier | File backend | File frontend |
|------|-------------|---------------|
| Development | `finext-fastapi/.env.development` | `finext-nextjs/.env` |
| Production | `.env.production` (root, dùng cho cả 2) | `.env.production` (root) |

**Biến quan trọng:**

| Biến | Mục đích |
|------|---------|
| `ENVIRONMENT` | `development` bật OpenAPI/Swagger/ReDoc; mọi giá trị khác (và mặc định) tắt docs fail-safe |
| `MONGODB_CONNECTION_STRING` | Connection string MongoDB; một trong ba biến backend kiểm tra khi khởi động |
| `SECRET_KEY` | Ký JWT. `ALGORITHM=HS256`, access TTL 60 phút và refresh TTL 7 ngày hiện hard-code trong `config.py` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google OAuth backend |
| `ADMIN_EMAIL`, `ADMIN_PWD`, `MANAGER_EMAIL`, `BROKER_EMAIL_1..2`, `USER_EMAIL_1..3` | Seed user và danh sách account được bảo vệ (`ADMIN_EMAIL` là biến critical) |
| `COOKIE_SAMESITE`, `COOKIE_SECURE`, `COOKIE_DOMAIN` | Cookie refresh token |
| `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL_BASE` | Cloudflare R2 / S3-compatible storage |
| `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_STARTTLS`, `MAIL_SSL_TLS`, `MAIL_FROM`, `MAIL_FROM_NAME` | Email outbound |
| `FRONTEND_URL` | Domain frontend (dùng trong email link) |
| `NEXT_PUBLIC_API_URL` | URL public của FastAPI (client browser gọi) |
| `INTERNAL_API_URL` | URL nội bộ Docker DNS (SSR fetch) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google client ID được nhúng lúc build frontend |
| `NEXT_PUBLIC_SYSTEM_LICENSE_KEYS`, `NEXT_PUBLIC_BASIC_FEATURE`, `NEXT_PUBLIC_SYSTEM_FEATURES`, `NEXT_PUBLIC_SYSTEM_USERS` | Build-time config bảo vệ dữ liệu hệ thống ở frontend |
| `NEXT_PUBLIC_BASE_URL` | Base URL cho `robots.ts` và `sitemap.ts` (fallback `https://finext.vn`) |
| `DOMAIN_NAME` | Nginx template hostname/TLS server name |

Nhóm Finext AI trong [`app/core/config.py`](../../finext-fastapi/app/core/config.py):

- Provider/runtime: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_TEMPERATURE`, `LLM_MAX_OUTPUT_TOKENS`, `LLM_THINKING`, `LLM_REASONING_EFFORT`, `LLM_API_STYLE`.
- Gateway: `AGENT_GATEWAY`, `GATEWAY_EXPLAIN_MODE`. `AGENT_PACK_DIR` vẫn được khai báo trong config nhưng runtime context hiện đọc knowledge pack bundled tại `app/agent/kb`, nên biến này là legacy/unused.
- Quota/cost: `AGENT_DAILY_TOKEN_BUDGET`, `CHAT_MAX_CONVERSATIONS`, `LLM_PRICE_INPUT`, `LLM_PRICE_CACHED`, `LLM_PRICE_OUTPUT`, `AGENT_TOKENS_5H`, `AGENT_TOKENS_WEEK`, `AGENT_ADVANCED_MULT`, `AGENT_SESSION_HOURS`, `AGENT_WEEK_DAYS`, `AGENT_ADVANCED_LICENSES`, `AGENT_UNLIMITED_LICENSES`.

> Không có biến `MONGO_URI`, `JWT_SECRET`, `JWT_ALGORITHM`, `SMTP_HOST`, `R2_ACCOUNT_ID`, `R2_PUBLIC_URL` hay `CORS_ORIGINS` trong config hiện tại. CORS origin đang hard-code trong `app/main.py`.

---

## 2.5 Network & Bảo Mật Mạng

- **Nginx** là điểm duy nhất expose ra internet (80/443).
- `fastapi` và `nextjs` chỉ giao tiếp trong network nội bộ.
- CORS whitelist hard-code ở backend ([`finext-fastapi/app/main.py`](../../finext-fastapi/app/main.py)): HTTP localhost/127.0.0.1:3000; HTTPS localhost/127.0.0.1; `finext.vn`; `twan.io.vn`.
- **Gzip ở nginx** *(2026-06-02)* — gzip block trong [`nginx.conf`](../../nginx/nginx.conf), tắt riêng cho market SSE và chat SSE để không vỡ streaming. Trước đây gzip ở `GZipMiddleware` của FastAPI, đã chuyển sang nginx để giảm CPU worker Python.
- Nginx tắt buffering cho `/api/v1/sse/` và `/api/v1/chat/`, đặt read timeout 10 phút; giới hạn auth 20 request/phút/IP, OTP 6 request/phút/IP. Trần 30 kết nối/IP chỉ áp cho location market SSE `/api/v1/sse/`; chat stream hiện chưa có `limit_conn` tương đương.
- Giới hạn body mặc định 1MB; riêng upload 6MB. Nginx cũng đặt security headers và phục vụ HTTP/2.

## 2.5b Hiệu Năng — Cache & Keepalive *(2026-06-02)*

- **Nginx upstream keepalive 32** cho cả `fastapi` và `nextjs` upstream → tái sử dụng TCP connection, giảm ~1-2ms/request dưới tải.
- **Nginx cache Next.js static assets** — `location /_next/static/` cache 365d immutable (file có hash trong tên), `/_next/image` cache 7d, favicon/woff2/png cache 7d. Cache zone: `proxy_cache_path /var/cache/nginx/nextjs_static` (500MB max, ephemeral mỗi lần restart container).
- **`$connection_upgrade` map** trả `''` (rỗng) cho non-WS request thay vì `close` → giữ keepalive khi không phải WebSocket.

---

## 2.6 Lệnh Vận Hành Cơ Bản

```bash
# Production
docker compose --env-file .env.production up -d --build
docker compose logs -f fastapi nextjs nginx
docker compose down

# Restart 1 service
docker compose restart nextjs
```

Chi tiết setup dev/prod: [`07-dev-guide.md`](07-dev-guide.md).
