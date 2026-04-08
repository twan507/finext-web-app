import { Metadata } from 'next';
import { Suspense } from 'react';
import CommoditiesContent from './PageContent';

export const metadata: Metadata = {
    title: 'Hàng hóa',
    description: 'Diễn biến giá cả, thị trường các loại hàng hóa.',
    openGraph: {
        title: 'Hàng hóa | Finext',
        description: 'Diễn biến giá cả, thị trường các loại hàng hóa.',
    },
};

export default function CommoditiesPage() {
    return (
        <Suspense>
            <CommoditiesContent />
        </Suspense>
    );
}
