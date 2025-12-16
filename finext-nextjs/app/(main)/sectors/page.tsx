import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Nhóm ngành',
};

export default function SectorsPage() {
  return <PageContent />;
}
