'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from 'services/apiClient';
import { useAuth } from 'components/AuthProvider';

// MUI
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';

// Google OAuth
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

import ThemeToggleButton from 'components/ThemeToggleButton';
import { LoginResponse, UserSchema } from 'services/core/types';

interface UserInfoFromAuth extends UserSchema {}

/* ---------------- Google Colored Icon (SVG chuẩn) ---------------- */
function GoogleColoredIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.651 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.957 3.043l5.657-5.657C33.64 6.053 29.062 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.818C14.42 16.186 18.879 12 24 12c3.059 0 5.842 1.154 7.957 3.043l5.657-5.657C33.64 6.053 29.062 4 24 4c-7.778 0-14.426 4.426-17.694 10.691z"/>
      <path fill="#4CAF50" d="M24 44c5.176 0 9.802-1.988 13.313-5.219l-6.146-5.201C29.081 35.907 26.671 37 24 37c-5.205 0-9.62-3.317-11.283-7.955l-6.54 5.04C9.41 39.47 16.115 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.79 2.23-2.26 4.154-4.189 5.58l.003-.002 6.146 5.201C39.803 36.968 44 31.999 44 24c0-1.341-.138-2.651-.389-3.917z"/>
    </svg>
  );
}

/* ---------------- Nút Google “pill” viền trắng ---------------- */
function GoogleButton({
  onClick,
  disabled,
  loading,
  fullWidth = true,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      fullWidth={fullWidth}
      variant="outlined"
      startIcon={<GoogleColoredIcon size={18} />}
      sx={(t) => ({
        height: 44,
        borderRadius: 999,
        px: 2,
        textTransform: 'none',
        fontWeight: 600,
        letterSpacing: 0.2,
        bgcolor: 'transparent',
        color: t.palette.mode === 'dark' ? '#FFFFFF' : '#1F1A2E',
        borderColor: t.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(40,30,80,0.6)',
        '&:hover': {
          borderColor: t.palette.mode === 'dark' ? '#FFFFFF' : 'rgba(40,30,80,0.9)',
          backgroundColor: t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(40,30,80,0.06)',
        },
      })}
    >
      {loading ? <CircularProgress size={20} /> : 'Đăng nhập/Đăng ký bằng Google'}
    </Button>
  );
}

/* ---------------- FORM (GIỮ NGUYÊN LOGIC) ---------------- */
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
        const tempHeaders = { Authorization: `Bearer ${access_token}` };

        const userResponse = await apiClient<UserInfoFromAuth>({
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
            user: userResponse.data,
            accessToken: access_token,
            features: featuresResponse.data || [],
          };
          login(sessionData);
          setSuccessMessage(`Đăng nhập thành công! Đang chuyển hướng...`);
        } else {
          setError(
            (userResponse.message || 'Lỗi lấy thông tin user.') +
              (featuresResponse.message || ' Lỗi lấy features.')
          );
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

  const frontendGoogleRedirectUri =
    typeof window !== 'undefined'
      ? window.location.origin + '/auth/google/callback'
      : 'http://localhost:3000/auth/google/callback';

  const initiateGoogleLogin = useGoogleLogin({
    flow: 'auth-code',
    redirect_uri: frontendGoogleRedirectUri,
    ux_mode: 'redirect',
  });

  if (!mounted || authLoading || (!authLoading && session)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={(t) => ({
        width: '100%',
        maxWidth: 380,
        p: { xs: 2.5, md: 3 },
        borderRadius: 3,
        bgcolor: t.palette.mode === 'dark' ? 'rgba(20,14,40,0.55)' : 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(10px)',
        boxShadow: t.palette.mode === 'dark'
          ? '0 10px 30px rgba(0,0,0,0.45)'
          : '0 10px 30px rgba(60,40,120,0.18)',
        border: t.palette.mode === 'dark'
          ? '1px solid rgba(255,255,255,0.06)'
          : '1px solid rgba(60,40,120,0.10)',
      })}
    >
      {/* Header nhỏ */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, textAlign: 'center', mb: 1 }}>
        Đăng nhập ngay!
      </Typography>

      <Box component="form" onSubmit={handleTraditionalSubmit} noValidate sx={{ width: '100%' }}>
        {error && (
          <Alert severity="error" sx={{ width: '100%', mb: 1.5 }}>
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert severity="success" sx={{ width: '100%', mb: 1.5 }}>
            {successMessage}
          </Alert>
        )}

        <TextField
          margin="dense"
          required
          fullWidth
          id="email"
          label="Email"
          name="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading || googleLoading || !!successMessage}
          size="small"
        />
        <TextField
          margin="dense"
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
          size="small"
        />

        <Box sx={{ mt: 0.5, mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <FormControlLabel control={<Checkbox size="small" />} label="Duy trì đăng nhập" sx={{ m: 0 }} />
          <Link href="/forgot-password" underline="hover" sx={{ fontSize: 13 }}>
            Quên mật khẩu?
          </Link>
        </Box>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 0.5, mb: 1.5, py: 1, borderRadius: 2 }}
          disabled={loading || googleLoading || !!successMessage}
        >
          {loading ? <CircularProgress size={22} color="inherit" /> : 'Đăng nhập'}
        </Button>

        <Divider sx={{ my: 1.5 }}>hoặc</Divider>

        <GoogleButton
          onClick={() => {
            setGoogleLoading(true);
            setError(null);
            try {
              initiateGoogleLogin();
            } catch (e: any) {
              setError(e.message || 'Không thể bắt đầu đăng nhập Google. Vui lòng thử lại.');
              setGoogleLoading(false);
            }
          }}
          disabled={loading || googleLoading || !!successMessage}
          loading={googleLoading}
        />

        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
          Bạn chưa có tài khoản? <Link href="/register">Đăng ký</Link>
        </Typography>
      </Box>
    </Box>
  );
}

