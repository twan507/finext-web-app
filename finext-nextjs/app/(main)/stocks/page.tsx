import type { Metadata } from 'next';
import PageContent from './PageContent';


export const metadata: Metadata = {
  title: 'Bộ lọc thông minh',
  description: 'Sàng lọc cổ phiếu theo hàng chục tiêu chí: phân tích kỹ thuật (RSI, MACD, MA), phân tích cơ bản (P/E, P/B, ROE), thanh khoản và tăng trưởng — tìm cơ hội đầu tư trên thị trường Việt Nam.',
  keywords: ['bộ lọc cổ phiếu', 'stock screener', 'sàng lọc cổ phiếu', 'phân tích kỹ thuật', 'phân tích cơ bản', 'P/E', 'P/B', 'RSI', 'MACD', 'tìm cổ phiếu tốt'],
  openGraph: {
    title: 'Bộ lọc thông minh | Finext',
    description: 'Sàng lọc cổ phiếu Việt Nam theo hàng chục tiêu chí: phân tích kỹ thuật, cơ bản, thanh khoản và tăng trưởng — tìm cơ hội đầu tư hiệu quả.',
  },
};

export default function StocksPage() {
  return <PageContent />;
}
