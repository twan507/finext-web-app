import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Tư vấn danh mục',
  description: 'Tư vấn danh mục đầu tư cùng Finext AI, theo giai đoạn thị trường và phương pháp dòng tiền.',
  robots: { index: false, follow: false },
};

export default function PortfolioPage() {
  return <PageContent />;
}