/* ---------------- PAGE (Căn giữa, không trôi phải) ---------------- */
export default function SignInPage() {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  return (
    <>
      <CssBaseline />

      {/* Khung trung tâm: chống “trôi” sang phải */}
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1fr) 420px' },
          alignItems: 'center',
          // Khống chế bề rộng & căn giữa toàn bộ grid
          width: 'min(1400px, 100%)',
          mx: 'auto',
          // Padding hai bên để hero không dính sát lề
          px: { xs: 2.5, md: 6, lg: 8 },
          columnGap: { md: 6, lg: 8 },
        }}
      >
        {/* HERO LEFT */}
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <Box sx={{ maxWidth: 720 }}>
            <Typography
              variant="overline"
              sx={{ letterSpacing: 0.6, opacity: 0.7, fontWeight: 700 }}
            >
              THẤU HIỂU DỮ LIỆU · CHINH PHỤC THỊ TRƯỜNG
            </Typography>

            <Typography
              component="h1"
              sx={{ fontSize: { md: 46 }, fontWeight: 800, lineHeight: 1.15, mt: 0.5 }}
            >
              Insight đầu tư theo<br />ngành
            </Typography>

            <Typography sx={{ mt: 1.2, mb: 2.5, maxWidth: 560, opacity: 0.78 }}>
              Thông qua hệ thống các chỉ báo chuyên sâu, Findicator mang đến góc nhìn của những
              chuyên gia đầu ngành, giúp nhà đầu tư có thể tìm kiếm các cơ hội và ý tưởng đầu tư
              chất lượng.
            </Typography>

            {/* Khung “chart” giả */}
            <Box
              sx={{
                position: 'relative',
                width: { md: 560 },
                height: { md: 320 },
                borderRadius: 2,
                background:
                  'linear-gradient(180deg, rgba(10,8,20,0.86) 0%, rgba(12,10,28,0.92) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'radial-gradient(circle at 20% 60%, rgba(140,90,255,0.18), transparent 40%), radial-gradient(circle at 70% 30%, rgba(80,140,255,0.16), transparent 45%)',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  right: 18,
                  bottom: 18,
                  bgcolor: 'rgba(120,100,200,0.18)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  px: 1.25,
                  py: 0.75,
                  borderRadius: 1.5,
                  backdropFilter: 'blur(6px)',
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                <div>Ngày 21-06-2024</div>
                <div>Khối lượng OMO phát hành mới: ~ 3,900 tỷ đồng</div>
                <div>Khối lượng OMO cỡ lớn: ~ 2,131 tỷ đồng</div>
                <div>Khối lượng bơm (ròng) trong ngày: ~ 11,031 tỷ đồng</div>
              </Box>
            </Box>

            {/* Dots */}
            <Box sx={{ display: 'flex', gap: 1.2, mt: 2.5, pl: 0.5 }}>
              {[0, 1, 2].map((i) => (
                <Box
                  key={i}
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: i === 1 ? 'primary.main' : 'rgba(255,255,255,0.65)',
                    opacity: i === 1 ? 1 : 0.6,
                  }}
                />
              ))}
            </Box>
          </Box>
        </Box>

        {/* AUTH RIGHT */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: { xs: 'center', md: 'flex-end' },
            alignItems: 'center',
            py: { xs: 6, md: 0 },
          }}
        >
          <Box sx={{ position: 'fixed', top: 16, right: 16 }}>
            <ThemeToggleButton />
          </Box>

          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            {googleClientId ? (
              <GoogleOAuthProvider clientId={googleClientId}>
                <SignInForm />
              </GoogleOAuthProvider>
            ) : (
              <SignInForm />
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
}
