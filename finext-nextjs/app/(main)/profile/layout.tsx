import type { Metadata } from 'next';
import LayoutContent from './LayoutContent';

// Khu tài khoản cá nhân riêng tư — chặn index (kế thừa xuống mọi trang /profile/*)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <LayoutContent>{children}</LayoutContent>;
}

