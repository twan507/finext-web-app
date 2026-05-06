# Trạng thái session — Finext compliance pivot

**Cập nhật:** 2026-05-06
**Tham chiếu kế hoạch gốc:** [finext-huong-dan-dong-dang-ky.md](finext-huong-dan-dong-dang-ky.md)

## Mục tiêu

Chuyển Finext từ pre-launch (đăng ký công khai, gói trả phí, news full content) sang chế độ **tham chiếu cá nhân, đảm bảo không vi phạm pháp luật chứng khoán Việt Nam**, với rủi ro tối thiểu cho personal demo.

## Quyết định scope (đã chốt với user)

| Nguyên tắc | Áp dụng |
|---|---|
| **Chỉ sửa FE** | BE giữ nguyên. FE ngắt UX path → BE không nhận request → đủ. |
| **Comment thay xóa** | Code đã viết không xóa. Wrap trong block comment hoặc cắt route/link. |
| **Không đổi tên nhỏ nhặt** | Bỏ qua rename email template, rename `/support/consultation` → `/support/contact`, đổi tên component `FeaturedStocks` → `MoneyFlowHighlights`, v.v. |
| **Giữ roles** | Không đụng phân quyền BE. Nếu cần mở khóa tính năng, **bỏ role gating ở FE** (ví dụ: bỏ `OptionalAuthWrapper`, `BASIC_AND_ABOVE` ở các page bị gate). |
| **Đổi nội dung `/open-account`** | Thay form mở tài khoản chứng khoán broker bằng form conditional (chi tiết đang chờ xác nhận — xem dưới). |

## Phase mapping (kế hoạch gốc → quyết định)

