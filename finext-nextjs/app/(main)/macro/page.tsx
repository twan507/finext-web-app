import { Metadata } from 'next';
import MacroContent from './PageContent';

export const metadata: Metadata = {
    title: 'Kinh tế vĩ mô | Finext',
    description: 'Chỉ số, biểu đồ và phân tích kinh tế vĩ mô toàn cầu.',
};

export default function MacroPage() {
    return <MacroContent />;
}
