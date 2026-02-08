import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
    title: 'Biểu đồ kĩ thuật',
    description: 'Công cụ vẽ biểu đồ kỹ thuật chuyên nghiệp cho phân tích cổ phiếu.',
    openGraph: {
        title: 'Finext - Biểu đồ kĩ thuật',
        description: 'Công cụ vẽ biểu đồ kỹ thuật chuyên nghiệp.',
    },
};

export default function ChartsPage() {
    redirect('/charts/VNINDEX');
}
