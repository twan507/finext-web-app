import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
    title: 'Tin tức thị trường',
    description: 'Cập nhật tin tức thị trường tài chính và các sự kiện nổi bật theo thời gian thực.',
    openGraph: {
        title: 'Tin tức thị trường | Finext',
        description: 'Cập nhật tin tức thị trường tài chính và các sự kiện nổi bật theo thời gian thực.',
    },
};

export default function NewsPage() {
    return <PageContent />;
}
