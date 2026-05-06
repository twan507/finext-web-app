// file: app/(main)/page.tsx

import type { Metadata } from 'next';
import PageContent from './home/PageContent'; // Import component từ thư mục home cũ

export const metadata: Metadata = {
    title: {
        absolute: 'Finext',
    },
    description:
        'Finext — Nền tảng phân tích chứng khoán thông minh. Theo dõi thị trường, sàng lọc cổ phiếu, phân tích dòng tiền và đọc báo cáo chuyên sâu cho nhà đầu tư Việt Nam.',
    openGraph: {
        type: 'website',
        locale: 'vi_VN',
        siteName: 'Finext',
        url: 'https://finext.vn',
        title: 'Finext',
        description:
            'Nền tảng phân tích chứng khoán thông minh cho nhà đầu tư Việt Nam. Theo dõi thị trường, sàng lọc cổ phiếu và đọc báo cáo chuyên sâu.',
        images: [
            {
                url: '/finext-panel.png',
                width: 1200,
                height: 630,
                alt: 'Finext',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Finext',
        description:
            'Nền tảng phân tích chứng khoán thông minh cho nhà đầu tư Việt Nam.',
        images: ['/finext-panel.png'],
    },
    alternates: {
        canonical: 'https://finext.vn',
    },
};

export default function HomePage() {
    return <PageContent />;
}
