import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Phân tích cổ phiếu',
};

export default function StockAnalysisPage() {
  return <PageContent />;
}
