// Tiêu đề + placeholder cho trang Tư vấn Danh mục — chuyên nghiệp, tuân compliance A (không "nên mua/bán").
// (Không dùng kho gợi ý câu hỏi tĩnh ở đây: bối cảnh tư vấn danh mục khác chat thường.)

// Tiêu đề (H1) — chèn tên user (nếu có) trước dấu "?".
export const portfolioTitle = (name?: string): string => {
  const who = name?.trim() ? `, ${name.trim()}` : '';
  return `Danh mục của bạn hôm nay thế nào${who}?`;
};

// Placeholder ô chat (đã gộp lời dẫn vào đây): desktop đầy đủ + bản ngắn cho mobile (tránh wrap).
export const PORTFOLIO_PLACEHOLDER = 'Hãy chọn một danh mục ở cột bên trái và hỏi về chiến lược giao dịch trong giai đoạn hiện tại';
export const PORTFOLIO_PLACEHOLDER_MOBILE = 'Chọn danh mục rồi hỏi về chiến lược giao dịch…';
