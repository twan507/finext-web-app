// finext-nextjs/app/login/page.tsx
'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from 'services/apiClient';
import { useAuth } from 'components/AuthProvider';

// MUI Components
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import GoogleIcon from '@mui/icons-material/Google';
import Divider from '@mui/material/Divider';

// Google OAuth
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

import ThemeToggleButton from 'components/ThemeToggleButton';
import { LoginResponse, UserSchema } from 'services/core/types';

interface UserInfo extends UserSchema {}

function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const router = useRouter();
  const { login, session, loading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!authLoading && session) {
      router.push('/');
    }
  }, [session, authLoading, router]);

  const handleTraditionalSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const loginParams = new URLSearchParams();
      loginParams.append('username', email);
      loginParams.append('password', password);
      const loginStandardResponse = await apiClient<LoginResponse>({
        url: '/api/v1/auth/login',
        method: 'POST',
        body: loginParams,
        isUrlEncoded: true,
        requireAuth: false,
        withCredentials: true,
      });
      if (loginStandardResponse.status === 200 && loginStandardResponse.data?.access_token) {
        const { access_token } = loginStandardResponse.data;
        const tempHeaders = { 'Authorization': `Bearer ${access_token}` };
        const userResponse = await apiClient<UserInfo>({ url: '/api/v1/auth/me', method: 'GET', headers: tempHeaders });
        const featuresResponse = await apiClient<string[]>({ url: '/api/v1/auth/me/features', method: 'GET', headers: tempHeaders });
        if (userResponse.status === 200 && userResponse.data && featuresResponse.status === 200) {
          const sessionData = { user: userResponse.data, accessToken: access_token, features: featuresResponse.data || [] };
          login(sessionData);
          setSuccessMessage(`Đăng nhập thành công! Đang chuyển hướng...`);
        } else {
          setError((userResponse.message || 'Lỗi lấy thông tin user.') + (featuresResponse.message || ' Lỗi lấy features.'));
        }
      } else {
        setError(loginStandardResponse.message || 'Đăng nhập thất bại.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối hoặc có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  // ĐỊNH NGHĨA URI CHO FRONTEND NHẬN CODE TỪ GOOGLE
  // URI này PHẢI được đăng ký trong "Authorized redirect URIs" trên Google Cloud Console
  const frontendGoogleRedirectUri = typeof window !== 'undefined' 
                                    ? window.location.origin + "/auth/google/callback" 
                                    : "http://localhost:3000/auth/google/callback";
  
  // Hàm handleGoogleLoginSuccess không còn được dùng trong useGoogleLogin nếu dùng flow redirect
  // Nó sẽ được gọi bởi trang /auth/google/callback/page.tsx
  // Tuy nhiên, chúng ta vẫn giữ nó ở đây để bạn có thể dễ dàng chuyển đổi lại nếu cần test flow onSuccess trực tiếp
  // (nhưng với flow onSuccess trực tiếp, bạn có thể gặp lại vấn đề redirect_uri_mismatch với `storagerelay`)
  /*
  const handleGoogleLoginSuccess = async (codeResponse: any) => {
    setGoogleLoading(true);
    setError(null);
    setSuccessMessage(null);
    console.log('Google Login Success, code received by frontend:', codeResponse.code);
    console.log('Frontend redirect URI used to get this code (expected):', frontendGoogleRedirectUri);

    try {
      const googleLoginResponse = await apiClient<LoginResponse>({
        url: '/api/v1/auth/google/callback', // Backend endpoint
        method: 'POST',
        body: {
          code: codeResponse.code,
          redirect_uri: frontendGoogleRedirectUri, // Gửi URI mà frontend đã dùng để lấy code
        },
        requireAuth: false,
        withCredentials: true,
      });
      
      if (googleLoginResponse.status === 200 && googleLoginResponse.data?.access_token) {
        const { access_token } = googleLoginResponse.data;
        const tempHeaders = { 'Authorization': `Bearer ${access_token}` };
        const userResponse = await apiClient<UserInfo>({ url: '/api/v1/auth/me', method: 'GET', headers: tempHeaders });
        const featuresResponse = await apiClient<string[]>({ url: '/api/v1/auth/me/features', method: 'GET', headers: tempHeaders });
        if (userResponse.status === 200 && userResponse.data && featuresResponse.status === 200) {
          const sessionData = { user: userResponse.data, accessToken: access_token, features: featuresResponse.data || [] };
          login(sessionData);
          setSuccessMessage('Đăng nhập bằng Google thành công! Đang chuyển hướng...');
        } else {
           setError((userResponse.message || 'Lỗi lấy thông tin user.') + (featuresResponse.message || ' Lỗi lấy features.'));
        }
      } else {
        setError(googleLoginResponse.message || 'Đăng nhập bằng Google thất bại từ phía server.');
      }
    } catch (err: any) {
      console.error('Google login API call error:', err);
      setError(err.message || 'Lỗi khi đăng nhập bằng Google.');
    } finally {
      setGoogleLoading(false);
    }
  };
  */

  const googleLogin = useGoogleLogin({
    // Bỏ onSuccess và onError ở đây để kích hoạt luồng redirect đầy đủ
    flow: 'auth-code',
    redirect_uri: frontendGoogleRedirectUri, // Google sẽ redirect về đây với code trong URL params
    ux_mode: 'redirect', // Đảm bảo UX là redirect, không phải popup
                            // Nếu không set, có thể mặc định là 'popup' dẫn đến vấn đề `storagerelay`
                            // Tuy nhiên, với `redirect_uri` được set, `flow: 'auth-code'` thường sẽ ưu tiên redirect.
                            // Nếu vẫn gặp popup `storagerelay`, hãy thử thêm `ux_mode: 'redirect'`
  });

  if (!mounted || authLoading || (!authLoading && session)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container component="main" maxWidth="xs" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <CssBaseline />
      <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
        <ThemeToggleButton />
      </Box>
      <Box
        sx={{
          marginTop: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          p: { xs: 2, sm: 3, md: 4 },
          borderRadius: 3,
          bgcolor: 'background.paper',
          boxShadow: { xs: 1, sm: 2, md: 3 },
          width: '100%',
        }}
      >
        <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component="h1" variant="h5">
          Đăng nhập
        </Typography>
        <Box component="form" onSubmit={handleTraditionalSubmit} noValidate sx={{ mt: 1, width: '100%' }}>
          {error && (
            <Alert severity="error" sx={{ width: '100%', mt: 1, mb: 1 }}>
              {error}
            </Alert>
          )}
          {successMessage && (
            <Alert severity="success" sx={{ width: '100%', mt: 1, mb: 1 }}>
              {successMessage}
            </Alert>
          )}
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Địa chỉ Email"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || googleLoading || !!successMessage}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Mật khẩu"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || googleLoading || !!successMessage}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading || googleLoading || !!successMessage}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Đăng nhập'}
          </Button>
          <Divider sx={{ my: 2 }}>HOẶC</Divider>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<GoogleIcon />}
            onClick={() => {
                setGoogleLoading(true); 
                try {
                    googleLogin(); 
                } catch (e) {
                    console.error("Error initiating Google login redirect", e);
                    setError("Không thể bắt đầu đăng nhập Google. Vui lòng thử lại.");
                    setGoogleLoading(false);
                }
            }}
            disabled={loading || googleLoading || !!successMessage}
            sx={{ mb: 2 }}
          >
            {googleLoading ? <CircularProgress size={24} /> : 'Đăng nhập với Google'}
          </Button>
        </Box>
      </Box>
    </Container>
  );
}

export default function SignInPage() {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    console.error("Google Client ID is not configured (NEXT_PUBLIC_GOOGLE_CLIENT_ID).");
  }
  return googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>
      <SignInForm />
    </GoogleOAuthProvider>
  ) : (
    <SignInForm />
  );
}