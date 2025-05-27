// finext-nextjs/app/services/core/session.ts
'use client';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone_number: string;
  role_ids: string[];
  // THÊM license_info vào User nếu cần hiển thị, nhưng thường không cần
}

export interface SessionData {
  accessToken: string;
  user: User;
  features: string[]; // THÊM DÒNG NÀY
}

const SESSION_KEY = 'finext-session';

export function saveSession(sessionData: SessionData): void {
  if (typeof window !== 'undefined') {
    // Lưu cả user, accessToken và features
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  }
}

export function getSession(): SessionData | null {
  if (typeof window !== 'undefined') {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (sessionStr) {
      try {
        // Đảm bảo parse đúng cấu trúc SessionData mới
        const parsed = JSON.parse(sessionStr) as SessionData;
        // Đảm bảo features là một mảng, nếu không thì trả về mảng rỗng
        parsed.features = Array.isArray(parsed.features) ? parsed.features : [];
        return parsed;
      } catch {
        clearSession();
        return null;
      }
    }
  }
  return null;
}

export function clearSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function getAccessToken(): string | null {
  const session = getSession();
  return session?.accessToken || null;
}

export function getFeatures(): string[] { // THÊM HÀM NÀY
  const session = getSession();
  return session?.features || [];
}

// Hàm cập nhật chỉ accessToken (hữu ích khi refresh)
export function updateAccessToken(accessToken: string): void {
    const session = getSession();
    if (session && typeof window !== 'undefined') {
        const newSession = { ...session, accessToken };
        localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    }
}

// THÊM HÀM CẬP NHẬT FEATURES (NẾU CẦN REFETCH)
export function updateFeatures(features: string[]): void {
    const session = getSession();
    if (session && typeof window !== 'undefined') {
        const newSession = { ...session, features };
        localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    }
}