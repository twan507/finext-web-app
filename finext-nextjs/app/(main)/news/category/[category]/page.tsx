// finext-nextjs/app/(main)/news/category/[category]/page.tsx
import { Metadata } from 'next';
import PageContent from './PageContent';
import { NEWS_SOURCES_INFO, getSourceInfo, NewsSource } from '../../types';

interface PageProps {
    params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { category } = await params;
    const sourceInfo = getSourceInfo(category as NewsSource);
    const sourceName = sourceInfo?.source_name || 'Tin tức';

    return {
        title: `${sourceName} - Finext`,
        description: `Xem tin tức ${sourceName.toLowerCase()} từ Finext`,
    };
}

export async function generateStaticParams() {
    return NEWS_SOURCES_INFO.map((sourceInfo) => ({
        category: sourceInfo.source,
    }));
}

export default async function NewsSourcePage({ params }: PageProps) {
    const { category } = await params;
    return <PageContent source={category as NewsSource} />;
}
