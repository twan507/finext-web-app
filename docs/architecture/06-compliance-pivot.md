# 06 — Compliance Pivot 2026-05-07

> Chuyển Finext từ pre-launch (đăng ký công khai OTP, gói trả phí, news re-publish) sang chế độ tham chiếu cá nhân, tuân thủ pháp luật chứng khoán Việt Nam.

**Status:** ✅ DONE (chính). Vẫn còn vài điều chỉnh nhỏ sau ngày 2026-05-07.

**Kế hoạch chi tiết:** [`../superpowers/plans/2026-05-07-finext-compliance-pivot.md`](../superpowers/plans/2026-05-07-finext-compliance-pivot.md)

---

## 6.1 Thay Đổi Đã Áp Dụng

### Auth Flow (BE + FE)

#### Register flow rewrite
- BE: bỏ OTP self-verify, thay bằng **admin manual approval**.
- DNS MX check (`email-validator` + `dnspython`) trước khi tạo user → catch domain không tồn tại.
- Gửi mail "yêu cầu đã ghi nhận" (`registration_received.html`) **SYNC**, fail → rollback delete user.
- FE register form: bỏ OTP step → success Alert + nút "Quay lại đăng nhập".

#### Admin activation email
- `PUT /api/v1/users/{id}` detect transition `is_active False→True` → MX check + send mail "tài khoản đã kích hoạt" (`account_activated.html`) SYNC → fail → rollback DB.
- Template: Vietnamese, formal tone, có link `FRONTEND_URL/login`.

#### LoginForm inactive handling
- Thay vì auto request OTP → hiện message **"Tài khoản chưa kích hoạt, đội ngũ Finext sẽ xác nhận trong 1 giờ"**.

#### Google OAuth disconnect
- Comment block JSX nút Google login + register (`{false && (<>...</>)}`).
- User mất Google login → dùng forgot-password để khôi phục.
- `/auth/google/callback` add vào `BLOCKED_ROUTES` → 403.

### 403-Blocked Routes

File: [`finext-nextjs/lib/blocked-routes.ts`](../../finext-nextjs/lib/blocked-routes.ts) — danh sách centralized, `middleware.ts` đọc và return 403 cho:
- `/open-account`
- `/profile/subscriptions`
- `/auth/google/callback`

### SEO

- `robots.ts`: giữ behavior cũ, thêm `/open-account` vào `disallow`.
- `sitemap.ts`: bỏ entry `/open-account`.
- `layout.tsx` JSON-LD: bỏ entry "Mở tài khoản". Metadata `robots` giữ nguyên `index: true, follow: true`.

### Compliance Content

| Vị trí | Trước | Sau |
|--------|-------|-----|
| **Footer** | (compliance block — đã thêm rồi removed) | Block disclaimer **removed** ngày 2026-05-07 13:09 (commit `30a12e3`). Chỉ còn copyright bar. |
| **News detail page** (`/news/[articleId]`) | Render full `html_content`. | Alert "Đây là bản tóm tắt..." + text-link "Đọc đầy đủ" → external `article.link`. Code render full vẫn còn (wrap `{false && ...}`). |

### UI Changes

- **ConsultationSection** (home): heading "Trở thành thành viên cộng đồng nhà đầu tư Chuyên Nghiệp", body "Kết nối cộng đồng nhà đầu tư nhiều kinh nghiệm...", button **"Gia nhập cộng đồng"** → Zalo group `https://zalo.me/g/rvogov075` (tab mới).
- **Profile sidebar:** comment menu item "Gói đăng ký".
- **Header:** giữ nguyên "Đăng ký" button visible (flow đăng ký vẫn mở, chỉ admin approval).

### Tier Gating Bypassed

File: [`finext-nextjs/components/auth/features.ts`](../../finext-nextjs/components/auth/features.ts)

```typescript
// ADVANCED_AND_ABOVE include FEATURES.BASIC ở đầu list
// → mọi user logged-in (kể cả gói BASIC) xem được toàn bộ content gated trước đây
```

Tác động: `/charts/[id]`, `/groups`, `/markets`, `/sectors`, `/stocks`, etc. — mở cho mọi user.

---

## 6.2 Tính Năng Đã Code Nhưng Đang TẮT

> ⚠️ Các block code dưới đây đang bị **disable** nhưng **KHÔNG xóa** — sẵn sàng bật lại nếu rollback.

