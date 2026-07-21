# Kế hoạch hardening toàn dự án finext-web-app (2026-07-20)

> **HISTORICAL — COMPLETED / INTEGRATED:** Các thay đổi hardening đã được tích hợp vào code hiện tại; branch, số lỗi và nền test bên dưới chỉ là snapshot ngày 2026-07-20.

Branch: `review/hardening-2026-07-20` (KHÔNG commit lên main).
Mục tiêu owner: sửa toàn bộ lỗ hổng → hệ thống mượt, chịu tải tối đa, không hở bảo mật.
Phạm vi: LOẠI TRỪ Finext AI (agent/chat).
Nguồn: `scratchpad/review-SUMMARY.md` + review-A..G. Tổng: 2 Critical, 22 High, 36 Medium, 44 Low.

## Quyết định kỹ thuật (owner giao tự quyết)
1. Phạm vi: sửa Critical/High/Medium tác động + dựng lưới test; mỗi fix có test đỏ-trước-xanh-sau + kiểm chứng ngược.
2. Rate-limit: nginx `limit_req` ở biên (auth/otp) + khóa OTP theo attempts in-app (Mongo, không thêm dep). KHÔNG Redis.
3. SSE: giữ public (dữ liệu thị trường) NHƯNG validate ticker + cap tổng poller + nginx `limit_conn`.
4. Test runner FE: node:test có sẵn (thêm script `test` = `node --test`). KHÔNG thêm jest/vitest.
5. Compose: đảm bảo limits RAM hiệu lực (khai cả deploy.resources + tương thích) + log rotation.

## Nền test
- Backend: pytest-asyncio auto, testpaths=tests. Fake mongo hỗ trợ update_one(filter) atomic per-call, KHÔNG có find_one_and_update → atomicity dùng update_one filter compare-and-set.
- FE: node:test; date-fns 4.1.0 sẵn; verify `npx tsc --noEmit`.

## Nguyên tắc điều phối
- Session chính điều phối + kiểm chứng ngược + commit. Subagent Opus chỉ sửa+test module của mình, KHÔNG commit, KHÔNG chạy full suite (chỉ test file mình), KHÔNG npm build, KHÔNG dựng browser, KHÔNG sửa .env*.
- Chia module KHÔNG đè file để song song an toàn.

## WAVE 1 — Critical + High bảo mật/tiền (song song)
- **S1 backend-money** (crud/transactions, subscriptions, promotions, brokers + routers tương ứng):
  - C1 idempotency confirm: compare-and-set PENDING→SUCCEEDED bằng update_one filter status=PENDING TRƯỚC side-effect; modified_count=0 → dừng.
  - H công thức KM đồng nhất tạo/preview/confirm.
  - H usage KM atomic (compare-and-set khi inc, tôn trọng usage_limit).
  - H "1 sub active non-BASIC/user" atomic.
  - H /brokers/me route order (đặt trước /{id}).
- **S2 backend-sse** (routers/sse.py): validate ticker (whitelist tồn tại), cap tổng số poller, cap subscriber, đóng poller khi hết subscriber (đã có, kiểm chứng), không lộ str(e).
- **S3 backend-auth-security** (utils/otp_utils.py, routers/otps.py, crud/otps): OTP dùng secrets; khóa OTP theo max attempts + cooldown; KHÔNG lộ user-enumeration quá mức; KHÔNG đụng main.py.
- **S4 FE-security** (admin/users/components/EditUserModal.tsx, (auth)/components/LoginForm.tsx + util validateInternalPath): gỡ console.log lộ mật khẩu/role; validate callbackUrl chỉ internal path; test node:test.

## WAVE 2 — Lưới test nền + fix FE thuần đã kiểm chứng
- S5 backend test P0: permission matrix, IDOR (session/watchlist/subscription), JWT validate+revoke, response_wrapper không lộ lỗi.
- S6 FE thuần: fix dateUtils (getUTC*), thống nhất VSI 1 nguồn ngưỡng; script `test`; test đa timezone + VSI.

## WAVE 3 — FE bug hệ thống + hạ tầng
- S7 FE admin: sửa displayTotalCount/pagination + search toàn cục (hoặc rõ ràng "trang hiện tại"); error-state khu C.
- S8 hạ tầng: nginx client_max_body_size + limit_req/limit_conn + security headers; compose log rotation + limits; upload guard size/threadpool; response_wrapper/sse/uploads không lộ str(e); Dockerfile non-root.

## Verify tổng cuối mỗi wave (session chính)
- Backend: `cd finext-fastapi && PYTHONUTF8=1 uv run pytest -q` (kiểm ${PIPESTATUS[0]}).
- FE: `cd finext-nextjs && npx tsc --noEmit` + `node --test` cho file test mới.
- Kiểm chứng ngược mỗi fix trọng yếu (gỡ fix → test đỏ → khôi phục).
