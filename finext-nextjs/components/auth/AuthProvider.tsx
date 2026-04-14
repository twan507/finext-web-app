// finext-nextjs/components/AuthProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
// User type ở đây sẽ là User từ session.ts, đã được cập nhật
import { getSession, clearSession, SessionData, saveSession as saveSessionToStorage, getAccessToken } from 'services/core/session';
import { apiClient, clearApiCache } from 'services/apiClient';
import { clearCache as clearSseCache, closeAllConnections as closeAllSseConnections } from 'services/sseClient';
import { logoutApi } from 'services/authService';
// UserSchema cũng cần được import nếu bạn dùng nó trực tiếp ở đây
import { UserSchema } from 'services/core/types';
import { isAuthError, safeLogError } from 'utils/errorHandler';
import { useNotification } from '../provider/NotificationProvider';


interface AuthContextType {
  session: SessionData | null;
  features: string[];
  permissions: string[];
  login: (sessionData: SessionData) => void;
  logout: () => void;
  loading: boolean;
  hasFeature: (featureKey: string) => boolean;
  hasPermission: (permKey: string) => boolean;
  // THÊM: Hàm để cập nhật session từ bên ngoài (ví dụ khi subscription thay đổi)
  refreshSessionData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [features, setFeatures] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { showNotification } = useNotification();

  // Dùng ref cho showNotification để tránh stale closure trong useCallback
  const showNotificationRef = useRef(showNotification);
  useEffect(() => {
    showNotificationRef.current = showNotification;
  }, [showNotification]);

  /**
   * Fetch session data từ API.
   * Dựa hoàn toàn vào apiClient._sendRequestWithRefresh() để xử lý 401 + refresh token.
   * KHÔNG tự gọi /refresh-token ở đây để tránh race condition.
   * 
   * @param silent - Nếu true, không hiển thị notification khi gặp lỗi auth (dùng khi app khởi động)
   */
  const fetchAndSetSessionData = useCallback(async (existingToken?: string | null, silent: boolean = false) => {
    setLoading(true);
    try {
      // Nếu không có token hiện tại, thử lấy từ session storage
      const tokenToUse = existingToken || getAccessToken();
      if (!tokenToUse) {
        // Không có token → user chưa đăng nhập, không cần báo lỗi
        clearSession();
        setSession(null);
        setFeatures([]);
        setPermissions([]);
        return;
      }

      // apiClient đã tự động thêm token vào header và xử lý refresh nếu cần
      const [userResponse, featuresResponse, permissionsResponse] = await Promise.all([
        apiClient<UserSchema>({ url: '/api/v1/auth/me', method: 'GET' }),
        apiClient<string[]>({ url: '/api/v1/auth/me/features', method: 'GET' }),
        apiClient<string[]>({ url: '/api/v1/auth/me/permissions', method: 'GET' }),
      ]);

      if (userResponse.status === 200 && userResponse.data && featuresResponse.status === 200 && permissionsResponse.status === 200) {
        // Lấy token hiện tại từ localStorage (có thể đã được refresh bởi apiClient)
        const currentToken = getAccessToken() || tokenToUse;
        const newSessionData: SessionData = {
          user: userResponse.data,
          accessToken: currentToken,
          features: featuresResponse.data || [],
          permissions: permissionsResponse.data || [],
        };
        saveSessionToStorage(newSessionData);
        setSession(newSessionData);
        setFeatures(newSessionData.features);
        setPermissions(newSessionData.permissions);
      } else {
        throw new Error(userResponse.message || featuresResponse.message || "Failed to fetch user/features data.");
      }
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        safeLogError(error, 'AuthProvider.fetchAndSetSessionData');
      }

      // apiClient đã tự xử lý refresh token khi gặp 401.
      // Nếu vẫn đến đây với lỗi auth → refresh cũng đã thất bại → session thực sự hết hạn.
      if (isAuthError(error)) {
        // Clear session vì refresh token cũng đã fail (apiClient đã clearSession rồi, nhưng đảm bảo state React cũng được clear)
        clearSession();
        setSession(null);
        setFeatures([]);
        setPermissions([]);

        // Chỉ hiển thị notification nếu KHÔNG phải silent mode
        // Silent mode dùng khi app khởi động: nếu token hết hạn → im lặng, user tự đăng nhập lại
        if (!silent) {
          showNotificationRef.current('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'warning');
        }
      } else {
        // Lỗi khác (network, server, etc.) — giữ session cũ nếu có, chỉ log lỗi
        // Không clear session vì có thể chỉ là lỗi tạm thời
        if (!silent) {
          showNotificationRef.current('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.', 'error');
        }
      }
    } finally {
      setLoading(false);
    }
  }, []); // Không cần dependency vì dùng ref cho showNotification


  const refreshSessionData = useCallback(async () => {
    await fetchAndSetSessionData();
  }, [fetchAndSetSessionData]);


  useEffect(() => {
    const initialCheck = async () => {
      const savedSession = getSession();
      if (savedSession && savedSession.accessToken) {
        // Silent mode = true: nếu token hết hạn, im lặng clear session
        // Không hiển thị notification "phiên hết hạn" khi mới vào trang
        await fetchAndSetSessionData(savedSession.accessToken, true);
      } else {
        setSession(null);
        setFeatures([]);
        setPermissions([]);
        setLoading(false); // Quan trọng: set loading false nếu không có session
      }
    };
    initialCheck();
  }, [fetchAndSetSessionData]); // fetchAndSetSessionData là dependency

  const logout = useCallback(async () => {
    setLoading(true);
    closeAllSseConnections(); // Đóng TẤT CẢ SSE EventSource connections trước
    await logoutApi(); // Backend sẽ xóa HttpOnly cookie
    clearSession(); // Frontend xóa localStorage
    clearApiCache(); // Xóa toàn bộ API cache trong memory
    clearSseCache(); // Xóa toàn bộ SSE cache trong memory
    setSession(null);
    setFeatures([]);
    setPermissions([]);
    setLoading(false);
    router.push('/'); // Chuyển về trang chủ mượt mà với Next.js router
  }, [router]);

  const login = useCallback((sessionData: SessionData) => {
    closeAllSseConnections(); // Đóng SSE connections cũ trước khi login tài khoản mới
    clearApiCache(); // Xóa cache API cũ khi đăng nhập tài khoản mới
    clearSseCache(); // Xóa cache SSE cũ khi đăng nhập tài khoản mới
    saveSessionToStorage(sessionData); // Lưu user (có subscription_id), accessToken, features
    setSession(sessionData);
    setFeatures(sessionData.features || []);
    setPermissions(sessionData.permissions || []);
    setLoading(false); // Sau khi login thành công, không còn loading
    // Không redirect ở đây - để caller (LoginForm, Google callback, etc.) tự xử lý redirect
    // Điều này cho phép các caller sử dụng callbackUrl hoặc window.location.href nếu cần
  }, []);

  const hasFeature = useCallback((featureKey: string): boolean => {
    return features.includes(featureKey);
  }, [features]);

  const hasPermission = useCallback((permKey: string): boolean => {
    return permissions.includes(permKey);
  }, [permissions]);

  return (
    <AuthContext.Provider value={{ session, features, permissions, login, logout, loading, hasFeature, hasPermission, refreshSessionData }}>
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