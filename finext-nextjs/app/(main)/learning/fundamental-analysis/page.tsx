import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Phân tích cơ bản',
  description: 'Tìm hiểu cách đánh giá doanh nghiệp qua báo cáo tài chính và chỉ số cơ bản.',
};

export default function FundamentalAnalysisPage() {
  return <PageContent />;
}
