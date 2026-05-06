import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Nhóm cổ phiếu',
  description: 'Phân loại cổ phiếu theo nhóm vốn hóa, mức độ thanh khoản, mức độ biến động và đặc điểm thị trường — hỗ trợ nhà đầu tư xây dựng danh mục phù hợp.',
  keywords: ['nhóm cổ phiếu', 'VN30', 'HNX30', 'penny', 'mid cap', 'large cap', 'thanh khoản', 'phân loại cổ phiếu'],
  openGraph: {
    title: 'Nhóm cổ phiếu | Finext',
    description: 'Phân loại cổ phiếu theo nhóm vốn hóa, thanh khoản và đặc điểm thị trường. Hỗ trợ nhà đầu tư xây dựng danh mục phù hợp.',
  },
};

export default function GroupsPage() {
  return <PageContent />;
}
