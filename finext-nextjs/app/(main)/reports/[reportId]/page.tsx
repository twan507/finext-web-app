// finext-nextjs/app/(main)/reports/[reportId]/page.tsx
import type { Metadata } from 'next';
import PageContent from './PageContent';
import { fetchReportBySlug } from '../serverFetch';
import { serializeJsonLd } from '@/utils/jsonLd';

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
            title: `${report.title} | Finext`,
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
                    alt: 'Finext - Your Next Financial Step',
                },
            ],
        },
        twitter: {
            card: 'summary',
            title: report.title,
            description,
        },
        alternates: { canonical: `/reports/${reportId}` },
    };
}

export default async function ReportDetailPage({ params }: Props) {
    const { reportId } = await params;
    // fetch được Next.js dedupe (revalidate 300) nên không phát sinh call thừa so với generateMetadata
    const report = await fetchReportBySlug(reportId);
    const pageUrl = `https://finext.vn/reports/${reportId}`;

    // JSON-LD NewsArticle + BreadcrumbList — chỉ render khi có dữ liệu báo cáo
    const jsonLd = report
        ? {
              '@context': 'https://schema.org',
              '@graph': [
                  {
                      '@type': 'NewsArticle',
                      headline: report.title,
                      description: report.sapo || undefined,
                      image: ['https://finext.vn/finext-panel.png'],
                      datePublished: report.created_at || undefined,
                      dateModified: report.created_at || undefined,
                      inLanguage: 'vi',
                      mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
                      author: { '@type': 'Organization', name: 'Finext', url: 'https://finext.vn' },
                      publisher: {
                          '@type': 'Organization',
                          name: 'Finext',
                          logo: { '@type': 'ImageObject', url: 'https://finext.vn/icons/icon-512x512.png' },
                      },
                  },
                  {
                      '@type': 'BreadcrumbList',
                      itemListElement: [
                          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: 'https://finext.vn' },
                          { '@type': 'ListItem', position: 2, name: 'Báo cáo', item: 'https://finext.vn/reports' },
                          { '@type': 'ListItem', position: 3, name: report.title, item: pageUrl },
                      ],
                  },
              ],
          }
        : null;

    return (
        <>
            {jsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
                />
            )}
            <PageContent reportId={reportId} />
        </>
    );
}
