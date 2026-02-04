// finext-nextjs/app/(main)/reports/type/[type]/page.tsx
import { Metadata } from 'next';
import PageContent from './PageContent';
import { REPORT_TYPES_INFO, getReportTypeInfo, ReportType } from '../../types';

interface PageProps {
    params: Promise<{ type: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { type } = await params;
    const typeInfo = getReportTypeInfo(type as ReportType);
    const typeName = typeInfo?.type_name || 'Báo cáo';

    return {
        title: 'Báo cáo',
        description: `Tổng hợp ${typeName.toLowerCase()} từ Finext.`,
    };
}

export async function generateStaticParams() {
    return REPORT_TYPES_INFO.map((typeInfo) => ({
        type: typeInfo.type,
    }));
}

export default async function ReportTypePage({ params }: PageProps) {
    const { type } = await params;
    return <PageContent type={type as ReportType} />;
}
