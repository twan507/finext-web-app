// finext-nextjs/app/services/core/session.ts
'use client';

// Import UserSchema từ types.ts
import { UserSchema } from './types';

// Sử dụng UserSchema đã được cập nhật
export interface User extends UserSchema {}

export interface SessionData {
  accessToken: string;
  user: User; // User ở đây sẽ có subscription_id
  features: string[];
}

const SESSION_KEY = 'finext-session';

export function saveSession(sessionData: SessionData): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  }
}

export function getSession(): SessionData | null {
  if (typeof window !== 'undefined') {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (sessionStr) {
      try {
        const parsed = JSON.parse(sessionStr) as SessionData;
        // Đảm bảo user object tồn tại và có cấu trúc cơ bản
        if (!parsed.user) {
            parsed.user = {} as User; // Khởi tạo rỗng nếu thiếu
        }
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

export function getFeatures(): string[] {
  const session = getSession();
  return session?.features || [];
}

export function updateAccessToken(accessToken: string): void {
    const session = getSession();
    if (session && typeof window !== 'undefined') {
        const newSession = { ...session, accessToken };
        localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    }
}

export function updateFeatures(features: string[]): void {
    const session = getSession();
    if (session && typeof window !== 'undefined') {
        const newSession = { ...session, features };
        localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    }
}

// THÊM: Hàm cập nhật thông tin user trong session (ví dụ sau khi user cập nhật profile)
// Hoặc khi subscription_id thay đổi và bạn muốn cập nhật user object trong localStorage
export function updateUserInSession(updatedUser: Partial<User>): void {
    const session = getSession();
    if (session && typeof window !== 'undefined') {
        const newSession = {
            ...session,
            user: {
                ...session.user,
                ...updatedUser,
            },
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    }
}