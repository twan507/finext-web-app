// finext-nextjs/app/(main)/news/[articleId]/page.tsx
import type { Metadata } from 'next';
import PageContent from './PageContent';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://localhost';

interface Props {
    params: Promise<{ articleId: string }>;
}

/** Response type từ news_daily_meta API */
interface ArticleMetaResponse {
    status: number;
    message: string;
    data: {
        item: {
            article_id: string;
            title: string;
            sapo?: string;
            created_at: string;
            news_type: string;
            category_name: string;
            source?: string;
        } | null;
    };
}

/**
 * Fetch metadata cho article theo slug
 * Sử dụng keyword news_daily_meta - chỉ lấy fields cần thiết
 */
async function fetchArticleMeta(slug: string): Promise<ArticleMetaResponse['data']['item']> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/v1/sse/rest/news_daily_meta?slug=${encodeURIComponent(slug)}`,
            {
                next: { revalidate: 300 }, // Cache 5 phút
                headers: { 'Content-Type': 'application/json' },
            }
        );

        if (!response.ok) return null;

        const data: ArticleMetaResponse = await response.json();
        return data.data?.item || null;
    } catch (error) {
        console.error('[generateMetadata] Fetch error:', error);
        return null;
    }
}

/**
 * Generate dynamic metadata cho SEO và social sharing (Zalo, Facebook, etc.)
 * - Title: tiêu đề bài viết (1 dòng)
 * - Description: sapo (2 dòng mô tả)
 * - Site: finext.vn
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { articleId } = await params;
    const article = await fetchArticleMeta(articleId);

    // Fallback nếu không tìm thấy article
    if (!article) {
        return {
            title: 'Chi tiết bài viết',
            description: 'Xem chi tiết bài viết tin tức tài chính từ Finext.',
            openGraph: {
                title: 'Chi tiết bài viết | Finext',
                description: 'Xem chi tiết bài viết tin tức tài chính từ Finext.',
                siteName: 'Finext',
                url: 'https://finext.vn',
                type: 'article',
                locale: 'vi_VN',
            },
        };
    }

    // Lấy title và sapo từ article
    const title = article.title || 'Chi tiết bài viết';
    // Sapo: giới hạn ~160 ký tự cho description (2 dòng)
    const description = article.sapo
        ? article.sapo.length > 160
            ? article.sapo.substring(0, 157) + '...'
            : article.sapo
        : `Xem chi tiết tin tức: ${title}`;

    const url = `https://finext.vn/news/${articleId}`;

    return {
        title: title,
        description: description,
        // Open Graph cho Facebook, Zalo, và các nền tảng khác
        openGraph: {
            title: title,
            description: description,
            url: url,
            siteName: 'Finext',
            type: 'article',
            locale: 'vi_VN',
            publishedTime: article.created_at,
        },
        // Twitter Card
        twitter: {
            card: 'summary',
            title: title,
            description: description,
        },
        // Canonical URL
        alternates: {
            canonical: url,
        },
        // Robots
        robots: {
            index: true,
            follow: true,
        },
    };
}

export default async function NewsDetailPage({ params }: Props) {
    const { articleId } = await params;
    return <PageContent articleId={articleId} />;
}
