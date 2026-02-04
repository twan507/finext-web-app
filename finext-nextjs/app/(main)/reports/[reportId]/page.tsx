// finext-nextjs/app/(main)/reports/[reportId]/page.tsx
import { Metadata } from 'next';
import PageContent from './PageContent';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://localhost';

interface PageProps {
    params: Promise<{ reportId: string }>;
}

/** Response type từ news_report_meta API */
interface ReportMetaResponse {
    status: number;
    message: string;
    data: {
        item: {
            report_id: string;
            title: string;
            sapo?: string;
            created_at: string;
            report_type: string;
            category_name: string;
        } | null;
    };
}

/**
 * Fetch metadata cho report theo slug
 * Sử dụng keyword news_report_meta - chỉ lấy fields cần thiết
 */
async function fetchReportMeta(slug: string): Promise<ReportMetaResponse['data']['item']> {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/v1/sse/rest/news_report_meta?slug=${encodeURIComponent(slug)}`,
            {
                next: { revalidate: 300 }, // Cache 5 phút
                headers: { 'Content-Type': 'application/json' },
            }
        );

        if (!response.ok) return null;

        const data: ReportMetaResponse = await response.json();
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
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { reportId } = await params;
    const report = await fetchReportMeta(reportId);

    // Fallback nếu không tìm thấy report
    if (!report) {
        return {
            title: 'Chi tiết bản tin',
            description: 'Chi tiết bản tin thị trường từ Finext.',
            openGraph: {
                title: 'Chi tiết bản tin | Finext',
                description: 'Chi tiết bản tin thị trường từ Finext.',
                siteName: 'Finext',
                url: 'https://finext.vn',
                type: 'article',
                locale: 'vi_VN',
            },
        };
    }

    // Lấy title và sapo từ report
    const title = report.title || 'Chi tiết bản tin';
    // Sapo: giới hạn ~160 ký tự cho description (2 dòng)
    const description = report.sapo
        ? report.sapo.length > 160
            ? report.sapo.substring(0, 157) + '...'
            : report.sapo
        : `Xem chi tiết bản tin: ${title}`;

    const url = `https://finext.vn/reports/${reportId}`;

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
            publishedTime: report.created_at,
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

export default async function ReportDetailPage({ params }: PageProps) {
    const { reportId } = await params;
    return <PageContent reportId={reportId} />;
}
