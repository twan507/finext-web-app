// finext-nextjs/app/(main)/reports/category/[category]/page.tsx
import { Metadata } from 'next';
import PageContent from './PageContent';

interface PageProps {
    params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { category } = await params;

    return {
        title: `Bản tin ${category} | FinExt`,
        description: `Tổng hợp bản tin ${category} hàng ngày.`,
    };
}

export default async function ReportCategoryPage({ params }: PageProps) {
    const { category } = await params;
    return <PageContent category={category} />;
}
