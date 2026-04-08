import { Metadata } from 'next';
import { Suspense } from 'react';
import MacroContent from './PageContent';

export const metadata: Metadata = {
    title: 'Kinh tế vĩ mô',
    description: 'Chỉ số, biểu đồ và phân tích kinh tế vĩ mô toàn cầu.',
    openGraph: {
        title: 'Kinh tế vĩ mô | Finext',
        description: 'Chỉ số, biểu đồ và phân tích kinh tế vĩ mô toàn cầu.',
    },
};

export default function MacroPage() {
    return (
        <Suspense>
            <MacroContent />
        </Suspense>
    );
}
