# Finext — Architecture Docs

> Tài liệu kiến trúc toàn diện của **Finext** — Web app phân tích chứng khoán Việt Nam.
> Tổ chức theo nhiều file để tiết kiệm context khi AI làm việc.

**Website:** [finext.vn](https://finext.vn) · **Repository:** [twan507/finext-web-app](https://github.com/twan507/finext-web-app)
**Stack:** Next.js 15 + FastAPI 0.115 (uvicorn workers=2) + MongoDB standalone · **Deploy:** Docker Compose (nginx + fastapi + nextjs)
**Status:** Production. Đã pivot sang chế độ tham chiếu cá nhân từ 2026-05-07.
**Cập nhật:** 2026-06-02 (perf overhaul: SSE shared cache, multi-worker, nginx static cache + keepalive + gzip)

---

## Quick Map — Tôi cần info về X → đọc file Y

| Bạn cần biết về... | Đọc file |
|--------------------|---------|
| Sản phẩm là gì, đối tượng user, value pillars | [`01-product.md`](01-product.md) |
| Topology hệ thống, Docker, env vars, network | [`02-system.md`](02-system.md) |
| Backend (FastAPI): structure, endpoints, RBAC, license/feature, auth flow, SSE | [`03-backend.md`](03-backend.md) |
| Frontend (Next.js): routes, mô tả từng trang, modules, state stores, conventions | [`04-frontend.md`](04-frontend.md) |
| Tính năng nổi bật + mô hình bảo mật (JWT, OTP, OAuth, CORS, rate-limit) | [`05-features-security.md`](05-features-security.md) |
| Compliance pivot 2026-05-07 — gì bị disable, blocked routes, cách rollback | [`06-compliance-pivot.md`](06-compliance-pivot.md) |
| Setup dev/prod, quy ước code, session protocol, specs/plans index | [`07-dev-guide.md`](07-dev-guide.md) |
| Page "Giai đoạn thị trường" (`/phase`): trạng thái, kiến trúc, lịch sử chỉnh sửa | [`08-market-phase.md`](08-market-phase.md) |

---

## 1-Page Overview

### Sản phẩm
**Finext** = nền tảng phân tích & sàng lọc cổ phiếu cho NĐT Việt Nam: dữ liệu thị trường realtime, biểu đồ kỹ thuật chuyên sâu, screener đa tiêu chí, watchlist drag-and-drop, hệ thống thuê bao phân tầng.

**4 roles:** `user` < `broker` < `manager` < `admin`. Phân quyền matrix role × ~50 permissions trong 6 categories.

### Kiến trúc

```
Nginx (SSL) → [ Next.js :3000 ] ◄── [ FastAPI :8000 ] → MongoDB (Atlas/external)
```

3 Docker services trong network `web-proxy`. Frontend SSR fetch backend qua Docker DNS (`INTERNAL_API_URL`). Client-side gọi public domain (`NEXT_PUBLIC_API_URL`).

**VPS 8GB RAM**: Mongo standalone (~1.5-2G) + MSSQL standalone (1.5G) + OS (~1G) + web (~3.3G: nginx 256M + fastapi 1.5G + nextjs 1.5G).

### Backend (`finext-fastapi`)
- **FastAPI 0.115+**, Python 3.13, UV package manager, **Uvicorn 2 workers** *(2026-06-02)*
- **17 routers** prefix `/api/v1` — tất cả trả `StandardApiResponse[T]`
- **Motor** async cho MongoDB **standalone** (`maxPoolSize=50, minPoolSize=5`)
- **SSE polling** với shared in-process cache (1 poller / (keyword,ticker) / worker, broadcast qua `asyncio.Queue`)
- **JWT + Refresh** auth, sessions trong DB cho remote logout
- **APScheduler** gated bằng `fcntl` lock — chỉ 1 worker chạy cron
- **5 license keys** mặc định (BASIC, PATRON, PARTNER, MANAGER, ADMIN) seed lúc khởi động

### Frontend (`finext-nextjs`)
- **Next.js 15.5** App Router + Turbopack, **React 19**, **TypeScript 5.7 strict**
- **MUI 7.1** + Emotion · **lightweight-charts 5** + **ApexCharts** cho biểu đồ
- **TanStack Query** + custom `apiClient` (refresh flow tự động)
- **SSE realtime** với polling fallback
- 3 route groups: `(auth)`, `(main)`, `admin/`

### Tình trạng sau pivot 2026-05-07
- ❌ Google OAuth UI disabled (code wrap `{false && ...}`, vẫn còn)
- ❌ OTP register flow disabled — chuyển sang admin manual approval
- ❌ Routes 403: `/open-account`, `/profile/subscriptions`, `/auth/google/callback`
- ❌ News detail render summary + link external, không re-publish full HTML
- ✅ Tier gating bypassed — mọi user logged-in xem được toàn bộ content
- ✅ CTA "Gia nhập cộng đồng" → Zalo group

---

## Cập Nhật Doc

- Khi thay đổi code đáng kể (thêm route, đổi flow auth, thêm router, đổi RBAC) → cập nhật file architecture tương ứng.
- File này (`README.md`) là index — chỉ thêm/sửa khi có file mới hoặc cấu trúc thay đổi.
- File `finext-overview.md` cũ đã được tách thành cấu trúc này (2026-06-02).

---

## Liên Hệ

- **Email:** finext.vn@gmail.com
- **Ngôn ngữ:** Tiếng Việt (vi_VN)

---

*Architecture docs này được tách từ `docs/finext-overview.md` cũ, dựa trên khảo sát mã nguồn thực tế và các spec/plan trong [`../superpowers/`](../superpowers/).*
