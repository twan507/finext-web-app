# 05 — Tính Năng Nổi Bật & Bảo Mật

> Highlight các tính năng cho từng đối tượng và mô hình bảo mật end-to-end.

---

## 5.1 Cho Nhà Đầu Tư

| Tính năng | Mô tả ngắn | File chính |
|-----------|-----------|-----------|
| **Biểu đồ kỹ thuật cấp pro** | `lightweight-charts` + custom primitive (`BandFillPrimitive`), multi-timeframe, indicators (MA, RSI, MACD, Bollinger). | `(main)/charts/[id]/` |
| **Stock screener** | Đa tiêu chí kỹ thuật + cơ bản, cấu hình tập trung trong [`screenerConfig.ts`](../../finext-nextjs/app/(main)/stocks/screenerConfig.ts). | `(main)/stocks/` |
| **Watchlist drag-and-drop** | Nhiều cột × hàng, lưu vị trí trên server (`POST /watchlists/reorder` bulk). | `(main)/watchlist/`, [`watchlists.py`](../../finext-fastapi/app/routers/watchlists.py) |
| **Tài chính chọn kỳ** | Click bar trên ApexCharts → xem giá trị và delta của kỳ đó. Áp dụng cho cả sectors & stocks. | `StockFinancialsFocusChart`, `FinancialsFocusChart` |
| **Featured Stocks carousel** | Home: top 10 mã dòng tiền vào / ra, autoplay 10s. | `(main)/home/components/FeaturedStocks` |
| **Tin tức & báo cáo** | Phân loại theo `category` / `type`, SSR cho SEO. | `(main)/news/`, `(main)/reports/` |
| **SSE realtime + polling fallback** | Dữ liệu giá, chỉ số, news theo dòng. | `services/sseClient.ts`, `pollingClient.ts` |

---

## 5.2 Cho Vận Hành / Quản Trị

| Tính năng | Mô tả |
|-----------|-------|
| **Dashboard admin** | KPI doanh thu, active users, transaction pending, cảnh báo (license sắp hết hạn). |
| **Subscription/Transaction/Promotion/License management** | CRUD tách bạch, admin/manager confirm thanh toán thủ công. |
| **Broker program** | Gán mã broker cho user, theo dõi giao dịch referred (`transaction:read_referred`). |
| **Phân quyền chi tiết** | Role × permission matrix, FE + BE cùng enforce. |
| **Moderation watchlist** | Admin có thể xem/quản lý watchlist của user. |
| **Sidebar filter theo role** | Manager không thấy Roles/Permissions/Sessions/OTPs *(2026-03-26 RBAC)*. |

---

## 5.3 Mô Hình Bảo Mật

### 5.3.1 Authentication

| Cơ chế | Chi tiết |
|--------|---------|
| **JWT access + refresh** | Access TTL 60 phút, refresh lưu trong DB collection `sessions` → cho phép logout từ xa hoặc từ admin. |
| **Bcrypt** | Hash mật khẩu, work factor mặc định. |
| **OTP qua email** | Dùng cho register (self-verify), reset password, passwordless login. Template `pwdless_login.html`. |
| **Google OAuth 2.0** | Hợp nhất với account thường qua `google_id`. UI đã bật lại 2026-07-21. |
| **DNS MX check** | `email-validator` + `dnspython` — catch domain không tồn tại trước khi tạo user hoặc gửi mail kích hoạt. |

### 5.3.2 Authorization

- Mọi endpoint sensitive đều có `Depends(require_permission(resource, action))` ở backend.
- Frontend cache permissions → render UI, **nhưng không phải security boundary**.
- Sidebar admin filter routes theo role.

### 5.3.3 Transport & CORS

- **SSL/TLS** qua Nginx với chain hợp lệ.
- **CORS whitelist** (trong [`main.py`](../../finext-fastapi/app/main.py)):
  - `localhost:3000`, `127.0.0.1:3000` (dev)
  - `finext.vn`, `twan.io.vn` (prod)
- `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`.

### 5.3.4 Rate Limiting

- Endpoint công khai (`/api/v1/emails/*`, `/api/v1/otps/request`) có **rate limit** để chống abuse.
- Implement trong từng router (chưa dùng middleware tập trung).

### 5.3.5 Session Management

- Mọi session active được lưu trong collection `sessions`.
- User xem các phiên tại `/profile/login-sessions` và logout từ xa.
- Admin có endpoint `GET /api/v1/sessions/` để xem tất cả phiên và force logout.
- `device_info` (User-Agent raw) lưu để hiển thị, **không strict-compare** khi refresh token (bỏ từ 2026-05 để tránh logout giả khi browser auto-update). Xác thực phiên dựa trên `session_id` trong DB.

### 5.3.6 Webhook & External Trust

- Hiện tại **không có webhook external** nào active (SePay design đã bỏ).
- Upload ảnh đi qua `POST /api/v1/uploads/` — backend nén Pillow → R2/S3, validate MIME + size trước khi lưu.

### 5.3.7 Email Security

- Mọi mail kích hoạt user (`account_activated`, `registration_received`) gửi **SYNC** với MX check trước → fail → rollback DB.
- Lý do: tránh tạo user / activate user nhưng mail không tới được → support phải xử lý.

---

## 5.4 Compliance & Pháp Lý (2026-05-07)

- **Disclaimer** — Finext không phải công ty chứng khoán, không phải công ty quản lý quỹ. Mọi nội dung tham khảo, không phải khuyến nghị đầu tư.
  - ⚠️ Block disclaimer trong Footer đã được **removed** ngày 2026-05-07 13:09 (commit `30a12e3`). Hiện chỉ còn trong page `/policies/disclaimer`.
- **News re-publish:** không render full HTML — chỉ summary + CTA tới nguồn gốc.
- **Đăng ký:** chuyển sang admin manual approval → tránh "public sign-up" có thể bị xem là dịch vụ chứng khoán.
- **Tier gating bypassed:** tránh "thu phí xem nội dung tài chính" — mọi user logged-in xem được toàn bộ content.

Chi tiết: [`06-compliance-pivot.md`](06-compliance-pivot.md).
