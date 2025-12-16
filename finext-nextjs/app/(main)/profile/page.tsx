import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Hồ sơ',
};

export default function ProfileRootPage() {
  // Tự động chuyển hướng đến trang thông tin cơ bản
  redirect('/profile/information');
}