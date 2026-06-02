# 01 — Sản Phẩm & Đối Tượng

> Giới thiệu Finext: định vị sản phẩm, các trục giá trị, đối tượng người dùng và ma trận phân quyền cấp cao.

**Cập nhật:** 2026-06-02

---

## 1.1 Định Vị Sản Phẩm

**Finext** — *Your Next Financial Step* — là **web application full-stack** chuyên phân tích & sàng lọc cổ phiếu cho thị trường chứng khoán Việt Nam.

- **Website:** [finext.vn](https://finext.vn)
- **Repository:** [twan507/finext-web-app](https://github.com/twan507/finext-web-app)
- **Ngôn ngữ chính:** Tiếng Việt (vi_VN)

Sản phẩm hướng đến nhà đầu tư cá nhân, môi giới và đội ngũ vận hành nội bộ. Vận hành theo mô hình **tham chiếu cá nhân / invite-only** sau pivot compliance 2026-05-07 (xem [`06-compliance-pivot.md`](06-compliance-pivot.md)).

---

## 1.2 Ba Trục Giá Trị

| # | Trục | Mô tả |
|---|------|-------|
| 1 | **Dữ liệu & phân tích chuyên sâu** | VNINDEX, VN30, HNX, UPCOM; nhóm ngành, dòng tiền, hàng hóa, chỉ số quốc tế, vĩ mô. Realtime qua SSE. |
| 2 | **Công cụ ra quyết định** | Biểu đồ TradingView-like (`lightweight-charts`), screener đa tiêu chí, watchlist drag-and-drop, financial chart chọn-kỳ. |
| 3 | **Hệ sinh thái kinh doanh** | Gói license phân tầng, mã promotion, chương trình broker, luồng thanh toán manual confirm. |

---

## 1.3 Đối Tượng Người Dùng (Roles)

4 role chính, đặc quyền tăng dần:

| Role | Mô tả | Truy cập |
|------|-------|----------|
| `user` | Nhà đầu tư cá nhân, dùng tính năng theo gói đang sở hữu. | `(main)` routes |
| `broker` | Đối tác giới thiệu, hưởng hoa hồng từ giao dịch referred. | `(main)` + một phần admin (dashboard, một số list) |
| `manager` | Vận hành — CRUD users, subscriptions, transactions, promotions, licenses, features. | `admin` (trừ roles/permissions/sessions/otps) |
| `admin` | Toàn quyền — quản lý roles, permissions, sessions, OTP, features, brokers. | `admin` (đầy đủ) |

Phân quyền chi tiết: matrix **role × permission** (~50 permissions trong 6 categories). Xem [`03-backend.md`](03-backend.md#34-phân-quyền--rbac).

---

## 1.4 Sau Pivot Compliance 2026-05-07

> **Tóm tắt:** Finext chuyển từ pre-launch (đăng ký công khai OTP, gói trả phí, news re-publish) → chế độ tham chiếu cá nhân tuân thủ pháp luật chứng khoán VN.

**Tác động đến user-facing:**
- ❌ Đăng ký public không còn auto-active — phải admin approval manual (1 giờ)
- ❌ Google OAuth login/register bị disable (code vẫn còn, wrap `{false && ...}`)
- ❌ Trang `/open-account`, `/profile/subscriptions` bị 403
- ❌ News detail không render full content → CTA link tới nguồn gốc
- ✅ **Tier gating bypassed** — mọi user logged-in (kể cả BASIC) xem được toàn bộ content (charts, groups, markets, sectors, stocks)
- ✅ Footer thêm disclaimer (đã remove ngày 2026-05-07 13:09 — `30a12e3`)
- ✅ Home CTA "Trở thành thành viên cộng đồng" → Zalo group

Chi tiết đầy đủ: [`06-compliance-pivot.md`](06-compliance-pivot.md).
