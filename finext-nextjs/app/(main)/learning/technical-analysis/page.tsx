import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Phân tích kỹ thuật',
  description: 'Học cách đọc biểu đồ, nhận diện xu hướng và các mô hình giá.',
  openGraph: {
    title: 'Phân tích kỹ thuật | Finext',
    description: 'Học cách đọc biểu đồ, nhận diện xu hướng và các mô hình giá.',
  },
};

export default function TechnicalAnalysisPage() {
  return <PageContent />;
}
