# 07 — Setup, Quy Ước & Specs/Plans

> Hướng dẫn thiết lập môi trường, quy ước code, session protocol khi làm việc với AI, và index các spec/plan đã có.

---

## 7.1 Yêu Cầu Hệ Thống

- **Python 3.13+** và [UV](https://docs.astral.sh/uv/) (Astral package manager)
- **Node.js** (LTS) + npm
- **MongoDB** (local hoặc Atlas)
- **Docker + Docker Compose** (production)

---

## 7.2 Development Setup

### Backend
```bash
cd finext-fastapi
uv sync
uv run uvicorn app.main:app --reload --env-file .env.development
# API: http://127.0.0.1:8000
# Docs: http://127.0.0.1:8000/api/v1/docs
```

### Frontend
```bash
cd finext-nextjs
npm install
npm run dev
# App: http://localhost:3000
```

### Env files

| Tier | Backend | Frontend |
|------|---------|----------|
| Development | `finext-fastapi/.env.development` | `finext-nextjs/.env` |
| Production | `.env.production` (root) | `.env.production` (root) |

Biến quan trọng: xem [`02-system.md`](02-system.md#24-quy-ước-biến-môi-trường).

---

## 7.3 Production Deploy

```bash
docker compose --env-file .env.production up -d --build
docker compose logs -f
docker compose down
```

3 services: `nginx`, `fastapi`, `nextjs`. MongoDB **không** chạy trong compose — dùng Atlas / instance riêng qua `MONGO_URI`.

---

## 7.4 Quy Ước Code

### Python (backend)

- **Type hints bắt buộc** trên mọi function signature.
- Không `except:` bare — bắt exception cụ thể.
- Không `print()` debug — dùng `logging`.
- Functions max ~40 dòng. Split nếu dài hơn.
- Tests trong `tests/` mirror cấu trúc source.

### TypeScript (frontend)

- `strict: true` — không `any` (nếu phải dùng → comment giải thích).
- Không `// @ts-ignore` không lý do.
- Async functions handle error explicit.
- Components max ~150 dòng. Split nếu dài hơn.

### Cả 2

- **Không** thêm dependency không hỏi trước.
- **Không** chạm file ngoài scope.
- **Không** xóa commented code — mark `# TODO: remove`.
- Diff nhỏ tối đa.

### Output formatting cho AI

- Khi modify code, **luôn** present diff trong Markdown ```diff``` block (`+`/`-` lines), không silently execute.

---

## 7.5 Session Protocol (CLAUDE.md)

### Quan trọng

- **One task / session.** Không chain unrelated work.
- **Scope rõ ràng từ đầu:** state task + files in scope + files off-limits.
- **Compact sớm** trước khi context đầy:
  ```
  /compact Keep: files modified, current task state, error messages. Discard: file contents already committed, exploration history.
  ```

### Warning signs → `/clear` ngay

- Model modify file ngoài scope
- Suggest thêm dependency mid-task
- Revert fix đã làm earlier trong cùng session
- Hỏi lại câu đã trả lời
- Output verbose, lặp
- Test hardcoded pass thay vì test thật

### Session State block

Ở đầu mỗi session phức tạp:
```
## Session State
Task:
Files in scope:
Files already modified:
Current blocker (if any):
Next step:
```

---

## 7.6 Specs & Plans Index

Mọi feature lớn có **spec** (design) trong `docs/superpowers/specs/` và **plan** (kế hoạch triển khai) trong `docs/superpowers/plans/`.

| Spec / Plan | Mô tả | Trạng thái |
|-------------|-------|-----------|
| `2026-03-23-watchlist-drag-drop` | Drag-and-drop watchlist + endpoint `POST /watchlists/reorder` (bulk) | ✅ Done |
| `2026-03-26-admin-rbac` | Admin RBAC: backend `require_permission`, FE cache permissions, sidebar lọc theo role | ✅ Done |
| `2026-04-16-period-selection` | Click bar trên ApexCharts để chọn kỳ tài chính (sectors & stocks) | ✅ Done |
| `2026-04-22-user-guide-pages` | 3 trang `/guides/*` thay khu `learning` | ✅ Done |
| `2026-05-05-home-featured-stocks` | Carousel "Featured Stocks" trên home theo dòng tiền | ✅ Done |
| `2026-05-07-finext-compliance-pivot` | Pivot sang chế độ tham chiếu cá nhân/invite-only theo pháp luật chứng khoán VN | ✅ Done — xem [`06-compliance-pivot.md`](06-compliance-pivot.md) |

> Note: Spec `2026-05-06-sepay-integration` (auto-confirm thanh toán qua SePay webhook) đã được **gác lại** — không có kế hoạch triển khai. Spec file vẫn còn trong `docs/superpowers/specs/` để tham khảo nếu sau này quay lại.

---

## 7.7 Memory File (Auto-Memory cho AI)

Đường dẫn: `C:\Users\tuanb\.claude\projects\d--twan-projects-finext-web-app\memory\`

Các convention/feedback quan trọng đã ghi nhớ:

| File | Nội dung |
|------|----------|
| `feedback_tabs_vs_breadcrumb.md` | MUI Tabs chỉ dùng switch tab trong cùng page; cross-page nav dùng breadcrumb |
| `feedback_guide_content_tone.md` | Content `/guides/*` và UI text hướng tới NĐT phổ thông |
| `feedback_membership_tier_wording.md` | Không ghi tên gói cụ thể (Advanced, Basic, Pro); dùng "gói hội viên phù hợp" |
| `feedback_guide_visual_design.md` | Accordion `/guides/*` cần layout đa dạng, mỗi tab/section nhỏ có ảnh riêng |
| `feedback_homepage_title_override.md` | `useEffect` set `document.title = "Trang chủ \| Finext"` ở home — KHÔNG xóa |
| `feedback_mui_sx_units.md` | MUI sx `width:1`=100%, `m:1`=8px (không phải 1px). Quote `'1px'` cho pixel |

---

## 7.8 Khi Code Cần Tham Chiếu

- **Cấu trúc backend / endpoint / RBAC:** [`03-backend.md`](03-backend.md)
- **Route / trang frontend:** [`04-frontend.md`](04-frontend.md)
- **Tính năng cụ thể & security:** [`05-features-security.md`](05-features-security.md)
- **Tại sao route bị 403, content bị disable:** [`06-compliance-pivot.md`](06-compliance-pivot.md)
- **Deploy, env vars:** [`02-system.md`](02-system.md)
- **Định vị sản phẩm, user roles:** [`01-product.md`](01-product.md)
