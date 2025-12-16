import type { Metadata } from 'next';
import LayoutContent from './LayoutContent';

export const metadata: Metadata = {
  title: {
    template: '%s | Finext',
    default: 'Trang chủ | Finext',
  },
};

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <LayoutContent>{children}</LayoutContent>;
}
