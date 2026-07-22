import type { Metadata } from 'next';
import { Suspense } from 'react';
import PageContent from './PageContent';
import { fetchChatSuggestions } from './serverFetch';

export const metadata: Metadata = {
  title: 'Finext AI',
  description: 'Trợ lý AI Finext — hỏi đáp về thị trường, cổ phiếu, nhóm ngành bằng ngôn ngữ tự nhiên.',
  openGraph: { title: 'Finext AI | Finext', description: 'Trợ lý AI phân tích thị trường chứng khoán Việt Nam.' },
};

export default async function ChatPage() {
  const suggestions = await fetchChatSuggestions();
  return (
    <Suspense>
      <PageContent suggestions={suggestions} />
    </Suspense>
  );
}
