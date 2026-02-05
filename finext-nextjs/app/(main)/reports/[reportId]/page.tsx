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
    // Timeout sau 3 giây để đảm bảo crawler không bị trễ
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
        const response = await fetch(
            `${API_URL}/api/v1/sse/rest/report_article?report_slug=${encodeURIComponent(reportSlug)}&metadata_only=true`,
            {
                next: { revalidate: 60 }, // Cache 60 giây
                signal: controller.signal,
            }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
            return null;
        }

        const result = await response.json();
        return result.data?.report || null;
    } catch (error) {
        clearTimeout(timeoutId);
        // Log nhưng không throw - trả về null để dùng fallback metadata
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
            title: 'Finext - Báo cáo',
            description: 'Chi tiết bản tin thị trường.',
            openGraph: {
                title: 'Finext - Báo cáo',
                description: 'Chi tiết bản tin thị trường.',
                siteName: 'Finext',
                type: 'article',
                locale: 'vi_VN',
                images: [
                    {
                        url: `${BASE_URL}/finext-icon-trans.png`,
                        width: 512,
                        height: 512,
                        alt: 'Finext - Báo cáo',
                    },
                ],
            },
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
            siteName: 'Finext',
            type: 'article',
            locale: 'vi_VN',
            images: [
                {
                    url: `${BASE_URL}/finext-icon-trans.png`,
                    width: 512,
                    height: 512,
                    alt: report.title,
                },
            ],
        },

        // Twitter Card
        twitter: {
            card: 'summary_large_image',
            title: report.title,
            description: description,
            images: [`${BASE_URL}/finext-icon-trans.png`],
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
