'use client';

import { useParams } from 'next/navigation';
import ChartPageContent from './PageContent';

export default function ChartDetailPage() {
    const params = useParams();
    const id = (params.id as string) || 'VNINDEX';

    return <ChartPageContent ticker={id} />;
}
