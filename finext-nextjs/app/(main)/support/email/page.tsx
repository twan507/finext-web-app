import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Gửi yêu cầu qua Email',
  description: 'Gửi câu hỏi hoặc yêu cầu hỗ trợ đến đội ngũ Finext.',
};

export default function EmailSupportPage() {
  return <PageContent />;
}
