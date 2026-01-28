// finext-nextjs/app/(main)/news/[articleId]/page.tsx
import type { Metadata } from 'next';
import PageContent from './PageContent';

interface Props {
    params: Promise<{ articleId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { articleId } = await params;
    
    return {
        title: 'Chi tiết bài viết',
        description: 'Xem chi tiết bài viết tin tức tài chính',
        openGraph: {
            title: 'Chi tiết bài viết | Finext',
            description: 'Xem chi tiết bài viết tin tức tài chính',
        },
    };
}

export default async function NewsDetailPage({ params }: Props) {
    const { articleId } = await params;
    return <PageContent articleId={articleId} />;
}
