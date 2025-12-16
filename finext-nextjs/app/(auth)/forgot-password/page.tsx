import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Quên mật khẩu',
};

export default function ForgotPasswordPage() {
  return <PageContent />;
}

