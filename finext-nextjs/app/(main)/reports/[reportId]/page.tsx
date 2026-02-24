// finext-nextjs/app/(main)/reports/[reportId]/page.tsx
import type { Metadata } from 'next';
import PageContent from './PageContent';
import { fetchReportBySlug } from '../serverFetch';

interface Props {
    params: Promise<{ reportId: string }>;
}

// Dynamic metadata — server-side, cached 5 phút (revalidate: 300 trong fetchReportBySlug).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { reportId } = await params;
    const report = await fetchReportBySlug(reportId);

    // Fallback nếu báo cáo không tồn tại hoặc API lỗi
    if (!report) {
        return {
            title: 'Báo cáo',
            description: 'Báo cáo phân tích thị trường chứng khoán Việt Nam.',
        };
    }

    // Truncate sapo cho description (tối đa 160 ký tự cho SEO)
    const description = report.sapo
        ? report.sapo.length > 160
            ? report.sapo.substring(0, 157) + '...'
            : report.sapo
        : 'Báo cáo phân tích thị trường chứng khoán Việt Nam.';

    return {
        title: report.title,
        description,
        openGraph: {
            title: report.title,
            description,
            type: 'article',
            locale: 'vi_VN',
            siteName: 'Finext',
            url: `https://finext.vn/reports/${reportId}`,
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
            title: report.title,
            description,
        },
    };
}

export default async function ReportDetailPage({ params }: Props) {
    const { reportId } = await params;
    return <PageContent reportId={reportId} />;
}
