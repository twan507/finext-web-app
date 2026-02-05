// finext-nextjs/app/(main)/news/[articleId]/page.tsx
import type { Metadata } from 'next';
import PageContent from './PageContent';

interface Props {
    params: Promise<{ articleId: string }>;
}

// Base URL cho metadata
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://finext.vn';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.finext.vn';

// Fetch article từ API để generate metadata
async function fetchArticleForMetadata(articleSlug: string) {
    try {
        const response = await fetch(
            `${API_URL}/api/v1/sse/rest/news_article?article_slug=${encodeURIComponent(articleSlug)}`,
            {
                next: { revalidate: 60 }, // Cache 60 giây
            }
        );

        if (!response.ok) {
            return null;
        }

        const result = await response.json();
        return result.data?.article || null;
    } catch (error) {
        console.error('[generateMetadata] Failed to fetch article:', error);
        return null;
    }
}

// Dynamic metadata generation cho SEO và social sharing
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { articleId } = await params;
    const article = await fetchArticleForMetadata(articleId);

    // Fallback nếu không tìm thấy bài viết
    if (!article) {
        return {
            title: 'Tin tức | Finext',
            description: 'Xem chi tiết bài viết tin tức tài chính.',
        };
    }

    // Truncate sapo cho description (tối đa 160 ký tự)
    const description = article.sapo
        ? article.sapo.length > 160
            ? article.sapo.substring(0, 157) + '...'
            : article.sapo
        : 'Tin tức tài chính từ Finext';

    const articleUrl = `${BASE_URL}/news/${articleId}`;

    return {
        title: article.title,
        description: description,

        // Open Graph - cho Facebook, Zalo, Messenger, etc.
        openGraph: {
            title: article.title,
            description: description,
            url: articleUrl,
            siteName: 'finext.vn',
            type: 'article',
            locale: 'vi_VN',
            // Không có image vì tin tức không có ảnh
        },

        // Twitter Card
        twitter: {
            card: 'summary',
            title: article.title,
            description: description,
        },

        // Canonical URL
        alternates: {
            canonical: articleUrl,
        },
    };
}

export default async function NewsDetailPage({ params }: Props) {
    const { articleId } = await params;
    return <PageContent articleId={articleId} />;
}
