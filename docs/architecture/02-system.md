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
| `nginx` | nginx:alpine + custom config | 256M RAM | 80, 443 (host) |
| `fastapi` | Build từ `finext-fastapi/Dockerfile` | 2G RAM, 1.5 CPU | 8000 (internal) |
| `nextjs` | Build từ `finext-nextjs/Dockerfile` | 2G RAM, 2 CPU | 3000 (internal) |

**SSL:** Certificates trong `ssl/` (chain hợp lệ). Nginx terminate TLS, proxy HTTP đến container nội bộ.

**Mongo:** **Không** chạy trong compose — dùng MongoDB Atlas hoặc instance riêng. Kết nối qua `MONGO_URI` env.

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
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth (hiện disabled UI) |
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
- GZip middleware (≥ 1000 bytes) — giảm payload chart data ~80-90%.

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
