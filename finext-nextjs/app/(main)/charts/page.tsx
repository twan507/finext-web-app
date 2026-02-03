import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Biểu đồ kĩ thuật',
    description: 'Công cụ vẽ biểu đồ kỹ thuật chuyên nghiệp cho phân tích cổ phiếu.',
    openGraph: {
        title: 'Biểu đồ kĩ thuật | Finext',
        description: 'Công cụ vẽ biểu đồ kỹ thuật chuyên nghiệp.',
    },
};

export default function ChartsPage() {
    return (
        <div style={{ padding: '2rem' }}>
            <h1>Biểu đồ kĩ thuật</h1>
            <p>Công cụ biểu đồ kỹ thuật đang được phát triển...</p>
        </div>
    );
}
