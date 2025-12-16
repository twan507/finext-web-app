import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Thông tin cá nhân',
};

export default function InformationPage() {
  return <PageContent />;
}

