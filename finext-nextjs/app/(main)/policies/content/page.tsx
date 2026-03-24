import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Chính sách nội dung',
  description: 'Quy định về nội dung được đăng tải và chia sẻ trên nền tảng.',
};

export default function ContentPolicyPage() {
  return <PageContent />;
}
