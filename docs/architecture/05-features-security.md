# 05 — Tính Năng Nổi Bật & Bảo Mật

> Highlight các tính năng cho từng đối tượng và mô hình bảo mật end-to-end.

**Cập nhật:** 2026-07-21

---

## 5.1 Cho Nhà Đầu Tư

| Tính năng | Mô tả ngắn | File chính |
|-----------|-----------|-----------|
| **Biểu đồ kỹ thuật cấp pro** | `lightweight-charts` + custom primitive (`BandFillPrimitive`), multi-timeframe; chỉ báo hiện có: MA, Open/High/Low, Pivot, Fibonacci, Volume Profile và Volume MA. | `(main)/charts/[id]/` |
| **Stock screener** | Giá/OHLCV, biến động theo khung, thanh khoản, dòng tiền/xếp hạng và vùng kỹ thuật; cấu hình tập trung trong [`screenerConfig.ts`](../../finext-nextjs/app/(main)/stocks/screenerConfig.ts). | `(main)/stocks/` |
| **Watchlist drag-and-drop** | Nhiều cột × hàng, lưu vị trí trên server (`POST /api/v1/watchlists/reorder` bulk). | `(main)/watchlist/`, [`watchlists.py`](../../finext-fastapi/app/routers/watchlists.py) |
| **Tài chính chọn kỳ** | Click bar trên ApexCharts → xem giá trị và delta của kỳ đó. Áp dụng cho cả sectors & stocks. | `StockFinancialsFocusChart`, `FinancialsFocusChart` |
| **Featured Stocks carousel** | Home: top 10 mã dòng tiền vào / ra, autoplay 10s. | `(main)/home/components/featuredStocks/FeaturedStocksSection.tsx` |
| **Tin tức & báo cáo** | Phân loại theo `category` / `type`, SSR cho SEO. | `(main)/news/`, `(main)/reports/` |
| **SSE realtime + polling riêng** | `sseClient.ts` stream dữ liệu; `pollingClient.ts` phục vụ flow chủ động polling, không phải automatic fallback. | `services/sseClient.ts`, `pollingClient.ts` |
| **Giai đoạn thị trường** | Phase v3.4.2, phân tích thị trường và ba rổ tham khảo; market data one-shot, riêng trend hôm nay dùng SSE. | [`(main)/phase/`](../../finext-nextjs/app/(main)/phase/), [`08-market-phase.md`](08-market-phase.md) |
| **Finext AI** | POST SSE, tool gateway chỉ đọc, hội thoại/pin/rename/feedback, thinking mode, quota 5h + tuần; có page chat và bubble. | `(main)/chat/`, `components/chatBubble/`, `routers/chat.py` |

---

## 5.2 Cho Vận Hành / Quản Trị

| Tính năng | Mô tả |
|-----------|-------|
| **Dashboard vận hành/broker** | Manager/admin xem KPI tổng; broker có `transaction:read_referred` chỉ thấy dữ liệu referral của mình. |
| **Subscription/Transaction/Promotion/License management** | CRUD tách bạch, admin/manager confirm thanh toán thủ công. |
| **Broker program** | Gán mã broker cho user, theo dõi giao dịch referred (`transaction:read_referred`). |
| **Phân quyền chi tiết** | Role × permission matrix, FE + BE cùng enforce. |
| **Moderation watchlist** | Manager/admin có thể xem/quản lý watchlist của user. |
| **Sidebar filter theo role** | Manager không thấy Roles/Permissions/Sessions/OTPs *(2026-03-26 RBAC)*. |

---

## 5.3 Mô Hình Bảo Mật

### 5.3.1 Authentication

| Cơ chế | Chi tiết |
|--------|---------|
| **JWT access + refresh** | Access TTL 60 phút, refresh TTL 7 ngày; `sessions` lưu `access_jti`/`refresh_jti` → logout/revoke từ xa. |
| **Bcrypt** | Hash mật khẩu, work factor mặc định. |
| **OTP qua email** | Dùng cho register (self-verify), reset password, passwordless login. Template `pwdless_login.html`. |
| **Google OAuth 2.0** | Hợp nhất với account thường qua `google_id`. UI đã bật lại 2026-07-21. |
| **DNS MX check** | `email-validator` + `dnspython` — catch domain không tồn tại trước khi tạo user hoặc gửi mail kích hoạt. |

