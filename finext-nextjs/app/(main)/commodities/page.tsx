import { Metadata } from 'next';
import { Suspense } from 'react';
import CommoditiesContent from './PageContent';

export const metadata: Metadata = {
    title: 'Hàng hóa — Vàng, Dầu thô, Nông sản & Kim loại',
    description:
        'Theo dõi giá vàng, dầu thô WTI/Brent, bạc, đồng, nông sản… Biểu đồ giá hàng hóa cập nhật liên tục, phân tích cung cầu và xu hướng thị trường.',
    keywords: [
        'giá hàng hóa',
        'giá vàng',
        'giá dầu',
        'dầu thô',
        'WTI',
        'Brent',
        'nông sản',
        'kim loại',
        'commodity',
    ],
    openGraph: {
        title: 'Hàng hóa — Vàng, Dầu thô, Nông sản & Kim loại | Finext',
        description:
            'Giá vàng, dầu thô, nông sản, kim loại cập nhật liên tục. Biểu đồ trực quan và phân tích xu hướng thị trường hàng hóa.',
    },
};

export default function CommoditiesPage() {
    return (
        <Suspense>
            <CommoditiesContent />
        </Suspense>
    );
}
