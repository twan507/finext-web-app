import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Biểu đồ kỹ thuật',
    description: 'Xem biểu đồ và phân tích kỹ thuật cổ phiếu trên Finext.',
    openGraph: {
        title: 'Biểu đồ kỹ thuật | Finext',
        description: 'Xem biểu đồ và phân tích kỹ thuật cổ phiếu trên Finext.',
    },
};

export default function ChartsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
