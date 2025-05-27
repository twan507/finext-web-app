// finext-nextjs/components/AuthProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, clearSession, SessionData, saveSession as saveSessionToStorage, updateAccessToken } from 'services/core/session'; // THÊM updateAccessToken
import { apiClient } from 'services/apiClient';
import { logoutApi } from 'services/authService';

interface AuthContextType {
  session: SessionData | null;
  features: string[]; // THÊM features
  login: (sessionData: SessionData) => void;
  logout: () => void;
  loading: boolean;
  hasFeature: (featureKey: string) => boolean; // THÊM hàm kiểm tra feature
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [features, setFeatures] = useState<string[]>([]); // THÊM state features
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Hàm fetch features
  const fetchFeatures = useCallback(async () => {
      try {
          const response = await apiClient<string[]>({
              url: '/api/v1/auth/me/features',
              method: 'GET',
          });
          if (response.status === 200 && response.data) {
              setFeatures(response.data);
              // Cập nhật session trong localStorage nếu cần (tùy chọn)
              const currentSession = getSession();
              if (currentSession) {
                  saveSessionToStorage({ ...currentSession, features: response.data });
              }
              return response.data;
          } else {
              console.warn("Failed to fetch features:", response.message);
              setFeatures([]);
              return [];
          }
      } catch (error) {
          console.error("Error fetching features:", error);
          setFeatures([]);
          return [];
      }
  }, []);


  useEffect(() => {
    const checkSession = async () => {
      setLoading(true);
      const savedSession = getSession();

      if (savedSession && savedSession.accessToken) {
        try {
          // Gắn token vào apiClient để gọi /me và /me/features
          // (apiClient đã tự động làm việc này nếu token có trong session)
          await apiClient({ url: '/api/v1/auth/me', method: 'GET' });
          await fetchFeatures(); // Gọi fetchFeatures sau khi xác thực /me thành công
          setSession(savedSession); // Set lại session để đảm bảo nó là mới nhất từ localStorage
          setFeatures(savedSession.features || []); // Set features từ session đã lưu
        } catch (error: any) {
          console.error("Initial session check failed:", error);
          if (error?.statusCode === 401) {
              // Thử refresh token
              try {
                  const newAccessToken = await apiClient({ url: '/api/v1/auth/refresh-token', method: 'POST', requireAuth: false, withCredentials: true }); // Giả sử apiClient có thể xử lý refresh
                  if (newAccessToken && newAccessToken.data?.access_token) {
                      updateAccessToken(newAccessToken.data.access_token);
                      // Thử lại /me và /me/features
                      await apiClient({ url: '/api/v1/auth/me', method: 'GET' });
                      await fetchFeatures();
                      setSession(getSession()); // Lấy session mới nhất sau khi refresh
                  } else {
                      clearSession();
                      setSession(null);
                      setFeatures([]);
                  }
              } catch (refreshError) {
                  console.error("Refresh token failed during initial check:", refreshError);
                  clearSession();
                  setSession(null);
                  setFeatures([]);
              }
          } else {
            setSession(savedSession);
            setFeatures(savedSession.features || []);
          }
        }
      } else {
          setSession(null);
          setFeatures([]);
      }
      setLoading(false);
    };
    checkSession();
  }, [fetchFeatures]);

  const logout = useCallback(async () => {
    await logoutApi();
    setSession(null);
    setFeatures([]); // Reset features khi logout
  }, []);

  const login = useCallback((sessionData: SessionData) => {
    saveSessionToStorage(sessionData); // Lưu cả user, accessToken và features
    setSession(sessionData);
    setFeatures(sessionData.features || []);
  }, []);

  // Hàm kiểm tra feature
  const hasFeature = useCallback((featureKey: string): boolean => {
      return features.includes(featureKey);
  }, [features]);

  return (
    <AuthContext.Provider value={{ session, features, login, logout, loading, hasFeature }}>
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