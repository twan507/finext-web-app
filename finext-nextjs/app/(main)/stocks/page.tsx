import type { Metadata } from 'next';
import PageContent from './PageContent';

// Route Segment Config - Static page có thể cache
export const revalidate = 3600;
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Cổ phiếu',
  description: 'Sàng lọc cơ hội đầu tư với bộ tiêu chí kỹ thuật và cơ bản chuyên sâu.',
  openGraph: {
    title: 'Cổ phiếu | Finext',
    description: 'Sàng lọc cổ phiếu với tiêu chí kỹ thuật và cơ bản.',
  },
};

export default function StocksPage() {
  return <PageContent />;
}
