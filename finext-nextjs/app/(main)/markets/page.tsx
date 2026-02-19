import type { Metadata } from 'next';
import PageContent from './PageContent';


export const metadata: Metadata = {
  title: 'Thị trường',
  description: 'Tổng quan xu hướng, đánh giá rủi ro và xác định chu kỳ thị trường chứng khoán Việt Nam.',
  openGraph: {
    title: 'Finext - Thị trường',
    description: 'Tổng quan xu hướng, đánh giá rủi ro và xác định chu kỳ thị trường chứng khoán.',
  },
};

export default function MarketsPage() {
  return <PageContent />;
}
