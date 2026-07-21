// finext-nextjs/app/(main)/reports/serverFetch.ts
// Server-side fetch helpers cho generateMetadata.
// Dùng native fetch (Next.js server) — KHÔNG dùng apiClient (client-only, cần session).
// Dùng INTERNAL URL (http://fastapi:8000) thay vì public URL để tránh round-trip qua internet.

import { NewsReport } from './types';

const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface StandardApiResponse<T> {
    status: number;
    message?: string;
    data: T;
}

interface ReportData {
    report: NewsReport | null;
    error?: string;
}

/**
 * Fetch 1 báo cáo theo slug — dùng cho generateMetadata + JSON-LD (server-side only).
 * Cache 5 phút (revalidate: 300).
 * Chỉ lấy title + sapo + created_at cho metadata/structured data, exclude content nặng.
 * Timeout 3 giây để không block page render.
 */
export async function fetchReportBySlug(slug: string): Promise<NewsReport | null> {
    try {
        const url = `${INTERNAL_API_URL}/api/v1/sse/rest/report_article?report_slug=${encodeURIComponent(slug)}&projection=${encodeURIComponent('{"title":1,"sapo":1,"created_at":1}')}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const res = await fetch(url, {
            next: { revalidate: 300 },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) return null;

        const response: StandardApiResponse<ReportData> = await res.json();
        return response.data?.report || null;
    } catch (error) {
        console.error('[serverFetch] fetchReportBySlug failed:', error);
        return null;
    }
}

// ============================================================================
// FETCH REPORT LIST FOR SITEMAP
// ============================================================================

interface ReportListData {
    items: Array<{ report_slug: string; created_at: string }>;
    pagination: { total: number; total_pages: number };
}

/**
 * Fetch danh sách báo cáo cho sitemap — server-side only.
 * Cache 1 giờ (revalidate: 3600) vì sitemap không cần update thường xuyên.
 * Chỉ lấy slug + created_at, exclude nội dung để response nhẹ.
 */
export async function fetchReportListForSitemap(): Promise<Array<{ slug: string; lastModified: string }>> {
    try {
        const url = `${INTERNAL_API_URL}/api/v1/sse/rest/news_report?limit=500&sort_by=created_at&sort_order=desc&projection=${encodeURIComponent('{"report_slug":1,"created_at":1}')}`;

        const res = await fetch(url, {
            next: { revalidate: 3600 }, // Cache 1 giờ
        });

        if (!res.ok) return [];

        const response: StandardApiResponse<ReportListData> = await res.json();
        const items = response.data?.items || [];
        return items.map((item) => ({
            slug: item.report_slug,
            lastModified: item.created_at,
        }));
    } catch (error) {
        console.error('[serverFetch] fetchReportListForSitemap failed:', error);
        return [];
    }
}
