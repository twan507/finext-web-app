import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Nhóm cổ phiếu',
  description: 'Tổng quan sức mạnh và phân bổ dòng tiền nhóm ngành trên thị trường chứng khoán.',
  openGraph: {
    title: 'Nhóm cổ phiếu | Finext',
    description: 'Tổng quan sức mạnh và phân bổ dòng tiền nhóm ngành trên thị trường chứng khoán.',
  },
};

export default function GroupsPage() {
  return <PageContent />;
}
