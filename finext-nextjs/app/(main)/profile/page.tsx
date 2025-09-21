import { redirect } from 'next/navigation';

export default function ProfileRootPage() {
  // Tự động chuyển hướng đến trang thông tin cơ bản
  redirect('/profile/information');
}