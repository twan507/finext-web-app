# 02 — Kiến Trúc Tổng Thể & Deploy

> Topology hệ thống, Docker compose, network, thư mục gốc và quy ước env.

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
                                  │     MongoDB        │
                                  │  (motor async)     │
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
| `fastapi` | Build từ `finext-fastapi/Dockerfile` | 1.5G RAM, 1.5 CPU | 8000 (internal) |
| `nextjs` | Build từ `finext-nextjs/Dockerfile` | 1.5G RAM, 2 CPU | 3000 (internal) |

**Budget RAM VPS 8GB** *(2026-06-02)*: MongoDB standalone (~1.5-2G) + MSSQL standalone (1.5G) + OS (~1G) → web app share ~3.3G (`nginx 256M + fastapi 1.5G + nextjs 1.5G`).

**SSL:** Certificates trong `ssl/` (chain hợp lệ). Nginx terminate TLS, proxy HTTP đến container nội bộ.

**Mongo:** **Standalone** trên host (không phải replica set, không trong compose). Kết nối qua `MONGO_URI` env. ⚠️ Không có change streams → mọi realtime phải dùng polling (xem `03-backend.md#sse`).

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
| `MONGO_URI` | Connection string MongoDB |
| `JWT_SECRET`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS` | JWT config |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth (đang bật — FE cần `NEXT_PUBLIC_GOOGLE_CLIENT_ID` khớp) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | Cloudflare R2 storage |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `MAIL_FROM`, `MAIL_FROM_NAME` | Email outbound |
| `FRONTEND_URL` | Domain frontend (dùng trong email link) |
| `NEXT_PUBLIC_API_URL` | URL public của FastAPI (client browser gọi) |
| `INTERNAL_API_URL` | URL nội bộ Docker DNS (SSR fetch) |
| `CORS_ORIGINS` | Whitelist domain frontend (`finext.vn`, `twan.io.vn`, localhost dev) |

---

## 2.5 Network & Bảo Mật Mạng

- **Nginx** là điểm duy nhất expose ra internet (80/443).
- `fastapi` và `nextjs` chỉ giao tiếp trong network nội bộ.
- CORS whitelist ở backend ([`finext-fastapi/app/main.py`](../../finext-fastapi/app/main.py)): `localhost:3000`, `127.0.0.1:3000`, `finext.vn`, `twan.io.vn`.
- **Gzip ở nginx** *(2026-06-02)* — gzip block trong [`nginx.conf`](../../nginx/nginx.conf), tắt riêng cho SSE (`gzip off` trong `location /api/v1/sse/`) để không vỡ streaming. Trước đây gzip ở `GZipMiddleware` của FastAPI, đã chuyển sang nginx để giảm CPU worker Python.

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
