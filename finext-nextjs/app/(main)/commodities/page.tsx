import { Metadata } from 'next';
import CommoditiesContent from './PageContent';

export const metadata: Metadata = {
    title: 'Hàng hóa | Finext',
    description: 'Diễn biến giá cả, thị trường các loại hàng hóa.',
};

export default function CommoditiesPage() {
    return <CommoditiesContent />;
}
