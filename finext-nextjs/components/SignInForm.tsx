'use client';

import React, { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from 'services/apiClient';
import { useAuth } from 'components/AuthProvider';

// MUI
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

// Google OAuth
import { useGoogleLogin } from '@react-oauth/google';

import BrandLogo from 'components/BrandLogo';
import { LoginResponse, UserSchema } from 'services/core/types';
import { responsiveTypographyTokens, iconSizeTokens, layoutTokens } from 'theme/tokens';

interface UserInfoFromAuth extends UserSchema { }

/* ---------------- Google Colored Icon (SVG chuẩn) ---------------- */
function GoogleColoredIcon({ size = iconSizeTokens.medium }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
            <path
                fill="#FFC107"
                d="M43.611 20.083H42V20H24v8h11.303c-1.651 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.957 3.043l5.657-5.657C33.64 6.053 29.062 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z"
            />
            <path
                fill="#FF3D00"
                d="M6.306 14.691l6.571 4.818C14.42 16.186 18.879 12 24 12c3.059 0 5.842 1.154 7.957 3.043l5.657-5.657C33.64 6.053 29.062 4 24 4c-7.778 0-14.426 4.426-17.694 10.691z"
            />
            <path
                fill="#4CAF50"
                d="M24 44c5.176 0 9.802-1.988 13.313-5.219l-6.146-5.201C29.081 35.907 26.671 37 24 37c-5.205 0-9.62-3.317-11.283-7.955l-6.54 5.04C9.41 39.47 16.115 44 24 44z"
            />
            <path
                fill="#1976D2"
                d="M43.611 20.083H42V20H24v8h11.303c-.79 2.23-2.26 4.154-4.189 5.58l.003-.002 6.146 5.201C39.803 36.968 44 31.999 44 24c0-1.341-.138-2.651-.389-3.917z"
            />
        </svg>
    );
}

/* ---------------- Nút Google "pill" viền trắng ---------------- */
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
            sx={(t) => ({
                height: layoutTokens.buttonHeight,
                borderRadius: 999,
                px: 2,
                textTransform: 'none',
                fontWeight: 600,
                letterSpacing: 0.2,
                bgcolor: 'transparent',
                color: t.palette.mode === 'dark' ? '#FFFFFF' : '#1F1A2E',
                borderColor:
                    t.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(40,30,80,0.6)',
                '&:hover': {
                    borderColor:
                        t.palette.mode === 'dark' ? '#FFFFFF' : 'rgba(40,30,80,0.9)',
                    backgroundColor:
                        t.palette.mode === 'dark'
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(40,30,80,0.06)',
                },
            })}
        >
            {loading ? (
                <CircularProgress size={iconSizeTokens.progressSmall} />
            ) : (
                <>
                    <GoogleColoredIcon size={iconSizeTokens.googleIcon} />
                    <Typography
                        component="span"
                        sx={{
                            ml: 1,
                            fontSize: responsiveTypographyTokens.body1.fontSize,
                            fontWeight: 600,
                            letterSpacing: 0.2
                        }}
                    >
                        Đăng nhập/Đăng ký bằng Google
                    </Typography>
                </>
            )}
        </Button>
    );
}

