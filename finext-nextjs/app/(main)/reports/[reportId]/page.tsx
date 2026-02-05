// finext-nextjs/app/(main)/reports/[reportId]/page.tsx
import type { Metadata } from 'next';
import PageContent from './PageContent';

interface Props {
    params: Promise<{ reportId: string }>;
}

// Base URL cho metadata
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://finext.vn';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.finext.vn';

// Fetch report từ API để generate metadata
async function fetchReportForMetadata(reportSlug: string) {
    try {
        const response = await fetch(
            `${API_URL}/api/v1/sse/rest/report_article?report_slug=${encodeURIComponent(reportSlug)}`,
            {
                next: { revalidate: 60 }, // Cache 60 giây
            }
        );

        if (!response.ok) {
            return null;
        }

        const result = await response.json();
        return result.data?.report || null;
    } catch (error) {
        console.error('[generateMetadata] Failed to fetch report:', error);
        return null;
    }
}

// Dynamic metadata generation cho SEO và social sharing
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { reportId } = await params;
    const report = await fetchReportForMetadata(reportId);

    // Fallback nếu không tìm thấy báo cáo
    if (!report) {
        return {
            title: 'Báo cáo | Finext',
            description: 'Chi tiết bản tin thị trường.',
        };
    }

    // Truncate sapo cho description (tối đa 160 ký tự)
    const description = report.sapo
        ? report.sapo.length > 160
            ? report.sapo.substring(0, 157) + '...'
            : report.sapo
        : 'Báo cáo phân tích thị trường từ Finext';

    const reportUrl = `${BASE_URL}/reports/${reportId}`;

    return {
        title: report.title,
        description: description,

        // Open Graph - cho Facebook, Zalo, Messenger, etc.
        openGraph: {
            title: report.title,
            description: description,
            url: reportUrl,
            siteName: 'finext.vn',
            type: 'article',
            locale: 'vi_VN',
        },

        // Twitter Card
        twitter: {
            card: 'summary',
            title: report.title,
            description: description,
        },

        // Canonical URL
        alternates: {
            canonical: reportUrl,
        },
    };
}

export default async function ReportDetailPage({ params }: Props) {
    const { reportId } = await params;
    return <PageContent reportId={reportId} />;
}
