'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, clearSession, SessionData } from '@/lib/session';
import { apiClient } from '@/lib/apiClient';

interface AuthContextType {
  session: SessionData | null;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const savedSession = getSession();
      
      if (savedSession) {
        try {
          // Verify token còn hợp lệ không bằng cách gọi /auth/me
          const response = await apiClient({
            url: '/auth/me',
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${savedSession.accessToken}`,
            },
            requireAuth: false,
          });

          if (response.status === 200) {
            setSession(savedSession);
          } else {
            // Token không hợp lệ, xóa session
            clearSession();
            setSession(null);
          }
        } catch (error) {
          // Token không hợp lệ, xóa session
          clearSession();
          setSession(null);
        }
      }
      setLoading(false);
    };

    checkSession();
  }, []);

  const logout = () => {
    clearSession();
    setSession(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ session, logout, loading }}>
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