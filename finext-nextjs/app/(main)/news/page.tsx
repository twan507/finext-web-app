import type { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
    title: 'Tin tức thị trường',
    description: 'Tin tức chứng khoán, tài chính và doanh nghiệp Việt Nam cập nhật theo thời gian thực: thông tin doanh nghiệp, sự kiện thị trường, kết quả kinh doanh và phân tích chuyên sâu.',
    keywords: ['tin tức chứng khoán', 'tin tức thị trường', 'tin tức tài chính', 'tin doanh nghiệp', 'kết quả kinh doanh', 'sự kiện thị trường', 'tin chứng khoán Việt Nam'],
    openGraph: {
        title: 'Tin tức thị trường | Finext',
        description: 'Tin tức chứng khoán, tài chính và doanh nghiệp Việt Nam: thông tin doanh nghiệp, kết quả kinh doanh và phân tích chuyên sâu — cập nhật liên tục.',
    },
};

export default function NewsPage() {
    return <PageContent />;
}
