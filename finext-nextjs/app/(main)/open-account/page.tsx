import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Mở tài khoản chứng khoán',
  description: 'Mở tài khoản chứng khoán liên kết Finext — nhận trọn bộ quyền lợi vĩnh viễn: tính năng nâng cao, hỗ trợ từ đội ngũ Finext, nhóm cộng đồng riêng và báo cáo chiến lược định kỳ.',
  keywords: ['mở tài khoản chứng khoán', 'tài khoản chứng khoán liên kết', 'đăng ký chứng khoán', 'tài khoản miễn phí Finext', 'ưu đãi mở tài khoản'],
  openGraph: {
    title: 'Mở tài khoản chứng khoán | Finext',
    description: 'Mở tài khoản chứng khoán liên kết Finext — nhận trọn bộ quyền lợi vĩnh viễn: tính năng nâng cao, hỗ trợ từ đội ngũ và báo cáo chiến lược định kỳ.',
  },
};

export default function OpenAccountPage() {
  return <PageContent />;
}
