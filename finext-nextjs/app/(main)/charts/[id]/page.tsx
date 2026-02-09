import { Metadata } from 'next';
import ChartPageContent from './PageContent';

type Props = {
    params: { id: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const ticker = params.id || 'VNINDEX';

    return {
        title: `Biểu đồ ${ticker}`,
        description: `Xem biểu đồ và phân tích kỹ thuật cho ${ticker}`,
    };
}

export default function ChartDetailPage({ params }: Props) {
    const id = params.id || 'VNINDEX';

    return <ChartPageContent ticker={id} />;
}