| # | Tính năng | Cách tắt | File chính |
|---|-----------|---------|-----------|
| 1 | OTP register flow (BE) | Function `register_user()` rewrite, imports OTP-related giữ với `# noqa: F401` | [`app/routers/auth.py`](../../finext-fastapi/app/routers/auth.py) |
| 2 | OTP step trong RegisterForm | State + handlers + JSX block commented | [`app/(auth)/components/RegisterForm.tsx`](../../finext-nextjs/app/(auth)/components/RegisterForm.tsx) |
| 3 | "User is inactive" auto OTP | Branch logic đổi sang error message | [`app/(auth)/components/LoginForm.tsx`](../../finext-nextjs/app/(auth)/components/LoginForm.tsx) |
| 4 | Google login button | Wrap `{false && (<>Divider + Provider</>)}` | `LoginForm.tsx` |
| 5 | Google register button | Wrap `{false && (<>Divider + Provider</>)}` | `RegisterForm.tsx` |
| 6 | JSON-LD entry "Mở tài khoản" | Block 3 dòng comment | [`app/layout.tsx`](../../finext-nextjs/app/layout.tsx) |
| 7 | ConsultationSection `Link` import | Comment line | `home/components/ConsultationSection.tsx` |
| 8 | Sidebar profile "Gói đăng ký" | Comment menu item + import | `(main)/profile/LayoutContent.tsx` |
| 9 | News full content render | Wrap `dangerouslySetInnerHTML` Box trong `{false && (...)}` | `news/[articleId]/PageContent.tsx` |
| 10 | Tier gating `ADVANCED_AND_ABOVE` | Include `FEATURES.BASIC` ở đầu list | `components/auth/features.ts` |
| 11 | `/open-account` page | Code page nguyên, route bị 403 qua middleware | `BLOCKED_ROUTES` |
| 12 | `/profile/subscriptions` page | Code page nguyên, route bị 403 qua middleware | `BLOCKED_ROUTES` |

---

## 6.3 Files Mới (Created)

- [`finext-nextjs/lib/blocked-routes.ts`](../../finext-nextjs/lib/blocked-routes.ts) — Centralized 403 list + helper
- [`finext-fastapi/app/templates/registration_received.html`](../../finext-fastapi/app/templates/registration_received.html) — Email template
- [`finext-fastapi/app/templates/account_activated.html`](../../finext-fastapi/app/templates/account_activated.html) — Email template

---

## 6.4 Phase Đã Skip Có Chủ Ý

| Phase | Lý do skip |
|-------|-----------|
| Banner Alert ở `/stocks/[symbol]` + `/charts/[id]` | User: "đã đóng đăng kí rồi kệ cái này đi" — compliance đã đủ qua footer disclaimer + news CTA |
| Comment "Đăng ký" button header | User: "nút đăng ký giữ như bình thường, chỉ sửa logic sau khi đăng ký" — flow đăng ký vẫn mở |
| Update content `/policies/{privacy,disclaimer,content}` | User: "các page đã code cứ giữ nguyên" — chỉ update khi cần thiết |
| BE work: transactions disable, PATRON deactivate, user schema reduce | Theo nguyên tắc FE-only ngoại trừ register flow |

---

## 6.5 Điều Chỉnh Hậu Pivot (sau 2026-05-07)

| Ngày | Commit | Thay đổi |
|------|--------|---------|
| 2026-05-07 10:17 | `10c75af` | Tweak LoginForm message |
| 2026-05-07 10:23 | `65076ba` | Tweak news detail wording |
| 2026-05-07 13:09 | `30a12e3` | **Remove** Footer compliance disclaimer block (25 dòng) |
| 2026-05-07 14:41 | `73c455c` | Enhance `StockInfoSection` + `StockKeyMetricsPanel` |
| 2026-05-07 14:46 | `27586f3` | Add `viewModeStore.ts` cho `stocks/[symbol]` |

---

## 6.6 Cách Rollback (Nếu Cần)

1. **Bật lại OTP register:** uncomment block trong `RegisterForm.tsx` + revert `register_user()` ở `auth.py` (xem git history commit `bfac978`).
2. **Bật lại Google OAuth:** đổi `{false && (...)}` → `{(...)}` ở Login/RegisterForm. Remove `/auth/google/callback` khỏi `BLOCKED_ROUTES`.
3. **Mở lại `/open-account`, `/profile/subscriptions`:** xóa khỏi `BLOCKED_ROUTES`.
4. **Bật tier gating:** xóa `FEATURES.BASIC` khỏi đầu list `ADVANCED_AND_ABOVE`.
5. **Bật full news content:** đổi `{false && (...)}` → `{(...)}` block `dangerouslySetInnerHTML`.

Tham khảo plan đầy đủ cho path khôi phục: [`2026-05-07-finext-compliance-pivot.md`](../superpowers/plans/2026-05-07-finext-compliance-pivot.md).
