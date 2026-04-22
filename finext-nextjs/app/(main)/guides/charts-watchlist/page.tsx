import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Hướng dẫn biểu đồ & Watchlist',
  description: 'Hướng dẫn sử dụng biểu đồ phân tích và quản lý Watchlist trên Finext.',
  openGraph: {
    title: 'Hướng dẫn biểu đồ & Watchlist | Finext',
    description: 'Hướng dẫn sử dụng biểu đồ phân tích và quản lý Watchlist trên Finext.',
  },
};

export default function GuidesChartsWatchlistPage() {
  return <PageContent />;
}