### 5.3.2 Authorization

- Endpoint user-scoped dùng `get_current_active_user` và kiểm tra ownership; endpoint quản trị dùng permission dependency/check tương ứng.
- Frontend cache permissions → render UI, **nhưng không phải security boundary**.
- Sidebar admin filter routes theo role.

### 5.3.3 Transport & CORS

- **SSL/TLS** qua Nginx với chain hợp lệ.
- **CORS whitelist** (trong [`main.py`](../../finext-fastapi/app/main.py)):
  - `http://localhost:3000`, `http://127.0.0.1:3000`
  - `https://localhost`, `https://127.0.0.1`
  - `https://finext.vn`, `https://twan.io.vn`
- `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`.

### 5.3.4 Rate Limiting

- Nginx edge-limit auth 20 request/phút/IP, OTP 6 request/phút/IP và market SSE tối đa 30 kết nối/IP.
- Router email có limiter in-process 60 giây/IP; OTP request có cooldown 60 giây theo email + loại OTP trong DB.
- SSE backend còn cap 200 poller/worker, 1.000 subscriber/cache entry và validate ticker trước khi tạo poller.

### 5.3.5 Session Management

- Mọi session active được lưu trong collection `sessions`.
- User xem các phiên tại `/profile/login-sessions` và logout từ xa.
- Admin có endpoint `GET /api/v1/sessions/` để xem tất cả phiên và force logout.
- `device_info` (User-Agent raw) lưu để hiển thị, **không strict-compare** khi refresh token. Refresh xác thực bằng `refresh_jti` trong DB.

### 5.3.6 Webhook & External Trust

- Hiện tại **không có webhook external** nào active (SePay design đã bỏ).
- Upload ảnh đi qua `POST /api/v1/uploads/` — backend nén Pillow → R2/S3, validate MIME + size trước khi lưu.

### 5.3.7 Email Security

- Đăng ký hiện kiểm tra MX, tạo user inactive + OTP rồi gửi mail OTP qua `BackgroundTasks`; tạo OTP record thất bại thì rollback user.
- Admin vẫn có đường kích hoạt thủ công: mail `account_activated` gửi đồng bộ và rollback thay đổi DB nếu gửi thất bại.
- Template/hàm `registration_received` còn trong repo nhưng không được gọi sau khi OTP self-verify bật lại.

### 5.3.8 Finext AI

- Mọi endpoint chat yêu cầu active user; conversation/message CRUD kiểm tra ownership.
- Tool gateway mặc định đọc allowlist từ `agent_db`, chỉ expose `find`/`aggregate`/`stats`; agent không có đường ghi DB.
- Quota được kiểm tra trước khi mở POST SSE; daily token budget global mặc định `0` (tắt), còn cửa sổ 5 giờ/tuần vẫn áp theo license.
- Nginx tắt buffering/gzip cho chat stream; backend hủy LLM task khi client disconnect và chỉ persist assistant message khi đã thấy event `done`.

---

## 5.4 Compliance & Pháp Lý (2026-05-07)

- **Disclaimer** — Finext không phải công ty chứng khoán, không phải công ty quản lý quỹ. Mọi nội dung tham khảo, không phải khuyến nghị đầu tư.
  - ⚠️ Block disclaimer trong Footer đã được **removed** ngày 2026-05-07 13:09 (commit `30a12e3`). Hiện chỉ còn trong page `/policies/disclaimer`.
- **News re-publish:** không render full HTML — chỉ summary + CTA tới nguồn gốc.
- **Đăng ký/auth:** giai đoạn 2026-05-07 từng chuyển sang admin manual approval và ẩn Google; từ 2026-07-21 đã khôi phục OTP self-verify + Google OAuth.
- **Tier gating:** preset `ADVANCED_AND_ABOVE` vẫn include BASIC cho các khu vực cũ; ba tab danh mục của `/phase` dùng preset `ADVANCED_AND_ABOVE_STRICT` riêng.

Chi tiết: [`06-compliance-pivot.md`](06-compliance-pivot.md).
