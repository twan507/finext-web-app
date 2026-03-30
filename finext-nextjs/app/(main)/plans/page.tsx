import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Ủng hộ Finext',
  description: 'Ủng hộ dự án Finext — đồng hành cùng đội ngũ phát triển và nhận quyền truy cập toàn bộ tính năng nâng cao.',
  openGraph: {
    title: 'Ủng hộ Finext | Support Us',
    description: 'Ủng hộ dự án Finext — đồng hành cùng đội ngũ phát triển và nhận quyền truy cập tính năng nâng cao.',
  },
};

export default function PlansPage() {
  return <PageContent />;
}
