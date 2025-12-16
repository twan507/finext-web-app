import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Cổ phiếu',
};

export default function StocksPage() {
  return <PageContent />;
}
