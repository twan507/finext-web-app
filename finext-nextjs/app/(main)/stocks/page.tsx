import type { Metadata } from 'next';
import PageContent from './PageContent';


export const metadata: Metadata = {
  title: 'Cổ phiếu - Bộ lọc thông minh',
  description: 'Hệ thống sàng lọc đa chiều kết hợp phân tích kỹ thuật và cơ bản, hỗ trợ tìm kiếm cơ hội đầu tư.',
  openGraph: {
    title: 'Finext - Bộ lọc cổ phiếu',
    description: 'Sàng lọc cơ hội đầu tư với bộ tiêu chí kỹ thuật và cơ bản.',
  },
};

export default function StocksPage() {
  return <PageContent />;
}
