import { Metadata } from 'next';
import { Suspense } from 'react';
import InternationalContent from './PageContent';

export const metadata: Metadata = {
    title: 'Thị trường quốc tế — Chứng khoán Mỹ, Châu Á, Châu Âu',
    description:
        'Theo dõi diễn biến thị trường chứng khoán quốc tế: S&P 500, Nasdaq, Nikkei 225, Hang Seng, DAX… Cập nhật liên tục biến động giá, chỉ số và xu hướng toàn cầu.',
    keywords: [
        'thị trường quốc tế',
        'chứng khoán Mỹ',
        'S&P 500',
        'Nasdaq',
        'Nikkei',
        'Hang Seng',
        'chứng khoán châu Á',
        'chứng khoán châu Âu',
    ],
    openGraph: {
        title: 'Thị trường quốc tế — S&P 500, Nasdaq, Nikkei, Hang Seng | Finext',
        description:
            'Cập nhật liên tục diễn biến các thị trường chứng khoán quốc tế: Mỹ, Châu Á, Châu Âu. Biểu đồ, chỉ số và phân tích xu hướng toàn cầu.',
    },
};

export default function InternationalPage() {
    return (
        <Suspense>
            <InternationalContent />
        </Suspense>
    );
}
