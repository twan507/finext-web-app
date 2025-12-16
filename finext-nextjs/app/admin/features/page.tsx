import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Features',
};

export default function FeaturesPage() {
  return <PageContent />;
}

