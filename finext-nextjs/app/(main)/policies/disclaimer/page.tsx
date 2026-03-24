import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Tuyên bố trách nhiệm',
  description: 'Thông tin miễn trừ trách nhiệm về nội dung và khuyến nghị đầu tư.',
};

export default function DisclaimerPage() {
  return <PageContent />;
}
