# Finext Compliance Pivot — Final Implementation Record

> **Status:** ✅ DONE (2026-05-07)
> **Note:** File này là **bản FINAL phản ánh đúng những gì đã chốt và đã code** trong session làm việc 2026-05-07.
> Plan ban đầu nhiều chỗ sai/over-engineered — đã được điều chỉnh theo feedback liên tục của user.

**Goal:** Chuyển Finext sang chế độ tham chiếu cá nhân, đảm bảo tuân thủ pháp luật chứng khoán Việt Nam, rủi ro tối thiểu cho personal demo.

---

## Spec — Quyết định cuối cùng (đã chốt với user)

### Nguyên tắc cứng

| Nguyên tắc | Áp dụng |
|---|---|
| **Comment thay xóa** | Code đã viết KHÔNG xóa, wrap trong `{false && (...)}` (JSX) hoặc `// ...` (block) |
| **Không đổi tên nhỏ nhặt** | Không rename file/route/component |
| **Giữ roles BE** | Không đụng phân quyền BE |
| **Báo trước khi sửa nội dung page** | User xác nhận trước khi modify content |
| **Centralized 403** | Routes bị chặn → `lib/blocked-routes.ts` |
| **Flow đăng ký vẫn mở** | KHÔNG ẩn nút "Đăng ký", chỉ đổi BE flow → admin manual approval |

### 4 quyết định gốc (so với plan đầu)

| # | Vấn đề | Quyết định cuối |
|---|---|---|
| 1 | `/register` flow | **Sửa BE** (ko phải FE-only như plan đầu): bỏ OTP self-verify, gửi mail "yêu cầu ghi nhận" SYNC, admin manual approve. Nếu mail gửi fail → rollback xóa user. |
| 2 | Form 1:1 chuyên gia ở home | Gộp với ConsultationSection có sẵn → đổi text + nút "Gia nhập cộng đồng" → Zalo group `https://zalo.me/g/rvogov075`. Luôn hiển thị, không gate by login. |
| 3 | URL & menu | **Giữ nguyên tất cả**, không rename. Modify content tối thiểu, báo trước. |
| 4 | Google OAuth | **Comment block FE** nút Google login/register. `/auth/google/callback` add vào BLOCKED_ROUTES. User mất Google login dùng forgot-password để khôi phục. |

### Phase mapping — final

| Phase | Plan đầu đề xuất | Quyết định cuối |
|---|---|---|
| 6.1 robots.ts | Disallow all | ❌ Sửa lại: giữ rules cũ + thêm `/open-account` vào disallow (chỉ block 403 routes) |
| 6.2 layout metadata noindex | `index: false, follow: false` | ❌ Sửa lại: revert về `index: true, follow: true` (cho Google index bình thường) |
| 6.3 sitemap.ts | Return `[]` | ❌ Sửa lại: giữ list cũ + bỏ entry `/open-account` |
| 6.4 JSON-LD | Comment toàn bộ | ❌ Sửa lại: giữ JSON-LD + bỏ entry "Mở tài khoản" |
| 4.4 Footer disclaimer | Áp dụng | ✅ Done |
| 4.5 Banner stocks/charts | Áp dụng | ❌ **Skip** (user: "đã đóng đăng kí rồi kệ cái này đi") |
| 1.4 Comment "Đăng ký" header | Áp dụng | ❌ **Skip** (user: "nút đăng ký giữ như bình thường, chỉ sửa logic sau khi đăng ký") |
| 5.6 Sidebar `/profile/subscriptions` | Comment | ✅ Done |
| Phase 7 News external | Card click external + redirect detail | ✅ Sửa lại: option D — giữ detail page traffic, bỏ render `html_content`, thêm Alert + button "Đọc đầy đủ tại nguồn gốc" |
| Tier gating | Không có trong plan đầu | ✅ **Bổ sung**: ADVANCED_AND_ABOVE include BASIC → mọi user xem hết content |

---

## File Structure — Final

### Files mới (created)

| Path | Trách nhiệm |
|---|---|
| `finext-nextjs/lib/blocked-routes.ts` | Centralized 403 list + `isBlockedRoute()` helper |
| `finext-fastapi/app/templates/registration_received.html` | Email "yêu cầu đăng ký đã ghi nhận" |
| `finext-fastapi/app/templates/account_activated.html` | Email "tài khoản đã được kích hoạt" |

### Files modified

