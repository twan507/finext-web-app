// finext-nextjs/app/(main)/news/serverFetch.ts
// Server-side fetch helpers cho generateMetadata và sitemap.
// Dùng native fetch (Next.js server) — KHÔNG dùng apiClient (client-only, cần session).
// Cache tự động bằng Next.js fetch cache với revalidate.

import { API_BASE_URL } from 'services/core/config';
import { NewsArticle } from './types';

// ============================================================================
// FETCH ARTICLE BY SLUG (cho generateMetadata)
// ============================================================================

// Response wrapping theo StandardApiResponse của backend:
// { status: 200, message: "...", data: { article: {...} } }
interface StandardApiResponse<T> {
    status: number;
    message?: string;
    data: T;
}

interface ArticleData {
    article: NewsArticle | null;
    error?: string;
}

/**
 * Fetch 1 bài viết theo slug — dùng cho generateMetadata (server-side only).
 * Cache 5 phút (revalidate: 300) để không gọi API lặp lại cho cùng bài viết.
 */
export async function fetchArticleBySlug(slug: string): Promise<NewsArticle | null> {
    try {
        const url = `${API_BASE_URL}/api/v1/sse/rest/news_article?article_slug=${encodeURIComponent(slug)}`;

        const res = await fetch(url, {
            next: { revalidate: 300 }, // Cache 5 phút
        });

        if (!res.ok) return null;

        const response: StandardApiResponse<ArticleData> = await res.json();
        return response.data?.article || null;
    } catch (error) {
        console.error('[serverFetch] fetchArticleBySlug failed:', error);
        return null;
    }
}

// ============================================================================
// FETCH NEWS LIST FOR SITEMAP
// ============================================================================

interface NewsListData {
    items: Array<{ article_slug: string; created_at: string }>;
    pagination: { total: number; total_pages: number };
}

/**
 * Fetch danh sách bài viết cho sitemap — server-side only.
 * Cache 1 giờ (revalidate: 3600) vì sitemap không cần update thường xuyên.
 * Chỉ lấy slug + created_at, exclude nội dung để response nhẹ.
 */
export async function fetchNewsListForSitemap(): Promise<Array<{ slug: string; lastModified: string }>> {
    try {
        const url = `${API_BASE_URL}/api/v1/sse/rest/news_daily?limit=500&sort_by=created_at&sort_order=desc&exclude_fields=html_content,plain_content,sapo,tickers`;

        const res = await fetch(url, {
            next: { revalidate: 3600 }, // Cache 1 giờ
        });

        if (!res.ok) return [];

        const response: StandardApiResponse<NewsListData> = await res.json();
        const items = response.data?.items || [];
        return items.map((item) => ({
            slug: item.article_slug,
            lastModified: item.created_at,
        }));
    } catch (error) {
        console.error('[serverFetch] fetchNewsListForSitemap failed:', error);
        return [];
    }
}
