# Admin Role-Based Access Control — Design Spec

**Date:** 2026-03-26
**Status:** Approved

---

## Overview

Chuẩn hóa layout và các page admin theo role (Admin, Manager, Broker/Partner). Frontend sử dụng permissions array trong session để ẩn navigation, disable buttons, và redirect khi không có quyền.

---

## 1. Permissions Flow

### Backend
- Thêm endpoint `GET /api/v1/auth/me/permissions` trả `string[]` (danh sách permission names của user hiện tại, ví dụ `["user:create", "user:list", "license:manage"]`)
- Logic: lấy user → lấy role_ids → lấy tất cả permission_ids từ roles → trả permission names

### Frontend
- Thêm `permissions: string[]` vào `SessionData` interface trong `services/core/types.ts`
- Gọi `/api/v1/auth/me/permissions` khi login/refresh session trong `AuthProvider.tsx` (tương tự cách lấy `features`)
- Thêm helper `hasPermission(permKey: string): boolean` vào `useAuth()` hook
- Lưu permissions vào localStorage cùng session

---

## 2. Navigation Filtering

Trong `LayoutContent.tsx`, mỗi menu item gắn với permission required. Chỉ render menu item khi user có permission tương ứng.

| Menu | Permission Required | Admin | Manager | Broker |
|---|---|---|---|---|
| Dashboard | *(luôn hiện)* | Y | Y | Y |
| Users | `user:list` | Y | Y | N |
| Brokers | `broker:list` | Y | N | N |
| Transactions | `transaction:read_any` OR `transaction:read_referred` | Y | Y | Y |
| Subscriptions | `subscription:read_any` | Y | Y | N |
| Licenses | `license:manage` | Y | Y | N |
| Features | `feature:manage` | Y | Y | N |
| Promotions | `promotion:manage` | Y | Y | N |
| Roles | `role:manage` | Y | N | N |
| Permissions | `permission:manage` | Y | N | N |
| Sessions | `session:manage_any` | Y | N | N |
| OTPs | `otp:manage` | Y | N | N |
| Watchlists | `watchlist:manage_any` | Y | Y | N |

**Navigation groups**: Nếu tất cả sub-items trong 1 group bị ẩn → ẩn luôn group header.

---

## 3. Route Protection (Redirect)

Trong `LayoutContent.tsx` hoặc wrapper component:
- Map mỗi route path → permission required (giống bảng trên)
- Khi user truy cập route không có quyền → `router.replace("/admin/dashboard")`
- Dashboard luôn accessible cho mọi role có quyền vào admin

---

## 4. Button/Action Disable Logic

Trong các trang được phép truy cập, nút CRUD bị disable (hiển thị nhưng greyed out + tooltip) khi user không có permission tương ứng.

### Users page
| Action | Permission | Disabled for |
|---|---|---|
| Thêm User | `user:create` | — |
| Sửa User | `user:update_any` | — |
| Xóa User | `user:delete_any` | Manager |
| Gán Role | `user:manage_roles` | Manager |
| Đổi Password | `user:change_password_any` | — |

### Transactions page
| Action | Permission | Disabled for |
|---|---|---|
| Tạo Transaction | `transaction:create_any` | Broker |
| Xác nhận thanh toán | `transaction:confirm_payment_any` | Broker |
| Hủy Transaction | `transaction:cancel_any` | Broker |
| Xóa Transaction | `transaction:delete_any` | Broker |

### Subscriptions page
| Action | Permission | Disabled for |
|---|---|---|
| Tạo Subscription | `subscription:create` | — |
| Sửa Subscription | `subscription:update_any` | — |
| Hủy Subscription | `subscription:deactivate_any` | — |
| Xóa Subscription | `subscription:delete_any` | Manager |

### Brokers page (admin only)
| Action | Permission | Disabled for |
|---|---|---|
| Tạo Broker | `broker:create` | — |
| Sửa Broker | `broker:update_any` | — |
| Xóa Broker | `broker:delete_any` | — |

### Các trang khác (Licenses, Features, Promotions, Watchlists)
- Manager có full `*:manage` permissions → tất cả nút enabled
- Chỉ admin mới vào được Roles, Permissions, Sessions, OTPs → tất cả nút enabled

**Tooltip khi disable:** "Bạn không có quyền thực hiện thao tác này"

---

## 5. Broker Dashboard

Dùng chung endpoint `GET /api/v1/dashboard/stats`. Backend filter data dựa trên role của user gọi API.

### Admin/Manager thấy (full dashboard)
- KPI Cards: total revenue, successful orders, new users, active subscriptions, churn rate, pending orders
- Revenue Trend Chart
- User Growth Chart
- Revenue by License Chart
- Subscription Distribution Donut
- Transaction Status Donut
- Top Promotions Chart
- Top Brokers Chart
- Recent Transactions Table

### Broker thấy (filtered dashboard)
- **Broker Info Header**: Hiển thị tên broker và mã broker (referral code) ở đầu dashboard để broker biết mình là ai
- KPI Cards (chỉ liên quan broker): tổng đơn referred, tổng commission/revenue từ referral
- Recent Referred Transactions Table (giao dịch qua mã broker)
- Không hiện: total users, user growth, churn rate, subscription distribution, top promotions, top brokers

### Backend changes cho `/api/v1/dashboard/stats`
- Detect role của caller
- Nếu broker: chỉ trả data liên quan đến broker_code của user (transactions referred, revenue from referrals)
- Nếu admin/manager: trả full data như hiện tại

### Frontend changes cho Dashboard page
- Check permissions để quyết định render charts nào
- Broker: render chỉ broker-specific components
- Admin/Manager: render full dashboard

---

## 6. Files to Modify

### Backend (finext-fastapi)
1. `app/routers/auth.py` — thêm endpoint `GET /api/v1/auth/me/permissions`
2. `app/routers/dashboard.py` — filter data theo role trong `/api/v1/dashboard/stats`

### Frontend (finext-nextjs)
1. `services/core/types.ts` — thêm `permissions: string[]` vào SessionData
2. `components/auth/AuthProvider.tsx` — fetch permissions, thêm `hasPermission()` helper
3. `app/admin/LayoutContent.tsx` — filter navigation theo permissions, route protection redirect
4. `app/admin/dashboard/PageContent.tsx` — conditional rendering theo permissions (broker vs admin/manager)
5. `app/admin/users/PageContent.tsx` — disable buttons theo permissions
6. `app/admin/transactions/PageContent.tsx` — disable buttons theo permissions
7. `app/admin/subscriptions/PageContent.tsx` — disable buttons cho manager (delete)
8. Các page khác (brokers, licenses, features, promotions, watchlists) — disable buttons nếu cần

---

## 7. Không thay đổi

- Cấu trúc thư mục admin (không thêm/xóa page)
- Backend permission seed config (permissions đã đúng)
- Middleware route protection (vẫn check cookie như cũ)
- Các component UI hiện có (chỉ thêm logic disable, không redesign)
