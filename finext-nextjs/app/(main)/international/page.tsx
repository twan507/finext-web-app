import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Thị trường quốc tế | Finext',
    description: 'Thông tin và diễn biến các thị trường chứng khoán quốc tế.',
};

import InternationalContent from './PageContent';

export default function InternationalPage() {
    return <InternationalContent />;
}
