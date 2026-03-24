import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Quên mật khẩu',
  description: 'Khôi phục mật khẩu tài khoản Finext của bạn.',
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return <PageContent />;
}

