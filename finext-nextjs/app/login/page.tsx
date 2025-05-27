// finext-nextjs/app/login/page.tsx
'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from 'services/apiClient';
import { useAuth } from 'components/AuthProvider';

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

import { LoginResponse, UserSchema } from 'services/core/types'; // Import UserSchema
// Bỏ import User từ session.ts vì UserSchema đã đủ

// Sử dụng UserSchema trực tiếp
interface UserInfo extends UserSchema {}

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login, session, loading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!authLoading && session) {
      console.log("Login Page: Session found, redirecting to /");
      router.push('/');
    }
  }, [session, authLoading, router]);


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
        withCredentials: true,
      });

      if (loginResponse.status === 200 && loginResponse.data?.access_token) {
        const { access_token } = loginResponse.data;
        const tempHeaders = { 'Authorization': `Bearer ${access_token}` };

        const userResponse = await apiClient<UserInfo>({ // UserInfo giờ là UserSchema
          url: '/api/v1/auth/me',
          method: 'GET',
          headers: tempHeaders,
        });

        const featuresResponse = await apiClient<string[]>({
            url: '/api/v1/auth/me/features',
            method: 'GET',
            headers: tempHeaders,
        });

        if (userResponse.status === 200 && userResponse.data && featuresResponse.status === 200) {
          const sessionData = {
            // userResponse.data giờ sẽ có subscription_id (nếu có) và không có license_info
            user: userResponse.data,
            accessToken: access_token,
            features: featuresResponse.data || [],
          };

          login(sessionData);
          setSuccessMessage(`Đăng nhập thành công! Đang chuyển hướng...`);
          // useEffect sẽ xử lý redirect
        } else {
            const userErrorMsg = userResponse.message || 'Không thể lấy thông tin người dùng.';
            const featureErrorMsg = featuresResponse.message ? ` ${featuresResponse.message}` : ' Không thể lấy danh sách features.';
            setError(`${userErrorMsg}${featureErrorMsg}`);
        }
      } else {
        setError(loginResponse.message || 'Đăng nhập thất bại.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối hoặc có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  // ... (Phần JSX giữ nguyên)
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
          p: 4,
          borderRadius: 3,
          bgcolor: 'background.paper',
          boxShadow: 3,
          width: '100%',
        }}
      >
        <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component="h1" variant="h5">
          Đăng nhập
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
  );
}