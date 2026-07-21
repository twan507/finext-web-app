# Specs & Plans — Cách Đọc

Thư mục này lưu **hồ sơ thiết kế và kế hoạch triển khai theo thời điểm**. Nội dung trong một spec/plan mô tả quyết định, giả định, branch, model, route và số test tại ngày ghi trên tên file; nó không tự động trở thành tài liệu trạng thái hiện tại.

## Thứ Tự Nguồn Sự Thật

Khi một file ở đây khác code:

1. Ưu tiên code/config tại HEAD.
2. Dùng **docs/architecture/** cho kiến trúc web hiện hành.
3. Dùng **docs/finext_agent/00-web-roadmap.md** và runtime KB cho Finext AI.
4. Quay lại spec/plan ở đây để hiểu **vì sao** một quyết định được đưa ra và lịch sử triển khai.

Không sửa lại các bước lịch sử chỉ để làm chúng giống code mới; thay vào đó, thêm banner trạng thái ở đầu file nếu thiết kế đã bị gác, thay thế hoặc triển khai xong theo hướng khác.

## Các Trạng Thái Dễ Nhầm

| Nhóm tài liệu | Trạng thái hiện tại |
|---|---|
| Watchlist drag/drop, admin RBAC, chọn kỳ tài chính, guide pages, featured stocks | Đã triển khai; code hiện tại là nguồn thật. |
| Compliance pivot 2026-05-07 | Đã **rollback một phần** ngày 2026-07-21: Google OAuth và đăng ký OTP tự xác thực đã bật lại. Xem **docs/architecture/06-compliance-pivot.md**. |
| SePay auto-payment | **Đã gác, chưa triển khai**. Thanh toán hiện xác nhận thủ công. |
| Route market phase cũ | Route hiện tại là **/phase**; mọi **/market-phase** trong tài liệu cũ chỉ là tên lịch sử. |
| Agent v1, Knowledge Pack, chat FE, persistence/quota, chat bubble, db_stats, answer sanitizer, Anthropic adapter | Đã triển khai và tiếp tục được mở rộng sau spec gốc. |
| DeepSeek V4 migration/thinking | Là lịch sử thử nghiệm provider. Runtime hiện chọn provider/model qua env; **LLM_THINKING** mặc định **disabled**. |
| Widget tham chiếu chống bịa số | Đã gác sau khi đo được nguyên nhân gốc là cắt tool result. Xem **docs/finext_agent/10-widget-tham-chieu-chong-bia-so.md**. |
| Hardening 2026-07-20 | Đã được tích hợp vào code hiện tại; số test/branch trong plan là snapshot lịch sử. |

## Quy Ước Banner

- **HISTORICAL — IMPLEMENTED**: thiết kế đã được triển khai nhưng code đã tiến xa hơn.
- **SUPERSEDED**: quyết định hoặc giả định chính đã được tài liệu/code mới thay thế.
- **CANCELLED**: không triển khai; không dùng làm work order.
