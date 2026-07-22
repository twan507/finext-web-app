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
 * revalidate 300s: cron sinh mỗi 30 phút nên user thấy bộ mới trong vòng 5 phút.
 */
export async function fetchChatSuggestions(): Promise<string[]> {
    try {
        const res = await fetch(`${INTERNAL_API_URL}/api/v1/sse/rest/chat_suggestions`, {
            next: { revalidate: 300 },
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
