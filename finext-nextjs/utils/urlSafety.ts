// Chống open redirect: callbackUrl lấy từ query string là input do kẻ tấn công
// kiểm soát. Một link dạng ?callbackUrl=https://evil.com sẽ đẩy user sang site
// giả mạo sau khi đăng nhập. Hàm này chỉ chấp nhận đường dẫn điều hướng nội bộ
// (same-origin) và trả về '/' cho mọi input không hợp lệ.

const SAFE_FALLBACK = '/';

export function sanitizeInternalPath(raw: string | null | undefined): string {
    if (!raw) return SAFE_FALLBACK;

    const value = raw.trim();
    if (value === '') return SAFE_FALLBACK;

    // Phải là đường dẫn tuyệt đối nội bộ: bắt đầu bằng đúng một '/'.
    // Loại absolute URL (https://...), scheme (javascript:, mailto:) vì chúng không bắt đầu bằng '/'.
    if (value[0] !== '/') return SAFE_FALLBACK;

    // Chặn protocol-relative '//evil.com' — trình duyệt coi là absolute cross-origin.
    if (value[1] === '/') return SAFE_FALLBACK;

    // Chặn thủ thuật backslash: trình duyệt chuẩn hóa '\' thành '/', nên '/\evil.com' → '//evil.com'.
    // Đường dẫn nội bộ hợp lệ không bao giờ chứa backslash.
    if (value.includes('\\')) return SAFE_FALLBACK;

    // Chặn scheme lọt vào chuỗi (phòng hờ '/...://...').
    if (value.includes('://')) return SAFE_FALLBACK;

    // Chặn ký tự điều khiển (\t \n \r ...) bị trình duyệt lọc bỏ, có thể tạo '//' sau khi lọc.
    if (/[\x00-\x1f]/.test(value)) return SAFE_FALLBACK;

    return value;
}
