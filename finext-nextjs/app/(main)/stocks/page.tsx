import type { Metadata } from 'next';
import PageContent from './PageContent';


export const metadata: Metadata = {
  title: 'Cổ phiếu - Bộ lọc thông minh',
  description: 'Hệ thống sàng lọc đa chiều kết hợp phân tích kỹ thuật và cơ bản, hỗ trợ tìm kiếm cơ hội đầu tư.',
  openGraph: {
    title: 'Cổ phiếu - Bộ lọc thông minh | Finext',
    description: 'Hệ thống sàng lọc đa chiều kết hợp phân tích kỹ thuật và cơ bản, hỗ trợ tìm kiếm cơ hội đầu tư.',
  },
};

export default function StocksPage() {
  return <PageContent />;
}
