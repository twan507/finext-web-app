// finext-nextjs/app/(main)/news/[articleId]/page.tsx
import type { Metadata } from 'next';
import PageContent from './PageContent';

interface Props {
    params: Promise<{ articleId: string }>;
}

export const metadata: Metadata = {
    title: 'Tin tức',
    description: 'Xem chi tiết bài viết tin tức tài chính.',
};

export default async function NewsDetailPage({ params }: Props) {
    const { articleId } = await params;
    return <PageContent articleId={articleId} />;
}
