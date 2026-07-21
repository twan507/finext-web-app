// Logic thuần cho "chat chạy nền + hàng đợi" — tách khỏi React để test bằng node:test.
// BE: khi FE rời trang giữa lúc trả lời, turn vẫn chạy nền tới hết + ghi DB; FE quay lại chỉ đọc DB.

/** Thông báo thân thiện khi hàng đợi đầy (khớp detail 429 backend trả về). */
export const BUSY_NOTICE = 'Đang bận, thử lại sau.';

/** Nhịp poll DB (ms) khi đang chờ turn nền trả lời. */
export const POLL_MS = 2500;

/** Số lần poll tối đa trước khi bỏ cuộc — tránh poll vô hạn nếu turn nền lỗi/không ghi được DB. */
export const MAX_POLLS = 120; // ~5 phút ở nhịp 2.5s, đủ cho turn dài có tra cứu

type RoleOnly = { role: 'user' | 'assistant' };

/**
 * Turn đang chạy nền? = tin nhắn CUỐI của hội thoại là của user và CHƯA có assistant trả lời sau nó.
 * Dùng cho: (a) mở /chat/{id} phát hiện cần hiện "đang suy nghĩ" + poll; (b) khi poll, biết reply về chưa
 * (reply đã ghi DB ⇔ tin cuối không còn là user).
 */
export function isTurnPending(messages: RoleOnly[]): boolean {
  const last = messages[messages.length - 1];
  return !!last && last.role === 'user';
}
