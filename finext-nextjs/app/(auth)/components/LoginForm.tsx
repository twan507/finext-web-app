'use client';

import React, { useState, FormEvent, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from 'services/apiClient';
import { useAuth } from '@/components/auth/AuthProvider';

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
import Visibility from '@mui/icons-material/VisibilityOutlined';
import VisibilityOff from '@mui/icons-material/VisibilityOffOutlined';

// Google OAuth - Import thêm GoogleOAuthProvider
import { useGoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';

import BrandLogo from '@/components/layout/BrandLogo';
import { LoginResponse, UserSchema } from 'services/core/types';
import { iconSize, layoutTokens, getResponsiveFontSize, borderRadius, fontWeight, getGlowButton } from 'theme/tokens';

interface UserInfoFromAuth extends UserSchema { }

/* ---------------- Google Colored Icon (SVG chuẩn) ---------------- */
function GoogleColoredIcon({ size = iconSize.md }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
            {/* SVG paths... */}
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
    // ... (Giữ nguyên không đổi)
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
                fontWeight: fontWeight.semibold,
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
                <CircularProgress size={iconSize.progressSmall} />
            ) : (
                <>
                    <GoogleColoredIcon size={iconSize.googleIcon} />
                    <Typography
                        component="span"
                        sx={{
                            ml: 1,
                            fontSize: getResponsiveFontSize('md'),
                            fontWeight: fontWeight.semibold,
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

// Component con để sử dụng hook useGoogleLogin (cần nằm trong Provider)
function GoogleLoginComponent({
    setGoogleLoading,
    setError,
    disabled,
    loading
}: {
    setGoogleLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    disabled?: boolean;
    loading?: boolean;
}) {
    const frontendGoogleRedirectUri =
        typeof window !== 'undefined'
            ? window.location.origin + '/auth/google/callback'
            : 'http://localhost:3000/auth/google/callback';

    const initiateGoogleLogin = useGoogleLogin({
        flow: 'auth-code',
        redirect_uri: frontendGoogleRedirectUri,
        ux_mode: 'redirect',
    });

    return (
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
            disabled={disabled}
            loading={loading}
        />
    );
}


function SignInFormContent() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [showVerifyPanel, setShowVerifyPanel] = useState(false);
    const [verifyEmail, setVerifyEmail] = useState('');
    const [verifyOtpCode, setVerifyOtpCode] = useState('');
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [verifyError, setVerifyError] = useState<string | null>(null);
    const [showVerifyWarning, setShowVerifyWarning] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    const router = useRouter();
    const searchParams = useSearchParams();
    const { login, session, loading: authLoading } = useAuth();
    const [mounted, setMounted] = useState(false);

    // Lấy callback URL từ query params (nếu có) hoặc mặc định về trang chủ
    const callbackUrl = searchParams.get('callbackUrl') || '/';

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    useEffect(() => {
        if (!error) return;
        const timer = setTimeout(() => setError(null), 4000);
        return () => clearTimeout(timer);
    }, [error]);

    useEffect(() => {
        if (!verifyError) return;
        const timer = setTimeout(() => setVerifyError(null), 4000);
        return () => clearTimeout(timer);
    }, [verifyError]);

    useEffect(() => {
        if (!successMessage) return;
        const timer = setTimeout(() => setSuccessMessage(null), 4000);
        return () => clearTimeout(timer);
    }, [successMessage]);

    useEffect(() => {
        if (!showVerifyWarning) return;
        const timer = setTimeout(() => setShowVerifyWarning(false), 4000);
        return () => clearTimeout(timer);
    }, [showVerifyWarning]);

    // Lấy Client ID từ environment variables
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    const handleClickShowPassword = () => setShowPassword((show) => !show);

    const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
    };

    // Hàm redirect sau khi đăng nhập thành công
    const redirectAfterLogin = useCallback(() => {
        if (isRedirecting) return;
        setIsRedirecting(true);

        // Sử dụng window.location.href để đảm bảo full page reload
        // Điều này giúp middleware nhận được cookie mới nhất
        window.location.href = callbackUrl;
    }, [callbackUrl, isRedirecting]);

    useEffect(() => {
        setMounted(true);
        // Nếu đã có session (user đã đăng nhập), redirect về trang đích
        if (!authLoading && session && !isRedirecting) {
            redirectAfterLogin();
        }
    }, [session, authLoading, redirectAfterLogin, isRedirecting]);

    const doLoginWithCredentials = async (loginEmail: string, loginPassword: string) => {
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        setVerifyError(null);
        try {
            const loginParams = new URLSearchParams();
            loginParams.append('username', loginEmail);
            loginParams.append('password', loginPassword);
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
                    requireAuth: false,
                });
                const featuresResponse = await apiClient<string[]>({
                    url: '/api/v1/auth/me/features',
                    method: 'GET',
                    headers: tempHeaders,
                    requireAuth: false,
                });
                const permissionsResponse = await apiClient<string[]>({
                    url: '/api/v1/auth/me/permissions',
                    method: 'GET',
                    headers: tempHeaders,
                    requireAuth: false,
                });

                if (
                    userResponse.data &&
                    featuresResponse.data
                ) {
                    const sessionData = {
                        user: userResponse.data,
                        accessToken: access_token,
                        features: featuresResponse.data || [],
                        permissions: permissionsResponse.data || [],
                    };
                    login(sessionData);
                    setSuccessMessage(`Đăng nhập thành công! Đang chuyển hướng...`);
                    setTimeout(() => {
                        window.location.href = callbackUrl;
                    }, 100);
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
            const errMsg = err.message || '';
            if (errMsg === 'User is inactive' || errMsg.toLowerCase().includes('inactive')) {
                // Compliance pivot 2026-05-07: tài khoản inactive chỉ admin kích hoạt được — bỏ self-verify OTP.
                setError(
                    'Tài khoản của bạn chưa được kích hoạt. Đội ngũ Finext sẽ xác nhận trong vòng 1 giờ kể từ khi đăng ký. Vui lòng kiểm tra email và thử đăng nhập lại sau.'
                );
            } else {
                setError(errMsg || 'Lỗi kết nối hoặc có lỗi xảy ra trong quá trình đăng nhập.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleTraditionalSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await doLoginWithCredentials(email.trim().toLowerCase(), password);
    };

    const handleVerifyEmail = async () => {
        setVerifyLoading(true);
        setVerifyError(null);
        setError(null);
        setSuccessMessage(null);
        try {
            await apiClient({
                url: '/api/v1/otps/verify',
                method: 'POST',
                body: { email: verifyEmail, otp_type: 'email_verification', otp_code: verifyOtpCode },
                requireAuth: false,
            });
            setShowVerifyPanel(false);
            setVerifyOtpCode('');
            setVerifyLoading(false);
            await doLoginWithCredentials(verifyEmail, password);
        } catch (err: any) {
            setVerifyError(err.message || 'Lỗi xác thực OTP. Vui lòng thử lại.');
        } finally {
            setVerifyLoading(false);
        }
    };

    const handleResendVerificationOtp = async () => {
        setVerifyError(null);
        setResendCooldown(60);
        try {
            await apiClient({
                url: '/api/v1/otps/request',
                method: 'POST',
                body: { email: verifyEmail, otp_type: 'email_verification' },
                requireAuth: false,
            });
        } catch (err: any) {
            setVerifyError(err.message || 'Không thể gửi lại mã OTP. Vui lòng thử lại.');
        }
    };

    // Hiển thị loading khi: chưa mount, đang check auth, đã có session (đang redirect), hoặc đang redirect
    if (!mounted || authLoading || (!authLoading && session) || isRedirecting) {
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
                // ... (Giữ nguyên các styles glassmorphism)
                bgcolor: t.palette.mode === 'dark'
                    ? 'rgba(15, 10, 35, 0.4)'
                    : 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px) saturate(150%)',
                WebkitBackdropFilter: 'blur(20px) saturate(150%)',
                boxShadow: t.palette.mode === 'dark'
                    ? [
                        '0 8px 32px rgba(0, 0, 0, 0.6)',
                        '0 2px 8px rgba(139, 92, 246, 0.1)',
                        'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                    ].join(', ')
                    : [
                        '0 8px 32px rgba(107, 70, 193, 0.15)',
                        '0 4px 16px rgba(0, 0, 0, 0.1)',
                        'inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                    ].join(', '),
                border: t.palette.mode === 'dark'
                    ? '1px solid rgba(255, 255, 255, 0.1)'
                    : '1px solid rgba(107, 70, 193, 0.15)',
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
            {/* ... (Giữ nguyên BrandLogo và Typography) */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
                <BrandLogo
                    href="/"
                    imageSize={iconSize.brandImage}
                    textSize={getResponsiveFontSize('h4')}
                    gap={layoutTokens.dotSize.small}
                    useColorOverlay={true}
                />
            </Box>

            <Typography
                sx={(theme) => ({
                    textAlign: 'center',
                    mb: 1,
                    fontSize: getResponsiveFontSize('md'),
                    background: theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, #FFFFFF 0%, #E0E7FF 25%, #C4B5FD 50%, #A78BFA 75%, #8B5CF6 100%)'
                        : 'linear-gradient(135deg, #1F2937 0%, #4C1D95 25%, #6B46C1 50%, #7C3AED 75%, #8B5CF6 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: fontWeight.semibold,
                    letterSpacing: '0.5px',
                })}
            >
                Đăng nhập ngay!
            </Typography>

            <Box component="form" onSubmit={showVerifyPanel ? handleVerifyEmail : handleTraditionalSubmit} noValidate sx={{ width: '100%' }}>
                {successMessage && (
                    <Alert severity="success" sx={{ width: '100%', mb: 1.5 }}>
                        {successMessage}
                    </Alert>
                )}
                {showVerifyWarning && (
                    <Alert severity="warning" sx={{ mb: 1.5 }}>
                        <strong>{verifyEmail}</strong> chưa được xác thực. Nhập mã xác thực bên dưới.
                    </Alert>
                )}
                {verifyError && (
                    <Alert severity="error" sx={{ mb: 1.5 }}>
                        {verifyError}
                    </Alert>
                )}
                {showVerifyPanel ? (
                    <Box sx={{ mb: 1.5 }}>
                        <TextField
                            label="Mã xác thực (6 chữ số)"
                            fullWidth
                            value={verifyOtpCode}
                            onChange={(e) => setVerifyOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleVerifyEmail(); } }}
                            disabled={verifyLoading}
                            inputProps={{ maxLength: 6, inputMode: 'numeric' }}
                            size="small"
                            sx={{ mb: 1.5 }}
                        />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                fullWidth
                                variant="contained"
                                onClick={handleVerifyEmail}
                                disabled={verifyOtpCode.length < 6 || verifyLoading}
                                size="small"
                                sx={(t) => ({ borderRadius: 2, ...getGlowButton(t.palette.mode === 'dark') })}
                            >
                                {verifyLoading ? <CircularProgress size={16} color="inherit" /> : 'Xác thực'}
                            </Button>
                            <Button
                                fullWidth
                                variant="outlined"
                                onClick={handleResendVerificationOtp}
                                disabled={resendCooldown > 0 || verifyLoading}
                                size="small"
                                sx={{ borderRadius: 2 }}
                            >
                                {resendCooldown > 0 ? `Gửi lại (${resendCooldown}s)` : 'Gửi lại mã'}
                            </Button>
                        </Box>
                    </Box>
                ) : (
                    error && (
                        <Alert severity="error" sx={{ width: '100%', mb: 1.5 }}>
                            {error}
                        </Alert>
                    )
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
                    disabled={loading || googleLoading || !!successMessage || showVerifyPanel}
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
                        disabled={loading || googleLoading || !!successMessage || showVerifyPanel}
                        size="small"
                    />
                    <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleClickShowPassword}
                        onMouseDown={handleMouseDownPassword}
                        disabled={loading || googleLoading || !!successMessage || showVerifyPanel}
                        tabIndex={-1}
                        sx={{
                            position: 'absolute',
                            right: 6,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            marginTop: '4px',
                            p: 0.25,
                            minWidth: '24px',
                            height: '24px',
                            zIndex: 1,
                        }}
                    >
                        {showPassword ?
                            <Visibility fontSize='small' sx={(theme) => ({ color: theme.palette.text.secondary })} /> :
                            <VisibilityOff fontSize='small' sx={(theme) => ({ color: theme.palette.text.secondary })} />}
                    </IconButton>
                </Box>

                <Box
                    sx={{ mt: 0.5, mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                    <FormControlLabel control={<Checkbox size="small" tabIndex={-1} disabled={showVerifyPanel} />} label="Duy trì đăng nhập" />
                    <Link href="/forgot-password" underline="hover" tabIndex={-1} sx={{ fontSize: getResponsiveFontSize('sm'), mt: 0.6, pointerEvents: showVerifyPanel ? 'none' : 'auto', opacity: showVerifyPanel ? 0.5 : 1 }}>
                        Quên mật khẩu?
                    </Link>
                </Box>

                <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    sx={(t) => ({
                        mt: 0.5, mb: 1.5, py: 1, borderRadius: 2,
                        ...getGlowButton(t.palette.mode === 'dark'),
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    })}
                    disabled={loading || googleLoading || !!successMessage || showVerifyPanel}
                >
                    {loading ? <CircularProgress size={iconSize.progressMedium} color="inherit" /> : 'Đăng nhập'}
                </Button>

                {/* Compliance pivot 2026-05-07: Google login hidden — bypass admin approval flow.
                    Email/password register flow still active. Forgot-password works for ex-Google users. */}
                {false && (
                    <>
                        <Divider sx={{ my: 1.5 }}>hoặc</Divider>
                        {googleClientId ? (
                            <GoogleOAuthProvider clientId={googleClientId}>
                                <GoogleLoginComponent
                                    setGoogleLoading={setGoogleLoading}
                                    setError={setError}
                                    disabled={loading || googleLoading || !!successMessage || showVerifyPanel}
                                    loading={googleLoading}
                                />
                            </GoogleOAuthProvider>
                        ) : (
                            <GoogleButton
                                onClick={() => { }}
                                disabled={true}
                                fullWidth={true}
                            />
                        )}
                    </>
                )}

                <Typography variant="body2" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                    Bạn chưa có tài khoản? <Link href="/register" tabIndex={-1}>Đăng ký</Link>
                </Typography>
            </Box>
        </Box>
    );
}

// Wrap SignInFormContent với Suspense vì nó sử dụng useSearchParams
export default function SignInForm() {
    return (
        <Suspense fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        }>
            <SignInFormContent />
        </Suspense>
    );
}