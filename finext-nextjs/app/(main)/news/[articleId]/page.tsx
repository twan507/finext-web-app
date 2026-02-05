// finext-nextjs/app/(main)/news/[articleId]/page.tsx
import type { Metadata } from 'next';
import PageContent from './PageContent';

interface Props {
    params: Promise<{ articleId: string }>;
}

// Static metadata - không fetch API để tăng tốc độ load
export const metadata: Metadata = {
    title: 'Tin tức',
    description: 'Cập nhật tin tức tài chính và thị trường chứng khoán Việt Nam.',
    openGraph: {
        title: 'Finext - Tin tức',
        description: 'Cập nhật tin tức tài chính và thị trường chứng khoán Việt Nam.',
        siteName: 'Finext',
        type: 'article',
        locale: 'vi_VN',
        images: [
            {
                url: 'https://finext.vn/finext-icon-trans.png',
                width: 512,
                height: 512,
                alt: 'Finext',
            },
        ],
    },
};

export default async function NewsDetailPage({ params }: Props) {
    const { articleId } = await params;
    return <PageContent articleId={articleId} />;
}
