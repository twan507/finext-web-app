// services/chatConversations.ts — REST persistence hội thoại (Bước 3 backend: /api/v1/chat/conversations).
// Stream vẫn đi qua chatClient.ts; đây là 3 endpoint thường (list/detail/delete) bọc apiClient.
import { apiClient } from './apiClient';

export interface ToolCallMetaDTO {
  name: string;
  args_summary: string;
  ok: boolean;
  ms: number;
}

export interface ConversationSummaryDTO {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  msg_count: number;
  pinned: boolean;
}

export interface MessageDTO {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls: ToolCallMetaDTO[];
  usage?: Record<string, number> | null;
  interrupted?: boolean;
  feedback?: { rating: number; reason?: string } | null;
  created_at: string;
}

export interface ConversationDetailDTO extends ConversationSummaryDTO {
  messages: MessageDTO[];
}

/** Danh sách hội thoại của user (mới nhất trước). skipCache: luôn tươi khi mount trang. */
export async function fetchConversations(): Promise<ConversationSummaryDTO[]> {
  const res = await apiClient<ConversationSummaryDTO[]>({
    url: '/api/v1/chat/conversations',
    method: 'GET',
    skipCache: true,
  });
  return res.status === 200 && res.data ? res.data : [];
}

/** Chi tiết 1 hội thoại kèm messages (để mở lại khi reload). null nếu không có/không thuộc user. */
export async function fetchConversationDetail(id: string): Promise<ConversationDetailDTO | null> {
  const res = await apiClient<ConversationDetailDTO>({
    url: `/api/v1/chat/conversations/${id}`,
    method: 'GET',
    skipCache: true,
  });
  return res.status === 200 && res.data ? res.data : null;
}

/** Xoá 1 hội thoại (kèm messages). true nếu backend xác nhận xoá. */
export async function deleteConversationApi(id: string): Promise<boolean> {
  const res = await apiClient({ url: `/api/v1/chat/conversations/${id}`, method: 'DELETE' });
  return res.status === 200;
}

/** Ghim / bỏ ghim 1 hội thoại. true nếu backend xác nhận. */
export async function setPinnedApi(id: string, pinned: boolean): Promise<boolean> {
  const res = await apiClient({ url: `/api/v1/chat/conversations/${id}/pin`, method: 'PATCH', body: { pinned } });
  return res.status === 200;
}

/** Đổi tên 1 hội thoại. true nếu backend xác nhận. */
export async function renameConversationApi(id: string, title: string): Promise<boolean> {
  const res = await apiClient({ url: `/api/v1/chat/conversations/${id}/rename`, method: 'PATCH', body: { title } });
  return res.status === 200;
}

/** Đánh giá 👍/👎 một câu trả lời (rating 1 hoặc -1, kèm lý do tuỳ chọn). */
export async function sendFeedbackApi(messageId: string, rating: 1 | -1, reason?: string): Promise<boolean> {
  const res = await apiClient({ url: `/api/v1/chat/messages/${messageId}/feedback`, method: 'PATCH', body: reason ? { rating, reason } : { rating } });
  return res.status === 200;
}
