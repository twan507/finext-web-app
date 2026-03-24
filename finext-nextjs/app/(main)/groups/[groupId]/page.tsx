import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
    title: 'Chi tiết nhóm cổ phiếu',
    description: 'Phân tích chi tiết biểu đồ chỉ số và dòng tiền nhóm cổ phiếu.',
    openGraph: {
        title: 'Chi tiết nhóm cổ phiếu | Finext',
        description: 'Phân tích chi tiết biểu đồ chỉ số và dòng tiền nhóm cổ phiếu.',
    },
};

export default function GroupDetailPage() {
    return <PageContent />;
}
