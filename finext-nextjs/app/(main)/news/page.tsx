import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
    title: 'Tin tức',
    description: 'Cập nhật tin tức thị trường tài chính và các sự kiện nổi bật theo thời gian thực.',
    openGraph: {
        title: 'Finext - Tin tức',
        description: 'Tin tức thị trường tài chính và các sự kiện nổi bật.',
    },
};

export default function NewsPage() {
    return <PageContent />;
}
