import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Mở tài khoản chứng khoán',
  description: 'Mở tài khoản chứng khoán liên kết Finext — nhận trọn bộ quyền lợi vĩnh viễn: tính năng nâng cao, tư vấn chuyên gia, nhóm VIP và báo cáo chiến lược.',
  openGraph: {
    title: 'Mở tài khoản chứng khoán | Finext',
    description: 'Mở tài khoản chứng khoán liên kết Finext — nhận trọn bộ quyền lợi vĩnh viễn.',
  },
};

export default function OpenAccountPage() {
  return <PageContent />;
}
