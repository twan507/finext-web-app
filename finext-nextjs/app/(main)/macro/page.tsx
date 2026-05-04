import { Metadata } from 'next';
import { Suspense } from 'react';
import MacroContent from './PageContent';

export const metadata: Metadata = {
    title: 'Kinh tế vĩ mô',
    description:
        'Phân tích kinh tế vĩ mô toàn cầu: GDP, CPI, lạm phát, lãi suất Fed, tỷ giá USD/VND… Biểu đồ trực quan và dữ liệu cập nhật liên tục.',
    keywords: [
        'kinh tế vĩ mô',
        'GDP',
        'lạm phát',
        'CPI',
        'lãi suất',
        'Fed',
        'tỷ giá',
        'chính sách tiền tệ',
    ],
    openGraph: {
        title: 'Kinh tế vĩ mô | Finext',
        description:
            'Dữ liệu và phân tích kinh tế vĩ mô: GDP, lạm phát, lãi suất, tỷ giá. Biểu đồ trực quan cập nhật từ các nguồn uy tín.',
    },
};

export default function MacroPage() {
    return (
        <Suspense>
            <MacroContent />
        </Suspense>
    );
}
