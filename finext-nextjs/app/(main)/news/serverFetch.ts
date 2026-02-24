// finext-nextjs/app/(main)/news/serverFetch.ts
// Server-side fetch helpers cho generateMetadata và sitemap.
// Dùng native fetch (Next.js server) — KHÔNG dùng apiClient (client-only, cần session).
// Cache tự động bằng Next.js fetch cache với revalidate.
// Dùng INTERNAL URL (http://fastapi:8000) thay vì public URL để tránh round-trip qua internet.

import { NewsArticle } from './types';

// Server-side internal API URL: dùng Docker internal network (http://fastapi:8000)
// thay vì public URL (https://finext.vn) để tránh round-trip Nginx → Internet → Nginx.
// Fallback về NEXT_PUBLIC_API_URL cho dev local.
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
 * Chỉ lấy title + sapo cho metadata, exclude content fields nặng.
 * Timeout 3 giây để không block page render.
 */
export async function fetchArticleBySlug(slug: string): Promise<NewsArticle | null> {
    try {
        const url = `${INTERNAL_API_URL}/api/v1/sse/rest/news_article?article_slug=${encodeURIComponent(slug)}&projection=${encodeURIComponent('{"title":1,"sapo":1,"image":1}')}`;

        // Timeout 3 giây — nếu API chậm, trả fallback metadata thay vì block page
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const res = await fetch(url, {
            next: { revalidate: 300 }, // Cache 5 phút
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

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
        const url = `${INTERNAL_API_URL}/api/v1/sse/rest/news_daily?limit=500&sort_by=created_at&sort_order=desc&projection=${encodeURIComponent('{"article_slug":1,"created_at":1}')}`;

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
