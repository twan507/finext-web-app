import type { Metadata } from 'next';
import LayoutContent from './LayoutContent';

export const metadata: Metadata = {
  title: {
    template: 'Admin - %s',
    default: 'Admin',
  },
  // Khu quản trị riêng tư — chặn index (kế thừa xuống mọi trang /admin/*)
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <LayoutContent>{children}</LayoutContent>;
}
