import type { Metadata } from 'next';
import SectorDetailContent from './PageContent';

interface SectorDetailPageProps {
    params: Promise<{ sectorId: string }>;
}

export async function generateMetadata({ params }: SectorDetailPageProps): Promise<Metadata> {
    const { sectorId } = await params;
    const name = decodeURIComponent(sectorId).replace(/-/g, ' ');
    return {
        title: `Ngành ${name}`,
        description: `Phân tích chi tiết ngành ${name}: dòng tiền, sức mạnh nhóm ngành và cổ phiếu tiêu biểu.`,
        openGraph: {
            title: `Ngành ${name} | Finext`,
            description: `Phân tích chi tiết ngành ${name}: dòng tiền, sức mạnh nhóm ngành và cổ phiếu tiêu biểu.`,
        },
    };
}

export default function SectorDetailPage() {
    return <SectorDetailContent />;
}
