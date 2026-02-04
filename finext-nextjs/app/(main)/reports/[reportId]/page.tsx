// finext-nextjs/app/(main)/reports/[reportId]/page.tsx
import { Metadata } from 'next';
import PageContent from './PageContent';

interface PageProps {
    params: Promise<{ reportId: string }>;
}

export const metadata: Metadata = {
    title: 'Báo cáo',
    description: 'Chi tiết bản tin thị trường.',
};

export default async function ReportDetailPage({ params }: PageProps) {
    const { reportId } = await params;
    return <PageContent reportId={reportId} />;
}
