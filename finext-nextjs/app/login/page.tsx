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
// SỬA: Đảm bảo UserSchema và LoginResponse được import đúng từ types.ts
import { LoginResponse, UserSchema } from 'services/core/types'; //

// Đổi tên interface để tránh xung đột nếu UserSchema được dùng trực tiếp ở nơi khác
interface UserInfoFromAuth extends UserSchema {}

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
      const loginStandardResponse = await apiClient<LoginResponse>({ //
        url: '/api/v1/auth/login',
        method: 'POST',
        body: loginParams,
        isUrlEncoded: true,
        requireAuth: false, // Không yêu cầu auth cho login
        withCredentials: true, // Để gửi HttpOnly cookie (nếu backend có set)
      });
      if (loginStandardResponse.status === 200 && loginStandardResponse.data?.access_token) {
        const { access_token } = loginStandardResponse.data;
        const tempHeaders = { 'Authorization': `Bearer ${access_token}` };
        // Lấy thông tin user và features
        const userResponse = await apiClient<UserInfoFromAuth>({ url: '/api/v1/auth/me', method: 'GET', headers: tempHeaders }); //
        const featuresResponse = await apiClient<string[]>({ url: '/api/v1/auth/me/features', method: 'GET', headers: tempHeaders }); //

        if (userResponse.status === 200 && userResponse.data && featuresResponse.status === 200) {
          const sessionData = {
            user: userResponse.data, // UserInfoFromAuth (UserSchema)
            accessToken: access_token,
            features: featuresResponse.data || [],
          };
          login(sessionData); // Gọi hàm login từ AuthProvider
          setSuccessMessage(`Đăng nhập thành công! Đang chuyển hướng...`);
          // router.push('/'); // AuthProvider sẽ tự động redirect
        } else {
          setError((userResponse.message || 'Lỗi lấy thông tin user.') + (featuresResponse.message || ' Lỗi lấy features.'));
        }
      } else {
        setError(loginStandardResponse.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối hoặc có lỗi xảy ra trong quá trình đăng nhập.');
    } finally {
      setLoading(false);
    }
  };

  // URI này PHẢI được đăng ký trong "Authorized redirect URIs" trên Google Cloud Console
  // và cũng là URI mà backend sẽ sử dụng khi trao đổi code.
  const frontendGoogleRedirectUri = typeof window !== 'undefined'
                                    ? window.location.origin + "/auth/google/callback"
                                    : "http://localhost:3000/auth/google/callback"; // Fallback cho SSR hoặc môi trường không có window

  const initiateGoogleLogin = useGoogleLogin({
    flow: 'auth-code', // Sử dụng luồng authorization code
    redirect_uri: frontendGoogleRedirectUri, // Google sẽ redirect về đây với code
    // Không cần onSuccess hay onError ở đây nữa vì chúng ta dùng flow 'redirect'
    ux_mode: 'redirect', // Thêm nếu bạn vẫn gặp vấn đề với popup `storagerelay`
                          // Mặc định của flow: 'auth-code' là redirect.
  });

  if (!mounted || authLoading || (!authLoading && session)) {
    // Hiển thị loading nếu chưa mounted, auth đang load, hoặc đã có session (sẽ được redirect)
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
        <ThemeToggleButton /> {/* */}
      </Box>
      <Box
        sx={{
          marginTop: 0, // Điều chỉnh nếu cần
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          p: { xs: 2, sm: 3, md: 4 }, // Responsive padding
          borderRadius: 3, // Bo góc mềm mại hơn
          bgcolor: 'background.paper', // Sử dụng màu nền của Paper từ theme
          boxShadow: { xs: 1, sm: 2, md: 3 }, // Responsive shadow
          width: '100%', // Đảm bảo form chiếm đủ không gian
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
                setGoogleLoading(true); // Bắt đầu loading cho Google
                setError(null); // Xóa lỗi cũ
                try {
                    initiateGoogleLogin(); // Gọi hàm để redirect đến Google
                    // Sau khi gọi, người dùng sẽ bị redirect, googleLoading sẽ không cần set lại false ở đây
                } catch (e: any) {
                    console.error("Lỗi khi khởi tạo đăng nhập Google:", e);
                    setError(e.message || "Không thể bắt đầu đăng nhập Google. Vui lòng thử lại.");
                    setGoogleLoading(false); // Set false nếu có lỗi ngay khi gọi
                }
            }}
            disabled={loading || googleLoading || !!successMessage} // Vẫn disable nếu các loading khác đang chạy
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
  // Lấy Google Client ID từ biến môi trường public
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!googleClientId) {
    // Log lỗi này ở client-side console, hoặc có thể hiển thị một thông báo cho người dùng.
    // Việc return null hoặc một component báo lỗi ở đây sẽ tốt hơn là để app crash.
    console.error("LỖI CẤU HÌNH: NEXT_PUBLIC_GOOGLE_CLIENT_ID chưa được thiết lập.");
    // return <SomeErrorComponent message="Tính năng đăng nhập Google hiện không khả dụng do lỗi cấu hình." />;
  }

  // Chỉ render GoogleOAuthProvider nếu googleClientId tồn tại
  return googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>
      <SignInForm />
    </GoogleOAuthProvider>
  ) : (
    // Nếu không có client ID, vẫn render form nhưng nút Google sẽ không hoạt động đúng
    // hoặc bạn có thể chọn không hiển thị nút Google luôn.
    // Hiện tại, logic trong SignInForm khi bấm nút Google sẽ không làm gì nếu googleLogin là null.
    // Tuy nhiên, để an toàn, có thể không render nút Google nếu !googleClientId.
    // Hoặc, SignInForm có thể nhận prop để biết có nên hiển thị nút Google không.
    // Trong trường hợp này, cứ để SignInForm tự xử lý.
    <SignInForm />
  );
}