import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Dòng tiền',
};

export default function MoneyFlowPage() {
  return <PageContent />;
}
