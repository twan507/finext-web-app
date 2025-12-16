import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Đăng nhập',
};

export default function LoginPage() {
  return <PageContent />;
}

