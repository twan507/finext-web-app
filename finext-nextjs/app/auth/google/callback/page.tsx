// finext-nextjs/app/auth/google/callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from 'components/AuthProvider';
import { apiClient } from 'services/apiClient';
import { LoginResponse, UserSchema } from 'services/core/types';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button'; // THÊM Button nếu chưa có

interface UserInfo extends UserSchema {}

export default function GoogleCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    console.log('GoogleCallbackPage: useEffect triggered.'); // Log khi effect chạy

    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      console.error('GoogleCallbackPage: Google OAuth error on callback URL:', errorParam);
      setError(`Lỗi từ Google: ${errorParam}. Vui lòng thử lại.`);
      setProcessing(false);
      return;
    }

    if (code) {
      console.log('GoogleCallbackPage: Received code:', code);
      setProcessing(true); // Đảm bảo set processing khi bắt đầu
      const frontendRedirectUri = window.location.origin + "/auth/google/callback";
      console.log('GoogleCallbackPage: Sending code to backend with redirect_uri:', frontendRedirectUri);

      apiClient<LoginResponse>({
        url: '/api/v1/auth/google/callback',
        method: 'POST',
        body: {
          code: code,
          redirect_uri: frontendRedirectUri,
        },
        requireAuth: false,
        withCredentials: true,
      })
      .then(async (googleLoginResponse) => {
        console.log('GoogleCallbackPage: Received response from backend:', googleLoginResponse);
        if (googleLoginResponse.status === 200 && googleLoginResponse.data?.access_token) {
          const { access_token } = googleLoginResponse.data;
          console.log('GoogleCallbackPage: Backend returned access_token:', access_token);
          const tempHeaders = { 'Authorization': `Bearer ${access_token}` };
          
          console.log('GoogleCallbackPage: Fetching /me from backend...');
          const userResponse = await apiClient<UserInfo>({ url: '/api/v1/auth/me', method: 'GET', headers: tempHeaders });
          console.log('GoogleCallbackPage: /me response:', userResponse);

          console.log('GoogleCallbackPage: Fetching /me/features from backend...');
          const featuresResponse = await apiClient<string[]>({ url: '/api/v1/auth/me/features', method: 'GET', headers: tempHeaders });
          console.log('GoogleCallbackPage: /me/features response:', featuresResponse);

          if (userResponse.status === 200 && userResponse.data && featuresResponse.status === 200) {
            const sessionData = { user: userResponse.data, accessToken: access_token, features: featuresResponse.data || [] };
            console.log('GoogleCallbackPage: Preparing to call login() with sessionData:', sessionData);
            login(sessionData);
            console.log('GoogleCallbackPage: login() called, AuthProvider should redirect.');
            // Không cần setProcessing(false) ở đây vì login() sẽ gây unmount/redirect
          } else {
            const errMsg = (userResponse.message || featuresResponse.message || 'Không thể lấy thông tin người dùng sau khi đăng nhập Google.');
            console.error('GoogleCallbackPage: Error fetching user/features:', errMsg);
            throw new Error(errMsg);
          }
        } else {
          const errMsg = googleLoginResponse.message || 'Đăng nhập Google thất bại từ server (không có access_token hoặc status không 200).';
          console.error('GoogleCallbackPage: Backend login failed:', errMsg, googleLoginResponse);
          throw new Error(errMsg);
        }
      })
      .catch((err: any) => {
        console.error('GoogleCallbackPage: Error during backend communication or subsequent calls:', err);
        setError(err.message || 'Lỗi khi xử lý đăng nhập Google với backend.');
        setProcessing(false);
      });
    } else {
      console.warn('GoogleCallbackPage: No authorization code found in URL.');
      setError('Không nhận được mã ủy quyền từ Google. Vui lòng thử lại.');
      setProcessing(false);
    }
  }, [searchParams, login, router]); // Bỏ `processing` khỏi dependencies nếu nó gây re-run không mong muốn

  if (processing) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Đang xử lý đăng nhập Google...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', p: 2 }}>
        <Alert severity="error" sx={{mb: 2}}>{error}</Alert>
        <Button variant="outlined" onClick={() => router.push('/login')}>
          Quay lại trang Đăng nhập
        </Button>
      </Box>
    );
  }

  // Nếu không processing và không có lỗi, AuthProvider (sau khi login) sẽ redirect
  // hoặc có thể render một thông báo thành công tạm thời nếu login() không redirect ngay
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography>Đăng nhập thành công, đang chuyển hướng...</Typography>
    </Box>
  );
}