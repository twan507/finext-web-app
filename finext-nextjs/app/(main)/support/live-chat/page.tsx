import { Metadata } from 'next';
import PageContent from './PageContent';

export const metadata: Metadata = {
  title: 'Trò chuyện trực tiếp',
  description: 'Chat trực tiếp với đội ngũ hỗ trợ của Finext.',
  openGraph: {
    title: 'Trò chuyện trực tiếp | Finext',
    description: 'Chat trực tiếp với đội ngũ hỗ trợ của Finext.',
  },
};

export default function LiveChatPage() {
  return <PageContent />;
}
