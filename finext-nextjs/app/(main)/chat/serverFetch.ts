// Server-side fetch câu hỏi gợi ý. Dùng native fetch (KHÔNG apiClient — apiClient là
// client-only và cần session). Lấy ở server để gợi ý nằm sẵn trong HTML lần paint đầu:
// không chớp, không nhảy layout.
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface StandardApiResponse<T> {
    status: number;
    message?: string;
    data: T;
}

/**
 * 5 câu hỏi gợi ý hiện tại. Backend luôn trả về bộ dùng được (có fallback tĩnh),
 * nên chỉ cần xử lý đúng trường hợp gọi hỏng → trả mảng rỗng, UI ẩn khu vực gợi ý.
 * no-store: backend bốc NGẪU NHIÊN 5 câu từ kho ~10 câu mỗi lần gọi, nên cache lại sẽ
 * đóng băng đúng một tổ hợp và mất hẳn cảm giác mới. Payload chỉ vài trăm byte đi qua
 * mạng nội bộ Docker nên bỏ cache gần như không tốn gì, đổi lại mỗi lượt vào là một
 * tổ hợp khác. Vẫn render phía server nên gợi ý có sẵn trong HTML lần paint đầu.
 */
export async function fetchChatSuggestions(): Promise<string[]> {
    try {
        const res = await fetch(`${INTERNAL_API_URL}/api/v1/sse/rest/chat_suggestions`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return [];
        const json: StandardApiResponse<{ questions?: string[] }> = await res.json();
        const questions = json?.data?.questions;
        return Array.isArray(questions) ? questions : [];
    } catch {
        // Backend chết không được làm hỏng trang chat.
        return [];
    }
}
