// finext-nextjs/app/(main)/reports/page.tsx
import { Metadata } from 'next';
import ReportsContent from './PageContent';

export const metadata: Metadata = {
    title: 'Bản tin thị trường | FinExt',
    description: 'Tổng hợp báo cáo phân tích, bản tin doanh nghiệp và thị trường hàng ngày.',
};

export default function ReportsPage() {
    return <ReportsContent />;
}
