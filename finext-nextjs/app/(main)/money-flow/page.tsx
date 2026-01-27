import type { Metadata } from 'next';
import PageContent from './PageContent';

// Route Segment Config - Static page có thể cache
export const revalidate = 3600;
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Dòng tiền',
  description: 'Theo dõi dòng vốn thông minh và diễn biến thanh khoản thị trường theo thời gian thực.',
  openGraph: {
    title: 'Dòng tiền | Finext',
    description: 'Theo dấu dòng vốn thông minh và thanh khoản thị trường.',
  },
};

export default function MoneyFlowPage() {
  return <PageContent />;
}
