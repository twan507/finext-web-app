import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Đặt lịch tư vấn cá nhân',
  description: 'Đặt lịch hẹn tư vấn 1-1 với chuyên gia tài chính của Finext.',
};

export default function ConsultationPage() {
  return <PageContent />;
}
