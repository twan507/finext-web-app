import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Danh sách theo dõi',
};

export default function WatchlistPage() {
  return <PageContent />;
}
