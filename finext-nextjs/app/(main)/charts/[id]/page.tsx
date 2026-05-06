import { Metadata } from 'next';
import ChartPageContent from './PageContent';

type Props = {
    params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const ticker = (id || 'VNINDEX').toUpperCase();

    return {
        title: { absolute: `Biểu đồ ${ticker} | Finext` },
        description: `Xem biểu đồ và phân tích kỹ thuật cho ${ticker}.`,
        openGraph: {
            title: `Biểu đồ ${ticker} | Finext`,
            description: `Xem biểu đồ và phân tích kỹ thuật cho ${ticker}.`,
        },
    };
}

export default async function ChartDetailPage({ params }: Props) {
    const { id } = await params;
    const ticker = (id || 'VNINDEX').toUpperCase();

    return <ChartPageContent ticker={ticker} />;
}
