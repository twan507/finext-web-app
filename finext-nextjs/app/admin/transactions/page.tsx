import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Transactions',
};

export default function TransactionsPage() {
  return <PageContent />;
}

