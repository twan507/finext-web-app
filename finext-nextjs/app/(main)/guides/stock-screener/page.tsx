import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Hướng dẫn bộ lọc cổ phiếu',
  description: 'Hướng dẫn sử dụng bộ lọc cổ phiếu (screener) để tìm cơ hội đầu tư phù hợp.',
  openGraph: {
    title: 'Hướng dẫn bộ lọc cổ phiếu | Finext',
    description: 'Hướng dẫn sử dụng bộ lọc cổ phiếu (screener) để tìm cơ hội đầu tư phù hợp.',
  },
};

export default function GuidesStockScreenerPage() {
  return <PageContent />;
}
