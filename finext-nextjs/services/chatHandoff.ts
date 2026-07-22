// Bàn giao câu hỏi từ popup quảng bá Finext AI (trang chủ) sang trang /chat.
// Popup ghi câu hỏi user gõ vào sessionStorage rồi điều hướng; trang /chat đọc lại và gửi giúp.
//
// Vì sao sessionStorage (không phải localStorage): bàn giao chỉ có hiệu lực trong CHÍNH tab đang
// thao tác — mở tab khác không vô tình gửi lại câu cũ. Pattern try/catch giống useTeaserCycle:
// chế độ riêng tư chặn storage thì coi như không có gì, không phải lỗi chặn luồng.

const HANDOFF_KEY = 'finext_ai_popup_draft';

export function writeChatHandoff(text: string): void {
  try {
    sessionStorage.setItem(HANDOFF_KEY, text);
  } catch {
    // storage bị chặn → bỏ qua
  }
}

export function readChatHandoff(): string | null {
  try {
    return sessionStorage.getItem(HANDOFF_KEY);
  } catch {
    return null;
  }
}

export function clearChatHandoff(): void {
  try {
    sessionStorage.removeItem(HANDOFF_KEY);
  } catch {
    // không xoá được thì thôi
  }
}