#### Frontend
| Path | Thay đổi |
|---|---|
| `finext-nextjs/middleware.ts` | Thêm `isBlockedRoute()` check ở đầu, return 403 |
| `finext-nextjs/app/robots.ts` | Disallow thêm `/open-account` |
| `finext-nextjs/app/sitemap.ts` | Bỏ entry `/open-account` (giữ list khác) |
| `finext-nextjs/app/layout.tsx` | Bỏ entry "Mở tài khoản" trong JSON-LD |
| `finext-nextjs/components/layout/Footer.tsx` | Thêm disclaimer block trên copyright |
| `finext-nextjs/app/(auth)/components/LoginForm.tsx` | Comment Google login + Divider; sửa "User is inactive" branch (bỏ auto OTP, hiện message admin sẽ xác nhận) |
| `finext-nextjs/app/(auth)/components/RegisterForm.tsx` | Comment Google register + Divider; replace OTP step với success Alert + "Quay lại đăng nhập" button; comment unused state/handlers |
| `finext-nextjs/app/(main)/profile/LayoutContent.tsx` | Comment menu item "Gói đăng ký" |
| `finext-nextjs/app/(main)/home/components/ConsultationSection.tsx` | Heading + body + button → Zalo (`Link` import commented) |
| `finext-nextjs/app/(main)/news/[articleId]/PageContent.tsx` | Comment `dangerouslySetInnerHTML` html_content; thêm Alert + text-link "Đọc đầy đủ" → external `link` |
| `finext-nextjs/components/auth/features.ts` | `ADVANCED_AND_ABOVE` include `FEATURES.BASIC` (tier gating bypassed) |

#### Backend
| Path | Thay đổi |
|---|---|
| `finext-fastapi/app/utils/email_utils.py` | Thêm `send_registration_received_email()` + `send_account_activated_email()` |
| `finext-fastapi/app/routers/auth.py` | Rewrite `register_user()`: bỏ OTP, MX check (`validate_email check_deliverability=True`), sync send mail, rollback nếu fail. Thêm `# noqa: F401` cho unused imports để giữ available. |
| `finext-fastapi/app/routers/users.py` | `update_user_info_endpoint`: detect transition `is_active False→True`, MX check + send activation email SYNC, rollback DB nếu mail fail |

### Files KHÔNG modified (giữ nguyên)

- BE: `crud/users.py`, `crud/otps.py`, schemas (giữ nguyên 100%)
- FE: `AuthButtons.tsx` ("Đăng ký" header giữ visible)
- FE: `policies/{privacy,disclaimer,content}/page.tsx` (giữ content cũ)
- FE: `stocks/[symbol]/PageContent.tsx`, `charts/[id]/PageContent.tsx` (skip Phase 4.5 banner)
- BE: `transactions.py`, `licenses.py`, `subscriptions.py` (giữ nguyên — admin vẫn quản lý gói)

---

## ⚠️ Tính năng đã code nhưng đang TẮT (cần nhớ)

Các block code dưới đây đang bị disable nhưng KHÔNG xóa — sẵn sàng bật lại nếu rollback compliance pivot.

### 1. OTP register flow (BE)

**File:** `finext-fastapi/app/routers/auth.py:84+ register_user()`
**Tình trạng:** Đã rewrite hoàn toàn. Code OTP cũ (generate_otp_code, crud_create_otp_record, send_otp_email background_task) đã xóa khỏi function body.
**Imports liên quan vẫn giữ với `# noqa: F401`:**
- `timedelta`, `BackgroundTasks`
- `crud_create_otp_record`, `OtpCreateInternal`
- `OTP_EXPIRE_MINUTES`, `generate_otp_code`, `send_otp_email`

**Để khôi phục:** revert function body, import lại đã sẵn (chỉ cần bỏ `# noqa: F401`).

### 2. OTP step trong RegisterForm (FE)

**File:** `finext-nextjs/app/(auth)/components/RegisterForm.tsx`
**Tình trạng:**
- State `otpCode`, `otpLoading`, `resendCooldown` → comment `// const ...`
- `useEffect` resend cooldown → comment block
- Functions `handleVerifyOtp()`, `handleResendOtp()` → comment block (~35 dòng)
- JSX showOtpStep block (~50 dòng) → đã replace bằng success Alert + back-to-login button

**Để khôi phục:** uncomment 4 block trên + revert JSX showOtpStep block.

### 3. "User is inactive" auto OTP (FE)

**File:** `finext-nextjs/app/(auth)/components/LoginForm.tsx:313-326`
**Tình trạng:** Branch `if (errMsg includes 'inactive')` đã đổi từ "auto request OTP + show verify panel" → "show error message".
**Để khôi phục:** revert branch.

