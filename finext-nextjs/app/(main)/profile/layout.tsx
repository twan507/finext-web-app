import type { Metadata } from 'next';
import LayoutContent from './LayoutContent';

export const metadata: Metadata = {
  title: {
    template: '%s | Finext',
    default: 'Hồ sơ | Finext',
  },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <LayoutContent>{children}</LayoutContent>;
}

