import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Tổng quan Nhóm & Ngành',
  description: 'Tổng quan sức mạnh và phân bổ dòng tiền nhóm ngành trên thị trường chứng khoán.',
  openGraph: {
    title: 'Tổng quan Nhóm & Ngành | Finext',
    description: 'Tổng quan sức mạnh và phân bổ dòng tiền nhóm ngành trên thị trường chứng khoán.',
  },
};

export default function GroupsPage() {
  return <PageContent />;
}
