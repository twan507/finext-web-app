import type { Metadata } from 'next';
import { Suspense } from 'react';
import PageContent from '../PageContent';
import { fetchChatSuggestions } from '../serverFetch';

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = {
  title: 'Finext AI',
  description: 'Trợ lý AI Finext — hỏi đáp về thị trường, cổ phiếu, nhóm ngành bằng ngôn ngữ tự nhiên.',
};

// URL riêng mỗi hội thoại: /chat/{id}. Mở thẳng hội thoại đó (initialConversationId) — dùng chung ChatApp với /chat.
export default async function ChatConversationPage({ params }: Props) {
  const { id } = await params;
  const suggestions = await fetchChatSuggestions();
  return (
    <Suspense>
      <PageContent initialConversationId={id} suggestions={suggestions} />
    </Suspense>
  );
}
