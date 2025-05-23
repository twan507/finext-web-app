// finext-nextjs/@/components/AuthProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react'; // Thêm useCallback
import { useRouter } from 'next/navigation';
// Đổi tên saveSession thành saveSessionToStorage để tránh nhầm lẫn
import { getSession, clearSession, SessionData, saveSession as saveSessionToStorage } from 'lib/session';
import { apiClient } from 'lib/apiClient';

interface AuthContextType {
  session: SessionData | null;
  login: (sessionData: SessionData) => void; // <--- THÊM HÀM LOGIN
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load session lần đầu
  useEffect(() => {
    const checkSession = async () => {
      setLoading(true);
      const savedSession = getSession();

      if (savedSession) {
        try {
          // Chỉ cần gọi /auth/me để xác thực token
          await apiClient({
            url: '/auth/me',
            method: 'GET',
          });
          setSession(savedSession); // Nếu thành công, set session
        } catch (error) {
          console.error("Xác thực session ban đầu thất bại:", error);
          clearSession(); // Nếu thất bại, xóa session
          setSession(null);
        }
      }
      setLoading(false);
    };

    checkSession();
  }, []); // Chỉ chạy 1 lần khi mount

  const logout = useCallback(() => {
    clearSession();
    setSession(null); // Cập nhật state
    router.push('/login');
  }, [router]);

  // Hàm login mới để cập nhật state
  const login = useCallback((sessionData: SessionData) => {
    saveSessionToStorage(sessionData); // Lưu vào localStorage
    setSession(sessionData); // Cập nhật state
  }, []);

  return (
    // Cung cấp hàm login qua context
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