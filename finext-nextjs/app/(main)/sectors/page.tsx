import type { Metadata } from 'next';
import PageContent from './PageContent';

// Route Segment Config - Static page có thể cache
export const revalidate = 3600;
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Ngành nghề',
  description: 'Tổng quan sức mạnh và phân bổ dòng tiền nhóm ngành trên thị trường chứng khoán.',
  openGraph: {
    title: 'Ngành nghề | Finext',
    description: 'Tổng quan sức mạnh và phân bổ dòng tiền nhóm ngành trên thị trường chứng khoán.',
  },
};

export default function GroupsPage() {
  return <PageContent />;
}
