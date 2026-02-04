// finext-nextjs/app/(main)/news/type/[type]/page.tsx
import { Metadata } from 'next';
import PageContent from './PageContent';
import { NEWS_TYPES_INFO, getTypeInfo, NewsType } from '../../types';

interface PageProps {
    params: Promise<{ type: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { type } = await params;
    const typeInfo = getTypeInfo(type as NewsType);
    const typeName = typeInfo?.type_name || 'Tin tức';

    return {
        title: `${typeName} - Finext`,
        description: `Xem tin tức ${typeName.toLowerCase()} từ Finext`,
    };
}

export async function generateStaticParams() {
    return NEWS_TYPES_INFO.map((typeInfo) => ({
        type: typeInfo.type,
    }));
}

export default async function NewsTypePage({ params }: PageProps) {
    const { type } = await params;
    return <PageContent type={type as NewsType} />;
}
