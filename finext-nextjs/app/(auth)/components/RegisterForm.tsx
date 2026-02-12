'use client';

import React, { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from 'services/apiClient';

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

// Google OAuth
import { useGoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';

import BrandLogo from '@/components/layout/BrandLogo';
import { iconSize, layoutTokens, getResponsiveFontSize, borderRadius, fontWeight, getGlowButton } from 'theme/tokens';

interface MessageResponse {
    message: string;
}

/* ---------------- Google Colored Icon (SVG chuẩn) ---------------- */
function GoogleColoredIcon({ size = iconSize.md }: { size?: number }) {
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
                        Đăng ký bằng Google
                    </Typography>
                </>
            )}
        </Button>
    );
}

// Component con để sử dụng hook useGoogleLogin
function GoogleRegisterComponent({
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
                    setError(e.message || 'Không thể bắt đầu đăng ký Google. Vui lòng thử lại.');
                    setGoogleLoading(false);
                }
            }}
            disabled={disabled}
            loading={loading}
        />
    );
}

export default function RegisterForm() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);

    const router = useRouter();

    // Lấy Client ID từ environment variables
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    const handleClickShowPassword = () => setShowPassword((show) => !show);
    const handleClickShowConfirmPassword = () => setShowConfirmPassword((show) => !show);

    const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
    };

    const validateForm = () => {
        if (!fullName.trim()) {
            setError('Vui lòng nhập họ và tên.');
            return false;
        }
        if (!email.trim()) {
            setError('Vui lòng nhập địa chỉ email.');
            return false;
        }
        if (!password.trim()) {
            setError('Vui lòng nhập mật khẩu.');
            return false;
        }
        if (password.length < 8) {
            setError('Mật khẩu phải có ít nhất 8 ký tự.');
            return false;
        }
        if (password !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp.');
            return false;
        }
        if (!agreeTerms) {
            setError('Vui lòng đồng ý với điều khoản sử dụng.');
            return false;
        }
        return true;
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const registerData = {
                full_name: fullName.trim(),
                email: email.trim(),
                phone_number: phoneNumber.trim() || undefined,
                password: password,
                referral_code: referralCode.trim() || undefined,
            };

            const response = await apiClient<MessageResponse>({
                url: '/api/v1/auth/register',
                method: 'POST',
                body: registerData,
                requireAuth: false,
            });

            if (response.status === 201) {
                setSuccessMessage(
                    response.data?.message ||
                    'Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.'
                );
                // Có thể redirect sau vài giây
                setTimeout(() => {
                    router.push('/login');
                }, 3000);
            } else {
                setError(response.message || 'Đăng ký thất bại. Vui lòng thử lại.');
            }
        } catch (err: any) {
            setError(err.message || 'Lỗi kết nối hoặc có lỗi xảy ra trong quá trình đăng ký.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={(t) => ({
                width: '100%',
                maxWidth: layoutTokens.authFormMaxWidth,
                p: { xs: 2.5, md: 3 },
                borderRadius: 3,
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
                Tạo tài khoản mới!
            </Typography>

            <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
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
                    id="fullName"
                    label="Họ và tên"
                    name="fullName"
                    autoComplete="name"
                    autoFocus
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading || googleLoading || !!successMessage}
                    size="small"
                />

                <TextField
                    margin="dense"
                    required
                    fullWidth
                    id="email"
                    label="Email"
                    name="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading || googleLoading || !!successMessage}
                    size="small"
                />

                <TextField
                    margin="dense"
                    fullWidth
                    id="phoneNumber"
                    label="Số điện thoại (không bắt buộc)"
                    name="phoneNumber"
                    autoComplete="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={loading || googleLoading || !!successMessage}
                    size="small"
                />

                <Box sx={{ position: 'relative' }}>
                    <TextField
                        margin="dense"
                        required
                        fullWidth
                        name="password"
                        label="Mật khẩu (tối thiểu 8 ký tự)"
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading || googleLoading || !!successMessage}
                        size="small"
                    // helperText="Tối thiểu 8 ký tự"
                    />
                    <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleClickShowPassword}
                        onMouseDown={handleMouseDownPassword}
                        disabled={loading || googleLoading || !!successMessage}
                        tabIndex={-1}
                        sx={{
                            position: 'absolute',
                            right: 6,
                            top: '27px',
                            transform: 'translateY(-50%)',
                            p: 0.25,
                            minWidth: '24px',
                            height: '24px',
                            zIndex: 1,
                        }}
                    >
                        {showPassword ? (
                            <Visibility
                                fontSize='small'
                                sx={(theme) => ({
                                    color: theme.palette.text.secondary
                                })}
                            />
                        ) : (
                            <VisibilityOff
                                fontSize='small'
                                sx={(theme) => ({
                                    color: theme.palette.text.secondary
                                })}
                            />
                        )}
                    </IconButton>
                </Box>

                <Box sx={{ position: 'relative' }}>
                    <TextField
                        margin="dense"
                        required
                        fullWidth
                        name="confirmPassword"
                        label="Xác nhận mật khẩu"
                        type={showConfirmPassword ? 'text' : 'password'}
                        id="confirmPassword"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={loading || googleLoading || !!successMessage}
                        size="small"
                    />
                    <IconButton
                        aria-label="toggle confirm password visibility"
                        onClick={handleClickShowConfirmPassword}
                        onMouseDown={handleMouseDownPassword}
                        disabled={loading || googleLoading || !!successMessage}
                        tabIndex={-1}
                        sx={{
                            position: 'absolute',
                            right: 6,
                            top: '27px',
                            transform: 'translateY(-50%)',
                            p: 0.25,
                            minWidth: '24px',
                            height: '24px',
                            zIndex: 1,
                        }}
                    >
                        {showConfirmPassword ? (
                            <Visibility
                                fontSize='small'
                                sx={(theme) => ({
                                    color: theme.palette.text.secondary
                                })}
                            />
                        ) : (
                            <VisibilityOff
                                fontSize='small'
                                sx={(theme) => ({
                                    color: theme.palette.text.secondary
                                })}
                            />
                        )}
                    </IconButton>
                </Box>

                <TextField
                    margin="dense"
                    fullWidth
                    id="referralCode"
                    label="Mã giới thiệu (không bắt buộc)"
                    name="referralCode"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    disabled={loading || googleLoading || !!successMessage}
                    size="small"
                />

                <FormControlLabel
                    control={
                        <Checkbox
                            size="small"
                            checked={agreeTerms}
                            onChange={(e) => setAgreeTerms(e.target.checked)}
                            disabled={loading || googleLoading || !!successMessage}
                            tabIndex={-1}
                        />
                    }
                    label={
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                            Tôi đã đọc và đồng ý với <Link href="/terms" underline="hover" tabIndex={-1}>Điều khoản sử dụng</Link> <br></br> và <Link href="/privacy" underline="hover" tabIndex={-1}>Chính sách bảo mật</Link>
                        </Typography>
                    }
                    sx={{ mt: 2, mb: 2, alignItems: 'flex-start' }}
                />

                <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    sx={(t) => ({
                        mt: 0.5, mb: 1.5, py: 1, borderRadius: 2,
                        ...getGlowButton(t.palette.mode === 'dark'),
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    })}
                    disabled={loading || googleLoading || !!successMessage}
                >
                    {loading ? <CircularProgress size={iconSize.progressMedium} color="inherit" /> : 'Đăng ký'}
                </Button>

                <Divider sx={{ my: 1.5 }}>hoặc</Divider>

                {googleClientId ? (
                    <GoogleOAuthProvider clientId={googleClientId}>
                        <GoogleRegisterComponent
                            setGoogleLoading={setGoogleLoading}
                            setError={setError}
                            disabled={loading || googleLoading || !!successMessage}
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

                <Typography variant="body2" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
                    Đã có tài khoản? <Link href="/login" tabIndex={-1}>Đăng nhập</Link>
                </Typography>
            </Box>
        </Box>
    );
}