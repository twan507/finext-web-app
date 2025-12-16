import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Thị trường',
};

export default function MarketsPage() {
  return <PageContent />;
}
