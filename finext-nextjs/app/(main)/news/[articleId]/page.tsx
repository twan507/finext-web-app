// finext-nextjs/app/(main)/news/[articleId]/page.tsx
import type { Metadata } from 'next';
import PageContent from './PageContent';
import { fetchArticleBySlug } from '../serverFetch';

interface Props {
    params: Promise<{ articleId: string }>;
}

// Dynamic metadata — server-side, cached 5 phút (revalidate: 300 trong fetchArticleBySlug).
// Không ảnh hưởng tốc độ load phía client vì chỉ chạy trên server lúc render HTML.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { articleId } = await params;
    const article = await fetchArticleBySlug(articleId);

    // Fallback nếu bài viết không tồn tại hoặc API lỗi
    if (!article) {
        return {
            title: 'Tin tức',
            description: 'Cập nhật tin tức tài chính và thị trường chứng khoán Việt Nam.',
        };
    }

    // Truncate sapo cho description (tối đa 160 ký tự cho SEO)
    const description = article.sapo
        ? article.sapo.length > 160
            ? article.sapo.substring(0, 157) + '...'
            : article.sapo
        : 'Cập nhật tin tức tài chính và thị trường chứng khoán Việt Nam.';

    return {
        title: article.title,
        description,
        openGraph: {
            title: article.title,
            description,
            type: 'article',
            locale: 'vi_VN',
            siteName: 'Finext',
            url: `https://finext.vn/news/${articleId}`,
            images: [
                {
                    url: 'https://finext.vn/finext-panel.png',
                    width: 1200,
                    height: 630,
                    alt: 'Finext - Nền tảng phân tích chứng khoán thông minh',
                },
            ],
        },
        twitter: {
            card: 'summary',
            title: article.title,
            description,
        },
    };
}

export default async function NewsDetailPage({ params }: Props) {
    const { articleId } = await params;
    return <PageContent articleId={articleId} />;
}
