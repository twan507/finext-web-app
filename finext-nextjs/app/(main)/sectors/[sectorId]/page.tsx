'use client';

import { useParams } from 'next/navigation';
import SectorDetailContent from './PageContent';

export default function SectorDetailPage() {
    useParams();
    return <SectorDetailContent />;
}
