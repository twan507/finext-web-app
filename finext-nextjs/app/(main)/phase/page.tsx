import type { Metadata } from 'next';
import { Suspense } from 'react';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Giai đoạn thị trường',
  description:
    'Giai đoạn thị trường chứng khoán Việt Nam: đèn tín hiệu pha thị trường, tỷ trọng nắm giữ gợi ý, cường độ và hiệu suất danh mục — cập nhật cuối phiên.',
  openGraph: {
    title: 'Giai đoạn thị trường | Finext',
    description: 'Đèn tín hiệu giai đoạn thị trường, tỷ trọng nắm giữ gợi ý và hiệu suất danh mục.',
  },
};

export default function MarketPhasePage() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
