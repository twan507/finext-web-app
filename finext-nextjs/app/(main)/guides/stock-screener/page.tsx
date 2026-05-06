import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Hướng dẫn bộ lọc cổ phiếu',
  description: 'Hướng dẫn từng bước cách sử dụng bộ lọc cổ phiếu trên Finext: thiết lập tiêu chí, kết hợp các điều kiện và lưu bộ lọc để tìm cơ hội đầu tư phù hợp.',
  keywords: ['hướng dẫn bộ lọc cổ phiếu', 'cách lọc cổ phiếu', 'tìm cổ phiếu tốt', 'cách dùng Finext'],
  openGraph: {
    title: 'Hướng dẫn bộ lọc cổ phiếu | Finext',
    description: 'Hướng dẫn từng bước cách sử dụng bộ lọc cổ phiếu trên Finext: thiết lập tiêu chí, kết hợp điều kiện và lưu bộ lọc để tìm cơ hội đầu tư.',
  },
};

export default function GuidesStockScreenerPage() {
  return <PageContent />;
}
