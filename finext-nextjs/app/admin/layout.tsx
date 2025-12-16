import type { Metadata } from 'next';
import LayoutContent from './LayoutContent';

export const metadata: Metadata = {
  title: {
    template: 'Admin | %s | Finext',
    default: 'Admin | Finext',
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <LayoutContent>{children}</LayoutContent>;
}
