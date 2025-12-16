import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Users',
};

export default function UsersPage() {
  return <PageContent />;
}

