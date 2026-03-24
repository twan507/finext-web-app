import type { Metadata } from 'next';
import PageContent from './PageContent';

interface StockDetailPageProps {
    params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: StockDetailPageProps): Promise<Metadata> {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();
    return {
        title: `${upper} - Chi tiết cổ phiếu`,
        description: `Phân tích chi tiết cổ phiếu ${upper}: biểu đồ giá, chỉ số tài chính, tin tức và khuyến nghị.`,
        openGraph: {
            title: `${upper} - Chi tiết cổ phiếu | Finext`,
            description: `Phân tích chi tiết cổ phiếu ${upper}: biểu đồ giá, chỉ số tài chính, tin tức và khuyến nghị.`,
        },
    };
}

export default function StockDetailPage() {
    return <PageContent />;
}
