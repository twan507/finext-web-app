// finext-nextjs/app/(main)/reports/[reportId]/page.tsx
import type { Metadata } from 'next';
import PageContent from './PageContent';

interface Props {
    params: Promise<{ reportId: string }>;
}

// Static metadata - không fetch API để tăng tốc độ load
export const metadata: Metadata = {
    title: 'Báo cáo',
    description: 'Báo cáo phân tích thị trường chứng khoán Việt Nam.',
    openGraph: {
        title: 'Finext - Báo cáo',
        description: 'Báo cáo phân tích thị trường chứng khoán Việt Nam.',
        siteName: 'Finext',
        type: 'article',
        locale: 'vi_VN',
        images: [
            {
                url: 'https://finext.vn/finext-icon-trans.png',
                width: 512,
                height: 512,
                alt: 'Finext',
            },
        ],
    },
};

export default async function ReportDetailPage({ params }: Props) {
    const { reportId } = await params;
    return <PageContent reportId={reportId} />;
}
