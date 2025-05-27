// finext-nextjs/app/services/core/session.ts
'use client';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone_number: string;
  role_ids: string[];
}

export interface SessionData {
  accessToken: string;
  user: User;
}

const SESSION_KEY = 'finext-session';

export function saveSession(sessionData: SessionData): void {
  if (typeof window !== 'undefined') {
    const dataToSave = {
        user: sessionData.user,
        // accessToken: sessionData.accessToken,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(dataToSave));
  }
}

export function getSession(): SessionData | null {
  if (typeof window !== 'undefined') {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    if (sessionStr) {
      try {
        return JSON.parse(sessionStr) as SessionData;
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

// Hàm cập nhật chỉ accessToken (hữu ích khi refresh)
export function updateAccessToken(accessToken: string): void {
    const session = getSession();
    if (session && typeof window !== 'undefined') {
        const newSession = { ...session, accessToken };
        localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    }
}