import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Đặt lịch trao đổi',
  description: 'Đặt lịch trao đổi 1-1 với đội ngũ Finext về phân tích và dữ liệu chứng khoán.',
  openGraph: {
    title: 'Đặt lịch trao đổi | Finext',
    description: 'Đặt lịch trao đổi 1-1 với đội ngũ Finext về phân tích và dữ liệu chứng khoán.',
  },
};

export default function ConsultationPage() {
  return <PageContent />;
}
