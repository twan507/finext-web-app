import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Giai đoạn thị trường',
    description: 'Phân tích và xác định giai đoạn chu kỳ thị trường chứng khoán Việt Nam.',
    openGraph: {
        title: 'Finext - Giai đoạn thị trường',
        description: 'Phân tích và xác định giai đoạn chu kỳ thị trường chứng khoán.',
    },
};

export default function MarketPhasesPage() {
    return (
        <div style={{ padding: '2rem' }}>
            <h1>Giai đoạn thị trường</h1>
            <p>Trang phân tích giai đoạn chu kỳ thị trường đang được phát triển...</p>
        </div>
    );
}
