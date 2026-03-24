import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Đăng nhập',
  description: 'Đăng nhập vào Finext để truy cập công cụ phân tích chứng khoán thông minh.',
  openGraph: {
    title: 'Đăng nhập | Finext',
    description: 'Đăng nhập vào Finext để truy cập công cụ phân tích chứng khoán thông minh.',
  },
};

export default function LoginPage() {
  return <PageContent />;
}

