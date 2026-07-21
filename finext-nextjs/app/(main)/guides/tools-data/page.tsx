import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Công cụ và dữ liệu',
  description: 'Hướng dẫn dùng các công cụ và dữ liệu nâng cao của Finext: nhận biết giai đoạn thị trường, hỏi đáp cùng Trợ lý Finext AI, theo dõi dữ liệu vĩ mô, tài chính quốc tế và hàng hoá.',
  keywords: ['giai đoạn thị trường', 'trợ lý AI chứng khoán', 'Finext AI', 'dữ liệu vĩ mô', 'tài chính quốc tế', 'giá hàng hoá', 'hướng dẫn Finext'],
  openGraph: {
    title: 'Công cụ và dữ liệu | Finext',
    description: 'Hướng dẫn dùng các công cụ và dữ liệu nâng cao của Finext: giai đoạn thị trường, Trợ lý Finext AI, dữ liệu vĩ mô, quốc tế và hàng hoá.',
  },
  alternates: { canonical: '/guides/tools-data' },
};

export default function GuidesToolsDataPage() {
  return <PageContent />;
}
