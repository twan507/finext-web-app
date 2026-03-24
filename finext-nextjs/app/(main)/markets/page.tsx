import type { Metadata } from 'next';
import { Suspense } from 'react';
import PageContent from './PageContent';


export const metadata: Metadata = {
  title: 'Thị trường',
  description: 'Tổng quan xu hướng, đánh giá rủi ro và xác định chu kỳ thị trường chứng khoán Việt Nam.',
  openGraph: {
    title: 'Thị trường | Finext',
    description: 'Tổng quan xu hướng, đánh giá rủi ro và xác định chu kỳ thị trường chứng khoán Việt Nam.',
  },
};

export default function MarketsPage() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
