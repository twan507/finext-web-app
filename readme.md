# Finext Web Application

Finext là web application full-stack phân tích và sàng lọc chứng khoán Việt Nam. Repository chứa frontend Next.js, backend FastAPI, cấu hình Nginx và Docker Compose production.

## Tài Liệu

- [Architecture index](docs/architecture/README.md) — bản đồ tài liệu và tổng quan hệ thống.
- [Backend](docs/architecture/03-backend.md) · [Frontend](docs/architecture/04-frontend.md) · [Bảo mật](docs/architecture/05-features-security.md).
- [Compliance/auth hiện tại](docs/architecture/06-compliance-pivot.md).
- [Trang Giai đoạn thị trường](docs/architecture/08-market-phase.md).
- [Finext AI roadmap](docs/finext_agent/00-web-roadmap.md).
- [Cách đọc specs/plans lịch sử](docs/superpowers/README.md).

Các file trong `docs/superpowers/specs/`, `docs/superpowers/plans/` và `.superpowers/sdd/` là hồ sơ thiết kế/triển khai theo thời điểm. Khi có khác biệt, ưu tiên code hiện tại, sau đó đến tài liệu kiến trúc mới nhất.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | FastAPI 0.115+, Python 3.13+, Pydantic v2, Motor/PyMongo, JWT, APScheduler, UV |
| **Frontend** | Next.js 15.5, React 19, TypeScript 5.7 strict, MUI 7, TanStack Query |
| **Realtime** | SSE + REST/polling trên MongoDB standalone |
| **Data** | MongoDB: `user_db`, `stock_db`, `ref_db`, `agent_db` |
| **Infrastructure** | Docker Compose, Nginx, TLS, Next.js standalone output |

## Cấu Trúc Repository

```text
finext-web-app/
├── finext-fastapi/       # FastAPI, MongoDB access, auth/RBAC, Finext AI
│   ├── app/
│   │   ├── routers/      # HTTP/SSE endpoints
│   │   ├── schemas/      # Pydantic request/response DTOs
│   │   ├── crud/         # Business logic và Mongo queries
│   │   ├── auth/         # JWT, current-user và permission dependencies
│   │   ├── agent/        # Agent loop, adapters, gateway, tools, runtime KB
│   │   └── core/         # Config, database, scheduler, seeding
│   └── tests/
├── finext-nextjs/        # Next.js App Router frontend
│   ├── app/              # (auth), (main), admin và auth callback
│   ├── components/
│   ├── services/         # API, SSE, chat và session clients
│   ├── hooks/
│   └── theme/
├── docs/                 # Architecture, Finext AI, specs và plans
├── nginx/                # Reverse proxy, TLS, cache và rate limits
├── docker-compose.yml
└── CLAUDE.md             # Quy ước làm việc trong repository
```

## Yêu Cầu

- Python 3.13+ và [UV](https://docs.astral.sh/uv/getting-started/installation/)
- Node.js và npm
- MongoDB có các database/collection cần thiết
- Docker + Docker Compose nếu chạy production stack

## Development

### Backend

```bash
cd finext-fastapi
uv sync
uv run uvicorn app.main:app --reload --env-file .env.development
```

- API: `http://127.0.0.1:8000/api/v1`
- Swagger: `http://127.0.0.1:8000/api/v1/docs`
- Swagger/ReDoc/OpenAPI chỉ bật khi `ENVIRONMENT=development`.

Launcher hỗ trợ một số thao tác UV:

```bash
python main.py          # Chạy server
python main.py venv     # Tạo môi trường ảo
python main.py install  # uv sync
python main.py lock     # uv lock
```

### Frontend

```bash
cd finext-nextjs
npm install
npm run dev
```

App: `http://localhost:3000`

## Kiểm Tra

```bash
cd finext-fastapi
uv run pytest

cd ../finext-nextjs
npx tsc --noEmit
npm test
```

Không chạy `next build` đồng thời với một dev server đang dùng cùng thư mục `.next`. Frontend hiện dùng `node --test` cho unit tests TypeScript; Playwright đã có dependency nhưng repository chưa có suite/config E2E.

## Environment

| Môi trường | Backend | Frontend |
|------------|---------|----------|
| Development | `finext-fastapi/.env.development` | `finext-nextjs/.env` nếu cần override client env |
| Production | `.env.production` ở root | `.env.production` ở root qua Docker Compose/build args |

Tên biến backend được định nghĩa trong `finext-fastapi/app/core/config.py`. Các biến bắt buộc chính gồm `MONGODB_CONNECTION_STRING`, `SECRET_KEY`, `ADMIN_EMAIL`; frontend dùng `NEXT_PUBLIC_API_URL` và `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Không commit file `.env*` hoặc giá trị secret.

Trong production, browser gọi `/api/v1/*` cùng origin qua Nginx; server-side Next.js gọi FastAPI qua `INTERNAL_API_URL=http://fastapi:8000`.

## Production

```bash
docker compose --env-file .env.production up -d --build
docker compose logs -f
docker compose down
```

Compose chạy ba service `nginx`, `fastapi` và `nextjs`. MongoDB không nằm trong Compose. Nginx là service duy nhất expose port host; FastAPI và Next.js chỉ nằm trong network `web-proxy`.

## Quản Lý Dependencies

### Backend

```bash
uv add <package>
uv add --group dev <package>
uv lock
uv sync
```

### Frontend

```bash
npm install <package>
npm install -D <package>
```

Không thêm dependency mới nếu chưa thống nhất phạm vi và lý do sử dụng.

## Optional AI Tooling

```bash
npx skills add vercel-labs/agent-skills

npm install -g uipro-cli
uipro init --ai antigravity
```
