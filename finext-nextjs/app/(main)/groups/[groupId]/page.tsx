import type { Metadata } from 'next';
import PageContent from './PageContent';

const INDEX_LIST: Record<string, string> = {
    'FNXINDEX': 'Finext Index',
    'FNX100': 'Finext 100',
    'VUOTTROI': 'Finext Vượt trội',
    'ONDINH': 'Finext Ổn định',
    'SUKIEN': 'Finext Sự kiện',
    'LARGECAP': 'Finext LargeCap',
    'MIDCAP': 'Finext MidCap',
    'SMALLCAP': 'Finext SmallCap',
};

export async function generateMetadata({
    params,
}: {
    params: Promise<{ groupId: string }>;
}): Promise<Metadata> {
    const { groupId } = await params;
    const upper = groupId.toUpperCase();
    
    // Ánh xạ id sang tên hiển thị đẹp, nếu không có thì dùng dạng hoa (ví dụ: VN30)
    const displayName = INDEX_LIST[upper] || upper;

    return {
        title: { absolute: `Nhóm ${displayName} | Finext` },
        description: `Phân tích chi tiết biểu đồ chỉ số và dòng tiền nhóm cổ phiếu ${displayName} (${upper}).`,
        openGraph: {
            title: `Nhóm ${displayName} | Finext`,
            description: `Phân tích chi tiết biểu đồ chỉ số và dòng tiền nhóm cổ phiếu ${displayName} (${upper}).`,
        },
    };
}

export default function GroupDetailPage() {
    return <PageContent />;
}
