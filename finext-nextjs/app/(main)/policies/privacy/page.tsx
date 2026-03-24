import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Chính sách bảo mật',
  description: 'Cam kết bảo vệ thông tin cá nhân và dữ liệu người dùng.',
};

export default function PrivacyPolicyPage() {
  return <PageContent />;
}
