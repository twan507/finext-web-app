import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Hướng dẫn biểu đồ & danh sách theo dõi',
  description: 'Hướng dẫn cách đọc biểu đồ kỹ thuật, sử dụng các công cụ vẽ, chỉ báo phân tích và quản lý danh sách theo dõi cổ phiếu yêu thích trên Finext.',
  keywords: ['hướng dẫn biểu đồ', 'biểu đồ kỹ thuật', 'danh sách theo dõi', 'watchlist', 'chỉ báo kỹ thuật', 'cách dùng Finext'],
  openGraph: {
    title: 'Hướng dẫn biểu đồ & danh sách theo dõi | Finext',
    description: 'Hướng dẫn đọc biểu đồ kỹ thuật, sử dụng công cụ vẽ, chỉ báo phân tích và quản lý danh sách theo dõi cổ phiếu yêu thích trên Finext.',
  },
};

export default function GuidesChartsWatchlistPage() {
  return <PageContent />;
}
