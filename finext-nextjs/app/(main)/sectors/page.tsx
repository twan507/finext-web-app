import type { Metadata } from 'next';
import PageContent from './PageContent';

// Route Segment Config - Static page có thể cache
export const revalidate = 3600;
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Nhóm ngành',
  description: 'Đánh giá sức mạnh nhóm ngành và đón đầu sự luân chuyển dòng tiền giữa các sector.',
  openGraph: {
    title: 'Finext - Nhóm ngành',
    description: 'Phân tích sức mạnh nhóm ngành và luân chuyển dòng tiền.',
  },
};

export default function SectorsPage() {
  return <PageContent />;
}
