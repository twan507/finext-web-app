// finext-nextjs/app/auth/google/callback/PageContent.tsx
'use client';

import { useEffect, useState, Suspense, useCallback } from 'react'; // Thêm Suspense và useCallback
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { apiClient } from 'services/apiClient';
// SỬA: Đảm bảo UserSchema và LoginResponse được import đúng
import { LoginResponse, UserSchema } from 'services/core/types'; //
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container'; // Thêm Container

// Đổi tên interface
interface UserInfoFromGoogleCallback extends UserSchema { }

function GoogleCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login, session, loading: authLoading } = useAuth(); // Thêm session và authLoading
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hàm redirect sau khi đăng nhập thành công
  const redirectAfterLogin = useCallback(() => {
    if (isRedirecting) return;
    setIsRedirecting(true);
    // Sử dụng window.location.href để full page reload, đảm bảo middleware nhận được cookie
    window.location.href = '/';
  }, [isRedirecting]);

  useEffect(() => {
    // Chỉ chạy logic khi component đã mounted và authProvider không còn loading và chưa có session
    if (!mounted || authLoading || session) {
      if (session && !authLoading && !isRedirecting) { // Nếu đã có session và auth không loading, redirect
        redirectAfterLogin();
      }
      return;
    }

    console.log('GoogleCallbackPage: useEffect triggered for processing.');

    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    const errorDescriptionParam = searchParams.get('error_description');

    if (errorParam) {
      const displayError = errorDescriptionParam || errorParam;
      console.error('GoogleCallbackPage: Google OAuth error on callback URL:', displayError);
      setError(`Lỗi từ Google: ${displayError}. Vui lòng thử lại.`);
      setProcessing(false);
      return;
    }

    if (code) {
      console.log('GoogleCallbackPage: Received authorization code:', code);
      setProcessing(true); // Đảm bảo set processing khi bắt đầu
      // redirect_uri này phải chính xác là URI của trang callback này
      const frontendRedirectUriForBackend = window.location.origin + "/auth/google/callback";
      console.log('GoogleCallbackPage: Sending code to backend with redirect_uri:', frontendRedirectUriForBackend);

      apiClient<LoginResponse>({ //
        url: '/api/v1/auth/google/callback', // Backend endpoint
        method: 'POST',
        body: {
          code: code,
          redirect_uri: frontendRedirectUriForBackend, // Gửi URI mà frontend đã dùng
        },
        requireAuth: false, // Không yêu cầu auth cho callback
        withCredentials: true, // Để nhận HttpOnly cookie từ backend
      })
        .then(async (googleLoginResponse) => {
          console.log('GoogleCallbackPage: Received response from backend:', googleLoginResponse);
          if (googleLoginResponse.status === 200 && googleLoginResponse.data?.access_token) {
            const { access_token } = googleLoginResponse.data;
            console.log('GoogleCallbackPage: Backend returned access_token:', access_token);
            const tempHeaders = { 'Authorization': `Bearer ${access_token}` };

            console.log('GoogleCallbackPage: Fetching /me from backend...');
            const userResponse = await apiClient<UserInfoFromGoogleCallback>({ url: '/api/v1/auth/me', method: 'GET', headers: tempHeaders }); //
            console.log('GoogleCallbackPage: /me response:', userResponse);

            console.log('GoogleCallbackPage: Fetching /me/features from backend...');
            const featuresResponse = await apiClient<string[]>({ url: '/api/v1/auth/me/features', method: 'GET', headers: tempHeaders }); //
            console.log('GoogleCallbackPage: /me/features response:', featuresResponse);

            if (userResponse.status === 200 && userResponse.data && featuresResponse.status === 200) {
              const sessionData = {
                user: userResponse.data, // UserInfoFromGoogleCallback (UserSchema)
                accessToken: access_token,
                features: featuresResponse.data || []
              };
              console.log('GoogleCallbackPage: Preparing to call login() with sessionData:', sessionData);
              login(sessionData);
              console.log('GoogleCallbackPage: login() called, redirecting to home...');

              // Redirect về trang chủ sau khi đăng nhập thành công
              // Sử dụng window.location.href để full page reload, đảm bảo middleware nhận được cookie
              setTimeout(() => {
                window.location.href = '/';
              }, 100);
            } else {
              const errMsg = (userResponse.message || featuresResponse.message || 'Không thể lấy thông tin người dùng hoặc features sau khi đăng nhập Google.');
              console.error('GoogleCallbackPage: Error fetching user/features:', errMsg);
              throw new Error(errMsg); // Ném lỗi để catch bên dưới xử lý
            }
          } else {
            // Phân tích lỗi chi tiết hơn từ backend nếu có
            let backendErrorMessage = googleLoginResponse.message || 'Đăng nhập Google thất bại từ server.';
            if (googleLoginResponse.data && (googleLoginResponse.data as any).detail) {
              backendErrorMessage = (googleLoginResponse.data as any).detail;
            } else if (typeof googleLoginResponse.data === 'string') {
              backendErrorMessage = googleLoginResponse.data;
            }
            console.error('GoogleCallbackPage: Backend login failed:', backendErrorMessage, googleLoginResponse);
            throw new Error(backendErrorMessage); // Ném lỗi để catch bên dưới xử lý
          }
        })
        .catch((err: any) => {
          console.error('GoogleCallbackPage: Error during backend communication or subsequent calls:', err);
          let displayError = err.message || 'Lỗi khi xử lý đăng nhập Google với backend.';
          if (err.errorDetails && typeof err.errorDetails === 'string') {
            displayError = err.errorDetails;
          } else if (err.errorDetails && err.errorDetails.message && typeof err.errorDetails.message === 'string') {
            displayError = err.errorDetails.message;
          }
          setError(displayError);
          setProcessing(false);
        });
    } else if (!errorParam) { // Chỉ set lỗi nếu không có code và cũng không có errorParam từ URL
      console.warn('GoogleCallbackPage: No authorization code or error found in URL.');
      setError('Không nhận được thông tin ủy quyền từ Google. Vui lòng thử lại.');
      setProcessing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, login, router, mounted, authLoading, session, isRedirecting, redirectAfterLogin]); // Thêm mounted, authLoading, session vào dependencies

  if (!mounted || processing || authLoading || session || isRedirecting) {
    // Nếu đã có session, AuthProvider sẽ redirect, nhưng vẫn hiển thị loading ở đây cho đến khi redirect xảy ra
    return (
      <Container component="main" maxWidth="xs" sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>
          {session ? 'Đã đăng nhập, đang chuyển hướng...' : 'Đang xử lý đăng nhập Google, vui lòng chờ...'}
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container component="main" maxWidth="xs" sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', textAlign: 'center', p: 2 }}>
        <Alert severity="error" sx={{ mb: 2, width: '100%' }}>{error}</Alert>
        <Button variant="outlined" onClick={() => router.push('/login')}>
          Quay lại trang Đăng nhập
        </Button>
      </Container>
    );
  }

  // Trường hợp này không nên xảy ra nếu logic đúng, vì hoặc là processing, hoặc có lỗi, hoặc đã redirect
  return (
    <Container component="main" maxWidth="xs" sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', textAlign: 'center' }}>
      <Typography>Đang hoàn tất...</Typography>
    </Container>
  );
}

// Bọc GoogleCallbackContent bằng Suspense để xử lý việc useSearchParams()
export default function PageContent() {
  return (
    <Suspense fallback={
      <Container component="main" maxWidth="xs" sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Đang tải...</Typography>
      </Container>
    }>
      <GoogleCallbackContent />
    </Suspense>
  );
}