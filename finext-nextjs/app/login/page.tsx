// finext-nextjs/app/login/page.tsx
'use client';

import { useState, FormEvent, useEffect } from 'react'; // Thêm useEffect
import { useRouter } from 'next/navigation';
import { apiClient } from 'lib/apiClient';
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
import ThemeToggleButton from 'components/ThemeToggleButton';
// Bỏ createTheme và ThemeProvider từ @mui/material/styles vì sẽ dùng theme global
// import { createTheme, ThemeProvider } from '@mui/material/styles';

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface UserInfo {
  id: string;
  email: string;
  full_name: string;
}

// const defaultTheme = createTheme(); // <<--- BỎ DÒNG NÀY

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login, session } = useAuth(); // Lấy thêm session để kiểm tra
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Nếu đã đăng nhập, chuyển hướng về trang chủ
    if (session) {
      router.push('/');
    }
  }, [session, router]);


  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const loginParams = new URLSearchParams();
      loginParams.append('username', email);
      loginParams.append('password', password);

      const loginResponse = await apiClient<LoginResponse>({
        url: '/api/v1/auth/login',
        method: 'POST',
        body: loginParams,
        isUrlEncoded: true,
        requireAuth: false,
      });

      if (loginResponse.status === 200 && loginResponse.data?.access_token) {
        const { access_token, refresh_token } = loginResponse.data;

        const userResponse = await apiClient<UserInfo>({
          url: '/api/v1/auth/me',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${access_token}`,
          },
        });

        if (userResponse.status === 200 && userResponse.data) {
          const sessionData = {
            user: {
              id: userResponse.data.id,
              email: userResponse.data.email,
              full_name: userResponse.data.full_name,
            },
            accessToken: access_token,
            refreshToken: refresh_token,
          };

          login(sessionData);

          const welcomeMessage = `Chào mừng trở lại, ${userResponse.data.full_name || userResponse.data.email}! Đăng nhập thành công. Đang chuyển hướng...`;
          setSuccessMessage(welcomeMessage);

          setTimeout(() => {
            router.push('/');
          }, 2500);

        } else {
          setError(userResponse.message || 'Không thể lấy thông tin người dùng sau khi đăng nhập.');
        }
      } else {
        setError(loginResponse.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối đến server hoặc có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  // Nếu chưa mounted hoặc đã đăng nhập thì không hiển thị form
  if (!mounted || session) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    // <ThemeProvider theme={defaultTheme}> // <<--- BỎ ThemeProvider Ở ĐÂY
    // Trang này sẽ tự động nhận theme từ MuiProvider trong layout.tsx
    <Container component="main" maxWidth="xs" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <CssBaseline />
      {/* Thêm nút đổi theme ở góc trên bên phải */}
      <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
        <ThemeToggleButton />
      </Box>
      <Box
        sx={{
          marginTop: 0, // Giảm marginTop để form nằm giữa hơn
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          p: 3, // Thêm padding cho Box
          borderRadius: 2, // Thêm bo góc
          bgcolor: 'background.paper', // Sử dụng màu nền của Paper từ theme
          boxShadow: (theme) => theme.shadows[3], // Thêm chút bóng đổ
        }}
      >
        <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component="h1" variant="h5">
          Đăng nhập vào tài khoản
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 2, width: '100%' }}>
          {error && (
            <Alert severity="error" sx={{ width: '100%', mt: 0, mb: 2 }}>
              {error}
            </Alert>
          )}
          {successMessage && (
            <Alert severity="success" sx={{ width: '100%', mt: 0, mb: 2 }}>
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
            disabled={loading || !!successMessage}
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
            disabled={loading || !!successMessage}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading || !!successMessage}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Đăng nhập'}
          </Button>
        </Box>
      </Box>
    </Container>
    // </ThemeProvider> // <<--- BỎ ThemeProvider Ở ĐÂY
  );
}
