import { sendStreamRequest } from './apiClient';

export type ChatEvent =
  | { type: 'meta'; conversation_id: string; message_id: string; as_of: string | null }
  | { type: 'token'; text: string }
  | { type: 'tool_start'; name: string; label: string }
  | { type: 'tool_end'; name: string; ok: boolean; ms: number }
  | { type: 'title'; conversation_id: string; title: string }
  | { type: 'message_saved'; message_id: string }
  | { type: 'done'; usage: Record<string, number>; truncated: boolean }
  // Cảnh báo sớm hạn mức (50%/75%) — chỉ nhắc, KHÔNG chặn; user vẫn chat tiếp được.
  | { type: 'quota_warn'; threshold: number; window: 'session' | 'week'; message: string }
  // BE đang bận trả lời câu trước → câu này đã xếp hàng (chưa chạy). FE hiện "đang suy nghĩ" + poll DB.
  | { type: 'queued'; conversation_id: string; message: string }
  | { type: 'error'; message: string };

export interface ChatStreamBody {
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  conversation_id?: string;
  thinking?: boolean; // true = M3 suy nghĩ sâu (adaptive) — backend nhận, default false
  page_context?: string; // ngữ cảnh trang (bubble chat) — không hiển thị cho user, không lưu lịch sử
}

const KNOWN_TYPES = new Set(['meta', 'token', 'tool_start', 'tool_end', 'title', 'message_saved', 'done', 'quota_warn', 'queued', 'error']);

function parseFrame(frame: string): ChatEvent | null {
  // Mỗi frame là các dòng; lấy dòng bắt đầu 'data: '. Comment ': hb' → bỏ qua (không có data:).
  for (const line of frame.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    try {
      const obj = JSON.parse(payload);
      if (obj && typeof obj.type === 'string' && KNOWN_TYPES.has(obj.type)) {
        return obj as ChatEvent;
      }
    } catch {
      // frame hỏng — bỏ qua, không phá stream
    }
  }
  return null;
}

/** Stream chat từ backend. Ném lỗi khi abort (signal) hoặc network — store bắt để giữ text + Thử lại. */
export async function* streamChat(body: ChatStreamBody, signal: AbortSignal): AsyncGenerator<ChatEvent> {
  const res = await sendStreamRequest({
    url: '/api/v1/chat/stream',
    method: 'POST',
    body,
    nextOption: { signal },
  });
  if (!res.body) throw new Error('empty-stream-body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8'); // {stream:true} ở mỗi decode — an toàn multibyte tiếng Việt
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const ev = parseFrame(frame);
        if (ev) yield ev;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
