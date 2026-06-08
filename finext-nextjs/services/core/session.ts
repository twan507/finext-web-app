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
  permissions: string[];
}

const SESSION_KEY = 'finext-session';

// Non-HttpOnly cookie do FE tự set, chỉ là flag "đang có session" để middleware
// nhận biết. Cần thiết khi FE & BE khác origin (dev: :3000 vs :8000) — refresh
// cookie HttpOnly set bởi BE không gửi qua request sang FE origin, middleware
// không thấy. Cookie này không chứa data nhạy cảm, auth thật vẫn enforce ở BE.
const SESSION_FLAG_COOKIE = 'finext_session_active';
const SESSION_FLAG_MAX_AGE = 7 * 24 * 60 * 60; // 7 ngày, khớp REFRESH_TOKEN_EXPIRE_DAYS

function setSessionFlagCookie(): void {
  if (typeof document === 'undefined') return;
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  document.cookie = `${SESSION_FLAG_COOKIE}=1; path=/; max-age=${SESSION_FLAG_MAX_AGE}; samesite=lax${isSecure ? '; secure' : ''}`;
}

function clearSessionFlagCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_FLAG_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function saveSession(sessionData: SessionData): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    setSessionFlagCookie();
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
        parsed.permissions = Array.isArray(parsed.permissions) ? parsed.permissions : [];
        // Refresh flag cookie để middleware tiếp tục pass khi session vẫn còn
        // (cần thiết nếu cookie expired sớm hơn localStorage).
        setSessionFlagCookie();
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
    clearSessionFlagCookie();
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

export function getPermissions(): string[] {
  const session = getSession();
  return session?.permissions || [];
}

export function updateAccessToken(accessToken: string): void {
    if (typeof window === 'undefined') return;
    const session = getSession();
    if (session) {
        const newSession = { ...session, accessToken };
        localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    } else {
        // Session không tồn tại, có thể đã bị clear bởi tab khác
        // Log warning nhưng không crash — caller sẽ xử lý tạo session mới khi cần
        console.warn('[Session] updateAccessToken called but no session found in localStorage. Token not saved.');
    }
}

export function updateFeatures(features: string[]): void {
    const session = getSession();
    if (session && typeof window !== 'undefined') {
        const newSession = { ...session, features };
        localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    }
}

export function updatePermissions(permissions: string[]): void {
    const session = getSession();
    if (session && typeof window !== 'undefined') {
        const newSession = { ...session, permissions };
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