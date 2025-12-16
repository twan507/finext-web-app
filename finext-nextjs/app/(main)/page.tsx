import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
    title: 'Trang chủ',
};

export default function HomePage() {
    return <PageContent />;
}