| Phase gốc | Quyết định |
|---|---|
| 1.1 Đóng `POST /auth/register` (BE) | **Bỏ qua BE.** FE comment link "Đăng ký" + replace `/register` page bằng redirect/placeholder. |
| 1.2 Chặn Google OAuth tự tạo user | ⏳ **Đang chờ user xác nhận** (câu 4 dưới). |
| 1.3 Bỏ trang `/register` (FE) | ✅ Áp dụng — replace bằng redirect. |
| 1.4 Bỏ link "Đăng ký" header + login | ✅ Áp dụng — comment block JSX. |
| 1.5 `/request-access` (optional) | **Bỏ qua** — thay thế bằng form `/open-account` mới (chi tiết câu 1). |
| 2.1 News external link | ✅ Áp dụng FE — card click dùng `external_url`, detail page redirect. BE: news là external SSE, không động. |
| 2.2 Reports bỏ stock_analysis | **Bỏ qua** — chưa rõ có data thật, không đổi tên. |
| 2.3 Đổi "Featured Stocks" | **Bỏ qua** — code đã dùng "Top dòng tiền vào/ra mạnh". |
| 2.4 Sectors "strength" → metric | **Bỏ qua** — code đã dùng "sức mạnh". |
| 2.5 Disable `/open-account` | **Thay đổi**: không disable, mà đổi nội dung thành 2 form conditional. |
| 2.6 Rename email templates | **Bỏ qua hoàn toàn.** |
| 2.7 Rà copy "khuyến nghị/tín hiệu" | ✅ Đã sạch (grep không tìm thấy). |
| 3.1 Reduce user fields | **Bỏ qua** (BE work). |
| 3.2 Self-delete `DELETE /users/me` | **Bỏ qua** (BE work). |
| 3.3 TTL sessions/otps | **Bỏ qua** (BE work). |
| 4.1-4.3 Update content 3 trang policies | ✅ Áp dụng — FE update content theo template ở kế hoạch gốc. |
| 4.4 Footer disclaimer | ✅ Áp dụng — thêm text vào [Footer.tsx](finext-nextjs/components/layout/Footer.tsx). |
| 4.5 Banner stocks/charts | ✅ Áp dụng — thêm `<Alert>` ở đầu [stocks/[symbol]/page.tsx](finext-nextjs/app/(main)/stocks/[symbol]/page.tsx) và [charts/[id]/page.tsx](finext-nextjs/app/(main)/charts/[id]/page.tsx). |
| 4.6 Consent modal lần đầu login | **Bỏ qua** (cần BE field + endpoint). |
| 5.1 Disable `POST /transactions/me/orders` | **Bỏ qua BE.** FE: ẩn nút "Mua ngay" nếu có. |
| 5.2 Bỏ PATRON khỏi seed | **Bỏ qua BE.** FE: ẩn nút mua gói PATRON. |
| 5.3 Migration deactivate PATRON subs | **Bỏ qua** (BE script). |
| 5.4 Convert `/plans` page | ✅ Áp dụng — đổi text page, không nút mua. |
| 5.5 SePay roadmap ON HOLD | Optional — sẽ làm sau khi xong main work. |
| 5.6 Bỏ `/profile/subscriptions` khỏi sidebar | ✅ Áp dụng — comment link sidebar. |
| 6.1 robots.txt disallow `/` | ✅ Áp dụng — sửa [app/robots.ts](finext-nextjs/app/robots.ts). |
| 6.2 Meta noindex | ✅ Áp dụng — sửa metadata [app/layout.tsx:36-119](finext-nextjs/app/layout.tsx#L36). |
| 6.3 Sitemap empty | ✅ Áp dụng — sửa [app/sitemap.ts](finext-nextjs/app/sitemap.ts) return `[]`. |
| 6.4 Bỏ JSON-LD | ✅ Áp dụng — comment block JSON-LD ở [layout.tsx:222-306](finext-nextjs/app/layout.tsx#L222). |
| 6.5 PWA | Giữ nguyên. |
| 7 Verification + smoke test | Sẽ làm sau khi xong. |
| 8 DPIA filing A05 | Optional, không nằm trong code work. |

## Đang chờ user trả lời (4 câu)

Trước khi bắt đầu sửa code, cần user trả lời 4 câu sau (đã hỏi ở turn trước):

### Câu 1 — Form `/open-account` cho GUEST (chưa login)
"Form đăng ký tài khoản" ý là:
- **(a)** Form đăng ký Finext bình thường (email + password + tên, gọi `POST /auth/register`) — tức quay về public register, **bỏ hoàn toàn ý invite-only**.
- **(b)** Form yêu cầu cấp quyền (email + tên + lý do, gửi email tới admin qua endpoint `POST /api/v1/emails/consultation` đã có sẵn).

→ Nếu (a): trang `/register` cũ redirect về `/open-account` hay giữ riêng?

### Câu 2 — Form cho USER đã login: "trò chuyện 1:1 với chuyên gia"
- Field gồm: chủ đề, mô tả, thời gian rảnh, số điện thoại (tùy chọn)? Hay khác?
- Submit qua `POST /api/v1/emails/consultation` đã có?
- ⚠️ Compliance: tư vấn cá nhân về **đầu tư/mã/danh mục** vẫn rủi ro. Đề xuất đổi tên thành "Hỏi đáp 1:1 về cách dùng Finext" hoặc "Hỗ trợ kỹ thuật 1:1" — focus hướng dẫn platform, không tư vấn mã. **User thấy sao?**

### Câu 3 — URL & menu
- Giữ URL `/open-account` hay đổi sang `/contact`, `/register`, hoặc khác?
- Text nút trên menu hiện tại là gì? Đổi sang gì?

### Câu 4 — Google OAuth
- Hiện [crud/users.py:128 `get_or_create_user_from_google_sub_email()`](finext-fastapi/app/crud/users.py#L128) **tự tạo user mới** khi đăng nhập Google. Tức là bất kỳ ai có Gmail đều có account.
- Bạn muốn:
  - **Kệ luôn** — Google login mở public.
  - **Ngắt ở FE** — tôi thêm 1 check ở FE callback Google để báo lỗi nếu user chưa có account (BE vẫn auto-create, nhưng FE không cho user vào).
  - **Sửa BE** (ngược nguyên tắc đã chốt).

## Files đã khảo sát (key paths)

### Backend (chỉ tham chiếu — không sửa)
- [auth.py:84 `register_user()`](finext-fastapi/app/routers/auth.py#L84)
- [auth.py:652 `google_oauth_callback()`](finext-fastapi/app/routers/auth.py#L652)
- [crud/users.py:128 `get_or_create_user_from_google_sub_email()`](finext-fastapi/app/crud/users.py#L128) — auto-create on Google login
- [emails.py:86 `send_open_account_request()`](finext-fastapi/app/routers/emails.py#L86)
- [emails.py:69 consultation endpoint] — sẵn có, có thể tái dùng cho form 1:1
- [transactions.py:59 `user_create_new_order()`](finext-fastapi/app/routers/transactions.py#L59)
- [schemas/users.py UserInDB:104-118](finext-fastapi/app/schemas/users.py#L104) — không có field `consent_accepted_at`
- [database.py:50-55](finext-fastapi/app/core/database.py#L50) — sessions/otps không có TTL
- File seed licenses: agent báo `app/core/seeding/_seed_licenses.py` nhưng cần verify lại.

### Frontend (sẽ sửa)
- [app/(auth)/register/page.tsx](finext-nextjs/app/(auth)/register/page.tsx) — replace bằng redirect
- [app/(auth)/login/PageContent.tsx:620](finext-nextjs/app/(auth)/login/PageContent.tsx#L620) — comment link "Đăng ký"
- [components/auth/AuthButtons.tsx:78](finext-nextjs/components/auth/AuthButtons.tsx#L78) — comment nút "Đăng ký"
- [app/(auth)/components/LoginForm.tsx:111](finext-nextjs/app/(auth)/components/LoginForm.tsx#L111) — Google login button
- [app/(main)/news/[articleId]/PageContent.tsx](finext-nextjs/app/(main)/news/[articleId]/PageContent.tsx) — đổi sang dùng `external_url`
- [app/(main)/open-account/page.tsx](finext-nextjs/app/(main)/open-account/page.tsx) — **chính** — replace nội dung
- [app/(main)/plans/page.tsx](finext-nextjs/app/(main)/plans/page.tsx) — đổi text
- [app/(main)/profile/subscriptions/page.tsx](finext-nextjs/app/(main)/profile/subscriptions/page.tsx) — comment link sidebar
- [app/(main)/policies/privacy/page.tsx](finext-nextjs/app/(main)/policies/privacy/page.tsx) — update content
- [app/(main)/policies/disclaimer/page.tsx](finext-nextjs/app/(main)/policies/disclaimer/page.tsx) — update content
- [app/(main)/policies/content/page.tsx](finext-nextjs/app/(main)/policies/content/page.tsx) — update content
- [components/layout/Footer.tsx:32](finext-nextjs/components/layout/Footer.tsx#L32) — thêm disclaimer text
- [app/(main)/stocks/[symbol]/page.tsx](finext-nextjs/app/(main)/stocks/[symbol]/page.tsx) — thêm Alert banner
- [app/(main)/charts/[id]/page.tsx](finext-nextjs/app/(main)/charts/[id]/page.tsx) — thêm Alert banner
- [app/robots.ts](finext-nextjs/app/robots.ts) — disallow all
- [app/sitemap.ts](finext-nextjs/app/sitemap.ts) — return []
- [app/layout.tsx:36-119](finext-nextjs/app/layout.tsx#L36) — robots noindex
- [app/layout.tsx:222-306](finext-nextjs/app/layout.tsx#L222) — comment JSON-LD

## Memory đã lưu (cho session sau)

- `feedback_minimal_changes.md` — comment thay xóa, không đổi tên nhỏ nhặt
- `feedback_fe_first_disable.md` — disable feature = sửa FE, không đụng BE/role

## Files đã modify trong session này

Chưa có. Mới ở giai đoạn khảo sát + planning. Chỉ tạo:
- File này (`finext-session-state.md`)
- 3 file memory ở `C:\Users\tuanb\.claude\projects\d--twan-projects-finext-web-app\memory\`

## Bước tiếp theo khi resume

1. User trả lời 4 câu hỏi ở section "Đang chờ user trả lời".
2. Tôi tạo TodoWrite với các phase đã chốt.
3. Bắt đầu **Đợt 1** (low-risk wins):
   - Phase 6.1-6.4 (SEO): 5 file, đảo flag
   - Phase 1.3-1.4 (đóng register FE): comment + redirect
   - Phase 5.6 (sidebar subscriptions)
   - Phase 4.4 (footer disclaimer)
4. Đợt 2: nội dung policies, banner stocks/charts, news external link, `/open-account` form mới (sau khi chốt câu 1-3).
5. Đợt 3 (optional sau): Phase 5.5 SePay ON HOLD note.

## Prompt mẫu khi resume session sau

```
Tiếp tục từ session trước. Đọc finext-session-state.md để nắm context.

Trả lời 4 câu hỏi:
1. Form open-account guest: chọn (a) hoặc (b).
2. Form 1:1 chuyên gia: tên + field + đồng ý đổi thành "hỗ trợ kỹ thuật/cách dùng" thay vì "tư vấn"?
3. URL & menu text.
4. Google OAuth: kệ / ngắt FE / sửa BE.

Sau khi trả lời, bắt đầu Đợt 1.
```
