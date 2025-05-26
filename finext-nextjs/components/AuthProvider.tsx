// finext-nextjs/components/AuthProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, clearSession, SessionData, saveSession as saveSessionToStorage } from 'services/core/session';
import { apiClient } from 'services/apiClient';
import { logoutApi } from 'services/authService'; // Import logoutApi

interface AuthContextType {
  session: SessionData | null;
  login: (sessionData: SessionData) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter(); // Giữ router ở đây

  useEffect(() => {
    const checkSession = async () => {
      setLoading(true);
      const savedSession = getSession();

      if (savedSession) {
        try {
          await apiClient({ url: '/api/v1/auth/me', method: 'GET' });
          setSession(savedSession);
        } catch (error: any) {
          console.error("Initial session check failed:", error);
          // Chỉ xóa session nếu lỗi là 401 (Unauthorized)
          if (error?.statusCode === 401) {
            clearSession();
            setSession(null);
            // Không cần router.push ở đây, để các component tự xử lý
          } else {
            // Nếu lỗi khác (VD: mạng), có thể giữ session và thử lại sau
            setSession(savedSession); // Hoặc set null tùy chiến lược
          }
        }
      }
      setLoading(false);
    };
    checkSession();
  }, []);

  // Logout sẽ gọi API và sau đó xóa session + chuyển hướng
  const logout = useCallback(async () => {
    await logoutApi(); // Gọi API để xóa cookie, hàm này sẽ tự xóa localStorage và redirect
    setSession(null); // Cập nhật state nội bộ
  }, []);

  const login = useCallback((sessionData: SessionData) => {
    // Chỉ lưu user và accessToken
    const dataToSave = {
      user: sessionData.user,
      accessToken: sessionData.accessToken,
    };
    saveSessionToStorage(dataToSave);
    setSession(dataToSave);
  }, []);

  return (
    <AuthContext.Provider value={{ session, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}