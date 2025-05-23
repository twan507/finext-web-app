'use client';

export interface User {
  id: string;
  email: string;
  full_name?: string;
}

export interface SessionData {
  user: User;
  accessToken: string;
  refreshToken?: string;
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
        return JSON.parse(sessionStr) as SessionData;
      } catch {
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