import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Tổng quan tính năng',
  description: 'Hướng dẫn sử dụng các tính năng của Finext: tổng quan thị trường, sàng lọc cổ phiếu, biểu đồ kỹ thuật, danh sách theo dõi và đọc báo cáo phân tích.',
  keywords: ['hướng dẫn Finext', 'cách dùng Finext', 'tổng quan tính năng', 'hướng dẫn chứng khoán', 'cách phân tích cổ phiếu'],
  openGraph: {
    title: 'Tổng quan tính năng | Finext',
    description: 'Hướng dẫn sử dụng các tính năng của Finext: tổng quan thị trường, sàng lọc cổ phiếu, biểu đồ kỹ thuật và đọc báo cáo phân tích.',
  },
};

export default function GuidesOverviewPage() {
  return <PageContent />;
}
