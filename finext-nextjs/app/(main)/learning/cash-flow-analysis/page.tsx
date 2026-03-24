import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Phân tích dòng tiền',
  description: 'Nắm bắt dòng tiền thị trường, phân tích cung cầu và thanh khoản.',
  openGraph: {
    title: 'Phân tích dòng tiền | Finext',
    description: 'Nắm bắt dòng tiền thị trường, phân tích cung cầu và thanh khoản.',
  },
};

export default function CashFlowAnalysisPage() {
  return <PageContent />;
}
