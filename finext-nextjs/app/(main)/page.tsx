import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
    title: 'Trang chủ',
    description:
        'Finext — Nền tảng phân tích chứng khoán thông minh. ' +
        'Theo dõi thị trường, sàng lọc cổ phiếu và đọc báo cáo chuyên sâu cho nhà đầu tư Việt Nam.',
    openGraph: {
        title: 'Trang chủ | Finext',
        description:
            'Theo dõi thị trường, sàng lọc cổ phiếu và đọc báo cáo chuyên sâu cho nhà đầu tư Việt Nam.',
    },
};

export default function HomePage() {
    return <PageContent />;
}
