// finext-nextjs/app/(main)/news/category/[category]/page.tsx
import type { Metadata } from 'next';
import PageContent from './PageContent';

interface Props {
    params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { category } = await params;
    const categoryName = decodeURIComponent(category);

    return {
        title: 'Tin tức',
        description: `Cập nhật tin tức ${categoryName} từ nhiều nguồn uy tín`,
        openGraph: {
            title: 'Tin tức | Finext',
            description: `Cập nhật tin tức ${categoryName} từ nhiều nguồn uy tín`,
        },
    };
}

export default async function NewsCategoryPage({ params }: Props) {
    const { category } = await params;
    return <PageContent category={category} />;
}
