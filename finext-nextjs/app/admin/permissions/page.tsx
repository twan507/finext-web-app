import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Permissions',
};

export default function PermissionsPage() {
  return <PageContent />;
}

