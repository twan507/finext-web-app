# 06 — Compliance Pivot 2026-05-07

> Chuyển Finext từ pre-launch (đăng ký công khai OTP, gói trả phí, news re-publish) sang chế độ tham chiếu cá nhân, tuân thủ pháp luật chứng khoán Việt Nam.

**Status:** ⚠️ **ĐÃ ROLLBACK MỘT PHẦN** ngày 2026-07-21 — xem [§6.7](#67-rollback-một-phần-2026-07-21). Phần auth (Google OAuth + đăng ký OTP tự xác thực) đã bật lại; các phần còn lại vẫn giữ nguyên trạng thái tắt.

**Source of truth hiện tại (2026-07-21):**

| Hạng mục | Trạng thái runtime |
|---|---|
| Đăng ký email | OTP 6 số, user tự xác thực; không chờ admin duyệt |
| Google login/register + `/auth/google/callback` | Bật |
| Route 403 | Chỉ `/open-account` và `/profile/subscriptions` |
| Full news HTML | Tắt; chỉ summary + link nguồn |
| `ADVANCED_AND_ABOVE` | Có BASIC (bypass tier cũ); Phase có guard strict riêng cho ba tab danh mục |

**Kế hoạch chi tiết:** [`../superpowers/plans/2026-05-07-finext-compliance-pivot.md`](../superpowers/plans/2026-05-07-finext-compliance-pivot.md)

---

## 6.1 Lịch Sử Pivot Gốc (2026-05-07)

> Phần này ghi lại trạng thái **đã từng áp dụng** từ 2026-05-07 đến trước rollback auth 2026-07-21. Các mô tả admin approval/ẩn Google dưới đây không còn là runtime hiện tại.

### Auth Flow tại thời điểm pivot (BE + FE)

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
- ~~`/auth/google/callback`~~ — đã gỡ 2026-07-21

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

## 6.2 Inventory Toggle Sau Pivot

> Các hàng gạch ngang 1–5 là **lịch sử và đã bật lại**. Hàng 6–12 phản ánh những phần vẫn bị ẩn/bypass/403 trong code hiện tại.

| # | Tính năng | Cách tắt | File chính |
|---|-----------|---------|-----------|
| ~~1~~ | ~~OTP register flow (BE)~~ | ✅ **Đã bật lại 2026-07-21** | [`app/routers/auth.py`](../../finext-fastapi/app/routers/auth.py) |
| ~~2~~ | ~~OTP step trong RegisterForm~~ | ✅ **Đã bật lại 2026-07-21** | [`app/(auth)/components/RegisterForm.tsx`](../../finext-nextjs/app/(auth)/components/RegisterForm.tsx) |
| ~~3~~ | ~~"User is inactive" auto OTP~~ | ✅ **Đã bật lại 2026-07-21** | [`app/(auth)/components/LoginForm.tsx`](../../finext-nextjs/app/(auth)/components/LoginForm.tsx) |
| ~~4~~ | ~~Google login button~~ | ✅ **Đã bật lại 2026-07-21** | `LoginForm.tsx` |
| ~~5~~ | ~~Google register button~~ | ✅ **Đã bật lại 2026-07-21** | `RegisterForm.tsx` |
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

1. ~~**Bật lại OTP register**~~ — ✅ đã làm 2026-07-21, xem §6.7.
2. ~~**Bật lại Google OAuth**~~ — ✅ đã làm 2026-07-21, xem §6.7.
3. **Mở lại `/open-account`, `/profile/subscriptions`:** xóa khỏi `BLOCKED_ROUTES`. *(chưa làm)*
4. **Bật tier gating:** xóa `FEATURES.BASIC` khỏi đầu list `ADVANCED_AND_ABOVE`. *(chưa làm)*
5. **Bật full news content:** đổi `{false && (...)}` → `{(...)}` block `dangerouslySetInnerHTML`. *(chưa làm)*

Tham khảo plan đầy đủ cho path khôi phục: [`2026-05-07-finext-compliance-pivot.md`](../superpowers/plans/2026-05-07-finext-compliance-pivot.md).

---

## 6.7 Rollback Một Phần (2026-07-21)

> Owner yêu cầu mở lại **đăng nhập Google** và **đăng ký tự xác thực bằng OTP** (bỏ khâu admin duyệt tay).
> Phạm vi giới hạn ở auth — mục 3, 4, 5 của §6.6 **cố ý không đụng tới**.

### Đã thay đổi

| Khu vực | File | Nội dung |
|---|---|---|
| Google login | [`LoginForm.tsx`](../../finext-nextjs/app/(auth)/components/LoginForm.tsx) | Gỡ wrapper `{false && (<>…</>)}` quanh Divider + `GoogleOAuthProvider` |
| Google register | [`RegisterForm.tsx`](../../finext-nextjs/app/(auth)/components/RegisterForm.tsx) | Như trên |
| Route 403 | [`blocked-routes.ts`](../../finext-nextjs/lib/blocked-routes.ts) | Xóa entry `/auth/google/callback` |
| Register BE | [`auth.py`](../../finext-fastapi/app/routers/auth.py) | `register_user()` → sinh OTP `email_verification` + gửi mail qua `BackgroundTasks`; thêm lại param `background_tasks: BackgroundTasks`; gỡ hết `# noqa: F401` trên các import OTP |
| OTP step FE | [`RegisterForm.tsx`](../../finext-nextjs/app/(auth)/components/RegisterForm.tsx) | Uncomment state `otpCode`/`otpLoading`/`resendCooldown`, `handleVerifyOtp`, `handleResendOtp`, JSX ô nhập 6 số + nút "Gửi lại mã" |
| Login inactive | [`LoginForm.tsx`](../../finext-nextjs/app/(auth)/components/LoginForm.tsx) | Nhánh `User is inactive` quay lại tự gọi `/otps/request` + mở `showVerifyPanel` thay vì hiện message chờ admin |

### Quyết định thiết kế

1. **Giữ DNS MX check** trong `register_user()` — đây là thứ pivot thêm vào nhưng có giá trị độc lập (chặn email gõ sai domain trước khi tạo user). Không liên quan compliance nên không revert.
2. **Bỏ mail `registration_received`** — mail OTP đã thay thế vai trò xác nhận; giữ cả hai thì user nhận 2 mail cùng lúc. Template và hàm `send_registration_received_email()` **vẫn còn trong repo**, chỉ không còn được gọi.
3. **Khôi phục nhánh inactive ở LoginForm** dù owner ban đầu không liệt kê — bắt buộc phải đi kèm, vì message "Đội ngũ Finext sẽ xác nhận trong 1 giờ" trở thành sai sự thật khi không còn ai duyệt tay.

### Ghi chú

- Backend Google OAuth **chưa từng bị tắt** — endpoint `POST /api/v1/auth/google/callback` vẫn public suốt thời gian pivot. Trước 2026-07-21 đây là lỗ hổng bypass admin approval; sau rollback thì thành hành vi mong muốn.
- Luồng OTP ở [`routers/otps.py`](../../finext-fastapi/app/routers/otps.py) không cần sửa gì: dòng 55 vốn đã có carve-out cho user inactive xin OTP loại `email_verification`, và `POST /otps/verify` tự set `is_active=True`.
- Rate-limit sẵn có: OTP TTL 5 phút, tối đa 10 lần thử, cooldown gửi lại 60s (`crud/otps.py`) — khớp với cooldown 60s ở FE.
- **Cần kiểm tra khi deploy:** biến `NEXT_PUBLIC_GOOGLE_CLIENT_ID` phải có giá trị thật trên prod, nếu trống nút Google render ở trạng thái disabled.

### Verify

`npx tsc --noEmit` sạch · `pytest tests/` 652 passed.
