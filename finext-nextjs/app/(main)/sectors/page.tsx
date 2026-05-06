import type { Metadata } from 'next';
import PageContent from './PageContent';

// Route Segment Config - Static page có thể cache
export const revalidate = 3600;
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Ngành nghề',
  description: 'Theo dõi sức mạnh và dòng tiền của 25+ nhóm ngành trên thị trường chứng khoán Việt Nam: ngân hàng, chứng khoán, bất động sản, thép, dầu khí, công nghệ và nhiều ngành khác.',
  keywords: ['nhóm ngành', 'ngành nghề chứng khoán', 'sức mạnh ngành', 'dòng tiền ngành', 'ngân hàng', 'bất động sản', 'thép', 'dầu khí', 'sector rotation'],
  openGraph: {
    title: 'Ngành nghề | Finext',
    description: 'Sức mạnh và dòng tiền của các nhóm ngành trên thị trường chứng khoán Việt Nam: ngân hàng, bất động sản, thép, dầu khí, công nghệ và nhiều ngành khác.',
  },
};

export default function GroupsPage() {
  return <PageContent />;
}
