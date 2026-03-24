import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Danh sách theo dõi',
  description: 'Quản lý và theo dõi danh mục cổ phiếu yêu thích của bạn trên Finext.',
  robots: { index: false, follow: false },
};

export default function WatchlistPage() {
  return <PageContent />;
}
