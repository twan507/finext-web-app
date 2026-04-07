import type { Metadata } from 'next';
import PageContent from './PageContent';

interface StockDetailPageProps {
    params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: StockDetailPageProps): Promise<Metadata> {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();
    return {
        title: `Cổ phiếu ${upper}`,
        description: `Phân tích chi tiết cổ phiếu ${upper}: biểu đồ giá, chỉ số tài chính, tin tức và dữ liệu tham khảo.`,
        openGraph: {
            title: `Cổ phiếu ${upper} | Finext`,
            description: `Phân tích chi tiết cổ phiếu ${upper}: biểu đồ giá, chỉ số tài chính, tin tức và dữ liệu tham khảo.`,
        },
    };
}

export default function StockDetailPage() {
    return <PageContent />;
}
