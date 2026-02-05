import type { Metadata } from 'next';
import PageContent from './PageContent';

// Route Segment Config - Static page có thể cache
export const revalidate = 3600; // Revalidate mỗi giờ
export const dynamic = 'force-static'; // Force static generation

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
