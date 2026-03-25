import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Các gói thành viên',
  description: 'Khám phá các gói thành viên Finext — mở khóa toàn bộ dữ liệu phân tích chuyên sâu, tín hiệu giao dịch và tính năng nâng cao.',
  openGraph: {
    title: 'Các gói thành viên | Finext',
    description: 'Khám phá các gói thành viên Finext — mở khóa toàn bộ dữ liệu phân tích và tính năng nâng cao.',
  },
};

export default function PlansPage() {
  return <PageContent />;
}
