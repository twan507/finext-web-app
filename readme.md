# Finext Web Application

Full-stack web application với FastAPI backend và Next.js frontend.

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/twan507/finext-web-app)

## AI Skills

Cài đặt các skills cho AI coding assistant:

```bash
# Vercel Agent Skills
npx skills add vercel-labs/agent-skills

# UI Pro CLI
npm install -g uipro-cli
uipro init --ai antigravity
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | FastAPI, Python 3.13+, UV, MongoDB, JWT |
| **Frontend** | Next.js 15, TypeScript, Material UI |
| **Infrastructure** | Docker, Nginx |

## Yêu Cầu

- Python 3.13+ & [UV](https://docs.astral.sh/uv/getting-started/installation/)
- Node.js & npm
- MongoDB
- Docker (optional)

## Quick Start

### Backend

```bash
cd finext-fastapi
uv sync                                                           # Cài dependencies
uv run uvicorn app.main:app --reload --env-file .env.development  # Chạy server
```

Hoặc sử dụng script `main.py`:

```bash
python main.py          # Chạy server (mặc định)
python main.py venv     # Tạo môi trường ảo
python main.py install  # Cài dependencies (uv sync)
python main.py lock     # Tạo/cập nhật lockfile
```

→ API: http://127.0.0.1:8000 | Docs: http://127.0.0.1:8000/api/v1/docs

### Frontend

```bash
cd finext-nextjs
npm install      # Cài dependencies
npm run dev      # Chạy server
```

→ App: http://localhost:3000

## Quản Lý Dependencies

### Backend (UV)

```bash
uv add <package>              # Thêm package
uv add --group dev <package>  # Thêm dev dependency
uv lock                       # Cập nhật lockfile
uv sync                       # Đồng bộ môi trường
```

### Frontend (npm)

```bash
npm install <package>         # Thêm package
npm install -D <package>      # Thêm dev dependency
```

## Docker (Production)

```bash
# Build & Run
docker compose --env-file .env.production up -d --build

```

## Environment Files

| Môi trường | Backend | Frontend |
|------------|---------|----------|
| Development | `finext-fastapi/.env.development` | `finext-nextjs/.env` |
| Production | `.env.production` (root) | `.env.production` (root) |