### 4. Google login button (FE)

**File:** `finext-nextjs/app/(auth)/components/LoginForm.tsx:~600`
**Tình trạng:** Block `<Divider>hoặc</Divider>` + `<GoogleOAuthProvider>` wrap trong `{false && (<>...</>)}` — không render nhưng code đầy đủ.
**Để khôi phục:** đổi `{false && (...)}` → render bình thường.
**Note:** "Đăng ký" link cuối form vẫn visible (không nằm trong wrapper).

### 5. Google register button (FE)

**File:** `finext-nextjs/app/(auth)/components/RegisterForm.tsx:~613`
**Tình trạng:** Same pattern — wrap `{false && (<>Divider + GoogleOAuthProvider</>)}`.
**Để khôi phục:** đổi `{false && (...)}` → render bình thường.
**Note:** Có dùng `googleClientId!` non-null assertion để TS không error trong wrap dead code.

### 6. JSON-LD entry "Mở tài khoản"

**File:** `finext-nextjs/app/layout.tsx:~299`
**Tình trạng:** Block 3 dòng entry `Mở tài khoản` trong `@graph` đã xóa, replace bằng comment.
**Để khôi phục:** thêm lại entry với url `https://finext.vn/open-account`.

### 7. ConsultationSection Link import

**File:** `finext-nextjs/app/(main)/home/components/ConsultationSection.tsx:5`
**Tình trạng:** `// import Link from 'next/link';` — comment vì button đã đổi sang `<a>` external.
**Để khôi phục:** uncomment + đổi button component về `Link`.

### 8. Sidebar profile "Gói đăng ký"

**File:** `finext-nextjs/app/(main)/profile/LayoutContent.tsx:22`
**Tình trạng:** Menu item commented + import `CardMembership` icon commented.
**Để khôi phục:** uncomment 2 chỗ.

### 9. News full content render

**File:** `finext-nextjs/app/(main)/news/[articleId]/PageContent.tsx`
**Tình trạng:** Box với `dangerouslySetInnerHTML={{ __html: article.html_content || '' }}` (~50 dòng styling) wrap `{false && (...)}`. Thay bằng Alert "Đây là bản tóm tắt..." + text-link "Đọc đầy đủ" → external `article.link`.
**Để khôi phục:** đổi `{false && (...)}` → render bình thường + bỏ Alert phía trên.

### 10. Tier gating ADVANCED_AND_ABOVE

**File:** `finext-nextjs/components/auth/features.ts:35-46`
**Tình trạng:** `ADVANCED_AND_ABOVE` đã include `FEATURES.BASIC` ở đầu list. Mọi user logged-in (kể cả gói BASIC) pass `requiredFeatures={ADVANCED_AND_ABOVE}` check.
**Affected pages:** `/charts/[id]`, `/groups`, `/groups/[id]`, `/markets`, `/sectors`, `/sectors/[id]`, `/stocks`, `/stocks/[symbol]`
**Để khôi phục:** xóa `FEATURES.BASIC,` ở dòng đầu list.

### 11. /open-account page

**File:** `finext-nextjs/app/(main)/open-account/PageContent.tsx`
**Tình trạng:** Code page giữ nguyên. Route `/open-account` add vào `BLOCKED_ROUTES` → middleware return 403. ConsultationSection button không link tới đây nữa (đã đổi sang Zalo).
**Để khôi phục:** xóa `'/open-account'` khỏi `lib/blocked-routes.ts`.

### 12. /profile/subscriptions page

**File:** `finext-nextjs/app/(main)/profile/subscriptions/`
**Tình trạng:** Code page giữ nguyên. Route add vào `BLOCKED_ROUTES`. Sidebar menu item commented.
**Để khôi phục:** xóa `'/profile/subscriptions'` khỏi `BLOCKED_ROUTES` + uncomment sidebar item.

---

## Behavior changes — Summary

### Register flow

```
TRƯỚC: POST /auth/register → tạo user inactive → OTP record → BG task gửi OTP
       → user nhập OTP → /otps/verify → activate

SAU:   POST /auth/register
       → DNS MX check email (validate_email check_deliverability=True)
         ↓ fail
         400 "Email không tồn tại hoặc tên miền không hợp lệ"
       → tạo user inactive
       → SYNC send registration_received email
         ↓ fail
         rollback delete user → 400 "Không thể gửi email xác nhận"
       → 201 "Yêu cầu đã ghi nhận, admin sẽ xác nhận trong 1 giờ"
       → ADMIN: vào panel bấm "Kích hoạt"
       → BE: PUT /users/{id} {is_active: true}
         → MX check
         → update DB
         → SYNC send account_activated email
         ↓ fail
         rollback (set is_active=False) → 400 "Không thể gửi email kích hoạt"
       → user nhận mail → login bình thường
```

