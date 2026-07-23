// Dựng ngữ cảnh trang cho chế độ Tư vấn Danh mục (/portfolio): nhồi watchlist đang chọn + giai đoạn
// thị trường vào page_context (backend chèn thành system block). KHÔNG hiển thị cho user.
// Đây là SEAM tối ưu chính về sau (thêm badge trùng rổ, tỷ trọng, intensity...).

export const PORTFOLIO_MAX = 2000; // khớp ràng buộc page_context của backend (schema chat)

export interface PortfolioContextInput {
  name: string;
  symbols: string[];
  phaseLabel?: string;
  exposureHint?: string;
}

/** Chuỗi ngữ cảnh gọn cho AI: tên danh mục + mã (viết HOA) + giai đoạn thị trường (nếu có). */
export function buildPortfolioContext({ name, symbols, phaseLabel, exposureHint }: PortfolioContextInput): string {
  const tickers = symbols.map((s) => s.trim().toUpperCase()).filter(Boolean).join(', ');
  let ctx = `Danh mục đang tư vấn: "${name}". Mã đang theo dõi: ${tickers}.`;
  if (phaseLabel) {
    const exp = exposureHint ? ` (hệ gợi ý nắm ~${exposureHint})` : '';
    ctx += ` Giai đoạn thị trường hiện tại: ${phaseLabel}${exp}.`;
  }
  ctx += ' Chỉ tư vấn các mã trong danh mục này, theo khung điều kiện.';
  return ctx.length <= PORTFOLIO_MAX ? ctx : ctx.slice(0, PORTFOLIO_MAX);
}
