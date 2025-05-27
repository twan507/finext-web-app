// finext-nextjs/components/AuthProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
// User type ở đây sẽ là User từ session.ts, đã được cập nhật
import { getSession, clearSession, SessionData, saveSession as saveSessionToStorage, updateAccessToken, User, getAccessToken } from 'services/core/session';
import { apiClient } from 'services/apiClient';
import { logoutApi } from 'services/authService';
// UserSchema cũng cần được import nếu bạn dùng nó trực tiếp ở đây
import { LoginResponse, UserSchema } from 'services/core/types';


interface AuthContextType {
  session: SessionData | null;
  features: string[];
  login: (sessionData: SessionData) => void;
  logout: () => void;
  loading: boolean;
  hasFeature: (featureKey: string) => boolean;
  // THÊM: Hàm để cập nhật session từ bên ngoài (ví dụ khi subscription thay đổi)
  refreshSessionData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [features, setFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchAndSetSessionData = useCallback(async (existingToken?: string | null) => {
    setLoading(true);
    try {
      // Nếu không có token hiện tại, thử lấy từ session storage
      const tokenToUse = existingToken || getAccessToken();
      if (!tokenToUse) {
          throw new Error("No access token available for fetching session data.");
      }

      // API Client đã tự động thêm token vào header nếu có
      const userResponse = await apiClient<UserSchema>({ url: '/api/v1/auth/me', method: 'GET' });
      const featuresResponse = await apiClient<string[]>({ url: '/api/v1/auth/me/features', method: 'GET' });

      if (userResponse.status === 200 && userResponse.data && featuresResponse.status === 200) {
        const newSessionData: SessionData = {
          user: userResponse.data, // userResponse.data giờ sẽ có subscription_id
          accessToken: tokenToUse, // Sử dụng token đang dùng để fetch
          features: featuresResponse.data || [],
        };
        saveSessionToStorage(newSessionData);
        setSession(newSessionData);
        setFeatures(newSessionData.features);
      } else {
        // Xử lý lỗi cụ thể hơn nếu cần
        throw new Error(userResponse.message || featuresResponse.message || "Failed to fetch user/features data.");
      }
    } catch (error: any) {
      console.error("Error fetching session data:", error);
      // Nếu lỗi là 401 và không phải lỗi từ refresh-token
      if (error?.statusCode === 401 && !error.message?.includes('refresh-token')) {
        try {
          const refreshTokenResponse = await apiClient<LoginResponse>({
            url: '/api/v1/auth/refresh-token',
            method: 'POST',
            requireAuth: false, // Không yêu cầu access token
            withCredentials: true, // Gửi cookie
          });

          if (refreshTokenResponse.data?.access_token) {
            updateAccessToken(refreshTokenResponse.data.access_token);
            // Gọi lại fetchAndSetSessionData với token mới
            await fetchAndSetSessionData(refreshTokenResponse.data.access_token);
            return; // Thoát sớm để tránh setLoading(false) hai lần
          } else {
            // Refresh thất bại, xóa session
            clearSession();
            setSession(null);
            setFeatures([]);
            // Không redirect ở đây, để useEffect xử lý
          }
        } catch (refreshError) {
          console.error("Refresh token failed during session data fetch:", refreshError);
          clearSession();
          setSession(null);
          setFeatures([]);
        }
      } else if (error?.statusCode !== 401) { // Chỉ xóa session nếu lỗi không phải 401 (401 đã được xử lý bằng refresh)
        // Có thể chỉ là lỗi mạng, không nên xóa session vội
        // clearSession();
        // setSession(null);
        // setFeatures([]);
         console.warn("Non-401 error during session fetch, session not cleared:", error.message)
      }
    } finally {
      setLoading(false);
    }
  }, []);


  const refreshSessionData = useCallback(async () => {
      await fetchAndSetSessionData();
  }, [fetchAndSetSessionData]);


  useEffect(() => {
    const initialCheck = async () => {
        const savedSession = getSession();
        if (savedSession && savedSession.accessToken) {
            // Thay vì chỉ setSession, gọi fetchAndSetSessionData để xác thực và lấy dữ liệu mới nhất
            await fetchAndSetSessionData(savedSession.accessToken);
        } else {
            setSession(null);
            setFeatures([]);
            setLoading(false); // Quan trọng: set loading false nếu không có session
        }
    };
    initialCheck();
  }, [fetchAndSetSessionData]); // fetchAndSetSessionData là dependency

  const logout = useCallback(async () => {
    setLoading(true);
    await logoutApi(); // Backend sẽ xóa HttpOnly cookie
    clearSession(); // Frontend xóa localStorage
    setSession(null);
    setFeatures([]);
    setLoading(false);
    // router.push('/login'); // Middleware sẽ xử lý redirect
  }, []);

  const login = useCallback((sessionData: SessionData) => {
    saveSessionToStorage(sessionData); // Lưu user (có subscription_id), accessToken, features
    setSession(sessionData);
    setFeatures(sessionData.features || []);
    setLoading(false); // Sau khi login thành công, không còn loading
    router.push('/');
  }, [router]);

  const hasFeature = useCallback((featureKey: string): boolean => {
      return features.includes(featureKey);
  }, [features]);

  return (
    <AuthContext.Provider value={{ session, features, login, logout, loading, hasFeature, refreshSessionData }}>
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