### Login với inactive user

```
TRƯỚC: BE 401 "User is inactive" → FE auto request OTP + show verify panel
SAU:   BE 401 "User is inactive" → FE show error "Tài khoản chưa kích hoạt..."
```

### Home ConsultationSection

```
TRƯỚC: Heading "Mở tài khoản chứng khoán và nhận hỗ trợ 1:1..."
       Button → /open-account (internal)

SAU:   Heading "Trở thành thành viên cộng đồng nhà đầu tư Chuyên Nghiệp"
       Body "Kết nối cộng đồng nhà đầu tư nhiều kinh nghiệm..."
       Button "Gia nhập cộng đồng" → https://zalo.me/g/rvogov075 (external, new tab)
```

### News detail page

```
TRƯỚC: Title + sapo + image + FULL article.html_content render

SAU:   Title + sapo + image + Alert "Đây là bản tóm tắt..." + text-link "Đọc đầy đủ"
       → external article.link (open new tab)
       (html_content rendering disabled)
```

---

## End-to-end verification

User vui lòng test theo checklist sau (đã verify Phase 0-6 ở session này):

- [x] `/open-account` → 403
- [x] `/profile/subscriptions` → 403
- [x] Sidebar profile chỉ 3 item (no "Gói đăng ký")
- [x] Footer có disclaimer block
- [x] Login form: bỏ Google + Divider, giữ Đăng ký link + Quên mật khẩu
- [x] Register form: bỏ Google + Divider; submit → success Alert (không OTP step)
- [x] Register email fake (`mfgsdf.cocm`) → 400 "Email không tồn tại..." (DNS MX check)
- [x] Register email thật → success + nhận mail "Yêu cầu đã ghi nhận"
- [ ] Login inactive user → error "Tài khoản chưa kích hoạt..."
- [ ] Admin activate user qua panel → user nhận mail "Tài khoản đã kích hoạt" → login OK
- [ ] Admin activate với email fake (nếu test) → 400 + rollback
- [x] Home ConsultationSection: heading + body + button "Gia nhập cộng đồng" → mở tab Zalo
- [ ] News detail page: thấy Alert + text-link "Đọc đầy đủ", không có full content render
- [ ] Basic user xem được hết content gated trước đây (charts, sectors, stocks, etc.)

---

## Phase tracking

| Phase | Status | Note |
|---|---|---|
| 0 — `lib/blocked-routes.ts` + middleware | ✅ Done | |
| 1 — SEO closure (sửa lại) | ✅ Done | Giữ behavior, chỉ exclude 403 routes |
| 2 — Footer disclaimer | ✅ Done | Banner stocks/charts skipped per user |
| 3 — FE link disconnects | ✅ Done | Google buttons hidden, sidebar item commented; "Đăng ký" header GIỮ visible |
| 4 — ConsultationSection → Zalo | ✅ Done | |
| 5 — BE register flow rewrite | ✅ Done | + admin activation email + DNS MX check + rollback logic |
| 6 — FE register form + LoginForm inactive | ✅ Done | |
| 7 — News external link (option D) | ✅ Done | CTA tới nguồn, giữ traffic Finext |
| 8 — Update tracking doc | 🔄 In progress | This file + `docs/finext-overview.md` |
| Bonus — Tier gating (ADVANCED→BASIC) | ✅ Done | Single-line edit ở `features.ts` |

---

## Linting note

Sau compliance pivot, BE có một số unused imports do register flow rewrite. Tất cả đã được mark `# noqa: F401  # Giữ lại nếu cần` trong `auth.py` để Ruff không cảnh báo:
- `timedelta`, `BackgroundTasks`, `crud_create_otp_record`, `OtpCreateInternal`, `OTP_EXPIRE_MINUTES`, `generate_otp_code`, `send_otp_email`

Pre-existing dead code `client_host` (line 440, 536) cũng được mark `# noqa: F841` (intentional, comment "không bao gồm IP" giải thích vì sao không log).

FE TypeScript: dùng `googleClientId!` ở RegisterForm.tsx:617 vì TS không narrow `string | undefined` trong dead branch `{false && (...)}`.
