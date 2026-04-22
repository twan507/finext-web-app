import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Tổng quan tính năng',
  description: 'Hướng dẫn xem và giải thích các tính năng trong các trang của Finext.',
  openGraph: {
    title: 'Tổng quan tính năng | Finext',
    description: 'Hướng dẫn xem và giải thích các tính năng trong các trang của Finext.',
  },
};

export default function GuidesOverviewPage() {
  return <PageContent />;
}