export default function SignInForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    const router = useRouter();
    const { login, session, loading: authLoading } = useAuth();
    const [mounted, setMounted] = useState(false);

    const handleClickShowPassword = () => setShowPassword((show) => !show);

    const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
    };

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
            if (
                loginStandardResponse.status === 200 &&
                loginStandardResponse.data?.access_token
            ) {
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

                if (
                    userResponse.status === 200 &&
                    userResponse.data &&
                    featuresResponse.status === 200
                ) {
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
                        (featuresResponse.message || ' Lỗi lấy features.'),
                    );
                }
            } else {
                setError(
                    loginStandardResponse.message ||
                    'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.',
                );
            }
        } catch (err: any) {
            setError(
                err.message || 'Lỗi kết nối hoặc có lỗi xảy ra trong quá trình đăng nhập.',
            );
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
            <Box
                sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
            >
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box
            sx={(t) => ({
                width: '100%',
                maxWidth: layoutTokens.authFormMaxWidth,
                p: { xs: 2.5, md: 3 },
                borderRadius: 3,
                // Enhanced glassmorphism effect
                bgcolor: t.palette.mode === 'dark'
                    ? 'rgba(15, 10, 35, 0.4)' // Darker, more transparent for dark mode
                    : 'rgba(255, 255, 255, 0.05)', // Even more transparent for light mode
                backdropFilter: 'blur(20px) saturate(150%)', // Stronger blur with saturation
                WebkitBackdropFilter: 'blur(20px) saturate(150%)', // Safari support
                // Enhanced shadow system
                boxShadow: t.palette.mode === 'dark'
                    ? [
                        '0 8px 32px rgba(0, 0, 0, 0.6)', // Primary shadow
                        '0 2px 8px rgba(139, 92, 246, 0.1)', // Purple accent shadow
                        'inset 0 1px 0 rgba(255, 255, 255, 0.1)', // Top highlight
                    ].join(', ')
                    : [
                        '0 8px 32px rgba(107, 70, 193, 0.15)', // Purple-tinted shadow for light mode
                        '0 4px 16px rgba(0, 0, 0, 0.1)', // Subtle black shadow
                        'inset 0 1px 0 rgba(255, 255, 255, 0.4)', // Stronger top highlight
                    ].join(', '),
                // Enhanced border system
                border: t.palette.mode === 'dark'
                    ? '1px solid rgba(255, 255, 255, 0.1)' // Subtle white border for dark mode
                    : '1px solid rgba(107, 70, 193, 0.15)', // Purple-tinted border for light mode
                // Add subtle gradient overlay
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: t.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(124, 58, 237, 0.02) 100%)'
                        : 'linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.1) 100%)',
                    pointerEvents: 'none',
                    zIndex: -1,
                },
            })}
        >
            {/* Brand Logo with theme-responsive color overlay */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
                <BrandLogo
                    href="/"
                    imageSize={iconSizeTokens.brandImage}
                    textSize={responsiveTypographyTokens.logo.fontSize.md}
                    gap={layoutTokens.dotSize.small}
                    useColorOverlay={true}
                />
            </Box>

            <Typography
                sx={(theme) => ({
                    textAlign: 'center',
                    mb: 1,
                    fontSize: responsiveTypographyTokens.subtitle1.fontSize.md,
                    background: theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, #FFFFFF 0%, #E0E7FF 25%, #C4B5FD 50%, #A78BFA 75%, #8B5CF6 100%)'
                        : 'linear-gradient(135deg, #1F2937 0%, #4C1D95 25%, #6B46C1 50%, #7C3AED 75%, #8B5CF6 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: 600,
                    letterSpacing: '0.5px',
                })}
            >
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
                <Box sx={{ position: 'relative' }}>
                    <TextField
                        margin="dense"
                        required
                        fullWidth
                        name="password"
                        label="Mật khẩu"
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading || googleLoading || !!successMessage}
                        size="small"
                    />
                    <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleClickShowPassword}
                        onMouseDown={handleMouseDownPassword}
                        disabled={loading || googleLoading || !!successMessage}
                        sx={{
                            position: 'absolute',
                            right: 6,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            marginTop: '4px', // Điều chỉnh để căn giữa với input field
                            p: 0.25,
                            minWidth: '24px',
                            height: '24px',
                            zIndex: 1,
                            '&:hover': {
                                backgroundColor: 'action.hover',
                            },
                            '& .MuiSvgIcon-root': {
                                fontSize: responsiveTypographyTokens.body2.fontSize.sm,
                                opacity: 0.6,
                                '&:hover': {
                                    opacity: 0.8,
                                },
                            },
                        }}
                    >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                </Box>

                <Box
                    sx={{ mt: 0.5, mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                    <FormControlLabel control={<Checkbox size="small" />} label="Duy trì đăng nhập" />
                    <Link href="/forgot-password" underline="hover" sx={{ fontSize: responsiveTypographyTokens.body2.fontSize.md, mt: 0.6 }}>
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
                    {loading ? <CircularProgress size={iconSizeTokens.progressMedium} color="inherit" /> : 'Đăng nhập'}
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

                <Typography variant="body2" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                    Bạn chưa có tài khoản? <Link href="/register">Đăng ký</Link>
                </Typography>
            </Box>
        </Box>
    );
}