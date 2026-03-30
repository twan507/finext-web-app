import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Tuyên bố trách nhiệm',
  description: 'Thông tin miễn trừ trách nhiệm về nội dung và phân tích tham khảo trên Finext.',
  openGraph: {
    title: 'Tuyên bố trách nhiệm | Finext',
    description: 'Thông tin miễn trừ trách nhiệm về nội dung và phân tích tham khảo trên Finext.',
  },
};

export default function DisclaimerPage() {
  return <PageContent />;
}
