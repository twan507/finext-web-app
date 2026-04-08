import { Metadata } from 'next';
import { Suspense } from 'react';
import InternationalContent from './PageContent';

export const metadata: Metadata = {
    title: 'Thị trường quốc tế',
    description: 'Thông tin và diễn biến các thị trường chứng khoán quốc tế.',
    openGraph: {
        title: 'Thị trường quốc tế | Finext',
        description: 'Thông tin và diễn biến các thị trường chứng khoán quốc tế.',
    },
};

export default function InternationalPage() {
    return (
        <Suspense>
            <InternationalContent />
        </Suspense>
    );
}
