# 01 — Sản Phẩm & Đối Tượng

> Giới thiệu Finext: định vị sản phẩm, các trục giá trị, đối tượng người dùng và ma trận phân quyền cấp cao.

**Cập nhật:** 2026-07-21

---

## 1.1 Định Vị Sản Phẩm

**Finext** — *Your Next Financial Step* — là **web application full-stack** chuyên phân tích & sàng lọc cổ phiếu cho thị trường chứng khoán Việt Nam.

- **Website:** [finext.vn](https://finext.vn)
- **Repository:** [twan507/finext-web-app](https://github.com/twan507/finext-web-app)
- **Ngôn ngữ chính:** Tiếng Việt (vi_VN)

Sản phẩm hướng đến nhà đầu tư cá nhân, môi giới và đội ngũ vận hành nội bộ. Sau pivot compliance 2026-05-07, sản phẩm giữ định vị **tham chiếu cá nhân** (xem [`06-compliance-pivot.md`](06-compliance-pivot.md)). Runtime hiện **không enforce invite-only**: mã giới thiệu là tùy chọn và user tự kích hoạt bằng OTP.

---

## 1.2 Ba Trục Giá Trị

| # | Trục | Mô tả |
|---|------|-------|
| 1 | **Dữ liệu & phân tích chuyên sâu** | VNINDEX, VN30, HNX, UPCOM; nhóm ngành, dòng tiền, hàng hóa, chỉ số quốc tế, vĩ mô. Realtime qua SSE. |
| 2 | **Công cụ ra quyết định** | Biểu đồ TradingView-like (`lightweight-charts`), screener đa tiêu chí, watchlist drag-and-drop, financial chart chọn-kỳ. |
| 3 | **Hệ sinh thái kinh doanh** | Gói license phân tầng, mã promotion, chương trình broker, luồng thanh toán manual confirm. |

Hai bề mặt mới thuộc trục **Công cụ ra quyết định**:

- `/phase` tổng hợp giai đoạn thị trường, hiệu suất/rổ tham khảo và các chỉ số Phase v3.4.2.
- `/chat` và chat bubble cung cấp Finext AI; agent dùng tool gateway đọc dữ liệu allowlist, có lưu hội thoại và quota theo user.

---

## 1.3 Đối Tượng Người Dùng (Roles)

4 role chính, đặc quyền tăng dần:

| Role | Mô tả | Truy cập |
|------|-------|----------|
| `user` | Nhà đầu tư cá nhân, dùng tính năng theo gói đang sở hữu. | `(main)` routes |
| `broker` | Đối tác giới thiệu, hưởng hoa hồng từ giao dịch referred. | `(main)` + một phần admin (dashboard, một số list) |
| `manager` | Vận hành — CRUD users, subscriptions, transactions, promotions, licenses, features. | `admin` (trừ roles/permissions/sessions/otps) |
| `admin` | Toàn quyền — quản lý roles, permissions, sessions, OTP, features, brokers. | `admin` (đầy đủ) |

Phân quyền chi tiết: matrix **role × permission** (44 permission được seed trong 6 categories). Xem [`03-backend.md`](03-backend.md#34-phân-quyền--rbac).

---

## 1.4 Trạng Thái Hiện Hành Sau Pivot

> **Tóm tắt:** Pivot ngày 2026-05-07 chuyển Finext sang chế độ tham chiếu cá nhân. Ngày 2026-07-21, phần auth được mở lại một phần; các hạn chế nội dung/route còn lại vẫn giữ nguyên.

**Tác động đến user-facing:**
- ✅ Đăng ký dùng OTP email để user tự xác thực; không còn chờ admin duyệt tay (khôi phục 2026-07-21)
- ✅ Google OAuth login/register và `/auth/google/callback` hoạt động (khôi phục phía frontend 2026-07-21; endpoint backend chưa từng bị tắt)
- ❌ Trang `/open-account`, `/profile/subscriptions` bị 403
- ❌ News detail không render full content → CTA link tới nguồn gốc
- ✅ **Tier gating cũ được bypass** — BASIC đi qua `ADVANCED_AND_ABOVE` tại charts/groups/markets/sectors/stocks; ba tab danh mục `/phase` vẫn dùng guard strict advanced+
- ❌ Footer hiện không có block disclaimer dạng text; block từng thêm đã bị remove ngày 2026-05-07 13:09 (`30a12e3`). Footer vẫn giữ link tới các trang policy.
- ✅ Home CTA "Trở thành thành viên cộng đồng" → Zalo group

> **Lịch sử 2026-05-07 → trước 2026-07-21:** đăng ký từng dùng admin manual approval và nút Google từng bị ẩn. Đây không còn là trạng thái runtime hiện tại; xem timeline trong [`06-compliance-pivot.md`](06-compliance-pivot.md).

Chi tiết đầy đủ: [`06-compliance-pivot.md`](06-compliance-pivot.md).
