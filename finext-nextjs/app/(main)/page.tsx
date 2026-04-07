// file: app/(main)/page.tsx

import type { Metadata } from 'next';
import PageContent from './home/PageContent'; // Import component từ thư mục home cũ

export const metadata: Metadata = {
    // Để nguyên tên tiếng Anh đanh thép này cho Google ăn index 
    title: { absolute: 'Finext' },
    description:
        'Finext là nền tảng phân tích và hỗ trợ đầu tư chứng khoán được xây dựng bởi đội ngũ chuyên gia. Chúng tôi cung cấp hệ thống công cụ toàn diện — từ dữ liệu thị trường realtime, phân tích dòng tiền thông minh, đến bộ lọc cổ phiếu nâng cao và báo cáo chiến lược định kỳ — giúp nhà đầu tư cá nhân tiếp cận phương pháp đầu tư bài bản, hiệu quả.',
    openGraph: {
        title: 'Finext',
        description:
            'Finext là nền tảng phân tích và hỗ trợ đầu tư chứng khoán được xây dựng bởi đội ngũ chuyên gia. Chúng tôi cung cấp hệ thống công cụ toàn diện — từ dữ liệu thị trường realtime, phân tích dòng tiền thông minh, đến bộ lọc cổ phiếu nâng cao và báo cáo chiến lược định kỳ — giúp nhà đầu tư cá nhân tiếp cận phương pháp đầu tư bài bản, hiệu quả.',
    },
    alternates: {
        canonical: 'https://finext.vn',
    },
};

export default function HomePage() {
    return <PageContent />;
}
