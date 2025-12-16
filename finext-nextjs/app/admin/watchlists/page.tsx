import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Watchlists',
};

export default function WatchlistsPage() {
  return <PageContent />;
}

