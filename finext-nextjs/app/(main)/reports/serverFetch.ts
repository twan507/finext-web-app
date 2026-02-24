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
 * Fetch 1 báo cáo theo slug — dùng cho generateMetadata (server-side only).
 * Cache 5 phút (revalidate: 300).
 * Chỉ lấy title + sapo cho metadata, exclude content fields nặng.
 * Timeout 3 giây để không block page render.
 */
export async function fetchReportBySlug(slug: string): Promise<NewsReport | null> {
    try {
        const url = `${INTERNAL_API_URL}/api/v1/sse/rest/report_article?report_slug=${encodeURIComponent(slug)}&projection=${encodeURIComponent('{"title":1,"sapo":1}')}`;

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
