import type { Metadata } from 'next';
import LayoutContent from './LayoutContent';

export const metadata: Metadata = {
  title: {
    template: '%s | Finext',
    default: 'Xác thực | Finext',
  },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <LayoutContent>{children}</LayoutContent>;
}

