import LayoutContent from './LayoutContent';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <LayoutContent>{children}</LayoutContent>;
}
