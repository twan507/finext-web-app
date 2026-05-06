import type { Metadata } from 'next';
import { Suspense } from 'react';
import PageContent from './PageContent';


export const metadata: Metadata = {
  title: 'Thị trường',
  description: 'Tổng quan thị trường chứng khoán Việt Nam: VN-Index, VN30, HNX-Index, dòng tiền, biến động, định giá và chu kỳ thị trường — cập nhật theo thời gian thực.',
  keywords: ['thị trường chứng khoán', 'VN-Index', 'VN30', 'HNX-Index', 'UPCOM', 'dòng tiền thị trường', 'biến động thị trường', 'chu kỳ thị trường', 'định giá thị trường'],
  openGraph: {
    title: 'Thị trường | Finext',
    description: 'Tổng quan thị trường chứng khoán Việt Nam: VN-Index, VN30, dòng tiền, biến động và định giá thị trường — cập nhật theo thời gian thực.',
  },
};

export default function MarketsPage() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
