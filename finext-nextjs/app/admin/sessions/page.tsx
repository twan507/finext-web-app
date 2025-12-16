import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Sessions',
};

export default function SessionsPage() {
  return <PageContent />;
}

