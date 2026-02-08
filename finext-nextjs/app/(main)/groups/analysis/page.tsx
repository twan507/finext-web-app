import type { Metadata } from 'next';
import PageContent from './PageContent';

// Route Segment Config - Static page có thể cache
export const revalidate = 3600;
export const dynamic = 'force-static';

export const metadata: Metadata = {
    title: 'Phân tích Nhóm & Ngành',
    description: 'Phân tích chi tiết và so sánh hiệu suất nhóm ngành trên thị trường chứng khoán.',
    openGraph: {
        title: 'Finext - Phân tích Nhóm & Ngành',
        description: 'Phân tích chi tiết và so sánh hiệu suất nhóm ngành.',
    },
};

export default function GroupAnalysisPage() {
    return <PageContent />;
}
