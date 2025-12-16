import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Promotions',
};

export default function PromotionsPage() {
  return <PageContent />;
}

