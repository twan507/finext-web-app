// finext-nextjs/app/(main)/reports/page.tsx
import { Metadata } from 'next';
import ReportsContent from './PageContent';

export const metadata: Metadata = {
    title: 'Báo cáo tổng hợp',
    description: 'Tổng hợp báo cáo phân tích thị trường, bản tin doanh nghiệp, báo cáo ngành và báo cáo chiến lược — cập nhật hằng ngày, hỗ trợ nhà đầu tư ra quyết định.',
    keywords: ['báo cáo chứng khoán', 'báo cáo phân tích', 'báo cáo thị trường', 'báo cáo doanh nghiệp', 'báo cáo ngành', 'báo cáo chiến lược', 'bản tin chứng khoán'],
    openGraph: {
        title: 'Báo cáo tổng hợp | Finext',
        description: 'Tổng hợp báo cáo phân tích thị trường, doanh nghiệp, ngành và chiến lược — cập nhật hằng ngày, hỗ trợ nhà đầu tư ra quyết định.',
    },
};

export default function ReportsPage() {
    return <ReportsContent />;
}
