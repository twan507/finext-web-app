import type { Metadata } from 'next';
import PageContent from './PageContent';

// Route Segment Config - Static page có thể cache
export const revalidate = 3600;
export const dynamic = 'force-static';

export const metadata: Metadata = {
    title: 'Tin tức',
    description: 'Cập nhật tin tức thị trường tài chính và các sự kiện nổi bật theo thời gian thực.',
    openGraph: {
        title: 'Tin tức | Finext',
        description: 'Tin tức thị trường tài chính và các sự kiện nổi bật.',
    },
};

export default function NewsPage() {
    return <PageContent />;
}
