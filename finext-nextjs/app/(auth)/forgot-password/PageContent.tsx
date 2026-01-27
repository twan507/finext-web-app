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
import Link from '@mui/material/Link';
import IconButton from '@mui/material/IconButton';
import Visibility from '@mui/icons-material/VisibilityOutlined';
import VisibilityOff from '@mui/icons-material/VisibilityOffOutlined';
import ArrowBack from '@mui/icons-material/ArrowBackIosNew';
import AccessTime from '@mui/icons-material/AccessTime';

import BrandLogo from '@/components/layout/BrandLogo';
import { fontSize, iconSize, layoutTokens } from 'theme/tokens';

interface OtpRequestResponse {
    message: string;
}

interface ResetPasswordResponse {
    message: string;
}

export default function PageContent() {
    const [step, setStep] = useState<'email' | 'reset'>('email');
    const [email, setEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Countdown states
    const [resendCountdown, setResendCountdown] = useState(0); // 1 phút cho nút gửi lại
    const [otpValidityCountdown, setOtpValidityCountdown] = useState(0); // 5 phút cho hiệu lực OTP

    const router = useRouter();

    // Countdown effect
    useEffect(() => {
        let resendInterval: NodeJS.Timeout;
        let validityInterval: NodeJS.Timeout;

        if (resendCountdown > 0) {
            resendInterval = setInterval(() => {
                setResendCountdown(prev => prev - 1);
            }, 1000);
        }

        if (otpValidityCountdown > 0) {
            validityInterval = setInterval(() => {
                setOtpValidityCountdown(prev => prev - 1);
            }, 1000);
        }

        return () => {
            if (resendInterval) clearInterval(resendInterval);
            if (validityInterval) clearInterval(validityInterval);
        };
    }, [resendCountdown, otpValidityCountdown]);

    // Format time display
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;

        if (mins > 0) {
            return `${mins} phút ${secs} giây`;
        } else {
            return `${secs} giây`;
        }
    };

    const handleClickShowNewPassword = () => setShowNewPassword((show) => !show);
    const handleClickShowConfirmPassword = () => setShowConfirmPassword((show) => !show);

    const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
    };

    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePassword = (password: string) => {
        return password.length >= 6; // Có thể thêm validation phức tạp hơn
    };

    const handleRequestOtp = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!validateEmail(email)) {
            setError('Vui lòng nhập email hợp lệ.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await apiClient<OtpRequestResponse>({
                url: '/api/v1/otps/request',
                method: 'POST',
                body: {
                    email: email,
                    otp_type: 'reset_password',
                },
                requireAuth: false,
            });

            if (response.status === 200) {
                setSuccessMessage('otp_sent');
                setStep('reset');
                // Start countdowns
                setResendCountdown(60); // 1 phút cho nút gửi lại
                setOtpValidityCountdown(300); // 5 phút cho hiệu lực OTP
            } else {
                setError(response.message || 'Có lỗi xảy ra khi gửi mã OTP. Vui lòng thử lại.');
            }
        } catch (err: any) {
            setError(err.message || 'Lỗi kết nối. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!otpCode) {
            setError('Vui lòng nhập mã OTP.');
            return;
        }

        if (!validatePassword(newPassword)) {
            setError('Mật khẩu phải có ít nhất 6 ký tự.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await apiClient<ResetPasswordResponse>({
                url: '/api/v1/auth/reset-password-otp',
                method: 'POST',
                body: {
                    email: email,
                    otp_code: otpCode,
                    new_password: newPassword,
                },
                requireAuth: false,
            });

            if (response.status === 200) {
                setSuccessMessage('Đặt lại mật khẩu thành công! Đang chuyển hướng đến trang đăng nhập...');
                setTimeout(() => {
                    router.push('/login');
                }, 2000);
            } else {
                setError(response.message || 'Có lỗi xảy ra khi đặt lại mật khẩu. Vui lòng thử lại.');
            }
        } catch (err: any) {
            setError(err.message || 'Lỗi kết nối. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    };

    const handleBackToEmail = () => {
        setStep('email');
        setOtpCode('');
        setNewPassword('');
        setConfirmPassword('');
        setError(null);
        setSuccessMessage(null);
        // Reset countdowns
        setResendCountdown(0);
        setOtpValidityCountdown(0);
    };

    const handleResendOtp = async () => {
        if (resendCountdown > 0) return; // Không cho phép gửi lại nếu còn countdown

        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await apiClient<OtpRequestResponse>({
                url: '/api/v1/otps/request',
                method: 'POST',
                body: {
                    email: email,
                    otp_type: 'reset_password',
                },
                requireAuth: false,
            });

            if (response.status === 200) {
                setSuccessMessage('otp_resent');
                // Reset countdowns
                setResendCountdown(60); // 1 phút cho nút gửi lại
                setOtpValidityCountdown(300); // 5 phút cho hiệu lực OTP
            } else {
                setError(response.message || 'Có lỗi xảy ra khi gửi mã OTP. Vui lòng thử lại.');
            }
        } catch (err: any) {
            setError(err.message || 'Lỗi kết nối. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
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
                {/* Logo và Title */}
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
                    <BrandLogo
                        href="/"
                        imageSize={iconSize.brandImage}
                        textSize={fontSize.h4.tablet}
                        gap={layoutTokens.dotSize.small}
                        useColorOverlay={true}
                    />
                </Box>

                <Typography
                    sx={(theme) => ({
                        textAlign: 'center',
                        mb: 1,
                        fontSize: fontSize.md.tablet,
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
                    {step === 'email' ? 'Quên mật khẩu?' : 'Đặt lại mật khẩu'}
                </Typography>

                {/* Back button for reset step */}
                {step === 'reset' && (
                    <Box sx={{ mb: 2 }}>
                        <Button
                            startIcon={<ArrowBack />}
                            onClick={handleBackToEmail}
                            sx={{ textTransform: 'none' }}
                            disabled={loading}
                        >
                            Quay lại
                        </Button>
                    </Box>
                )}

                {/* Step 1: Email Input */}
                {step === 'email' && (
                    <Box component="form" onSubmit={handleRequestOtp} noValidate sx={{ width: '100%' }}>
                        {error && (
                            <Alert severity="error" sx={{ width: '100%', mb: 1.5 }}>
                                {error}
                            </Alert>
                        )}
                        {successMessage && (
                            <Alert severity="success" sx={{ width: '100%', mb: 1.5 }}>
                                {successMessage === 'otp_sent' ? (
                                    <>Mã OTP đã được gửi đến email <strong>{email}</strong>. Vui lòng kiểm tra hộp thư.</>
                                ) : successMessage === 'otp_resent' ? (
                                    <>Mã OTP mới đã được gửi đến email <strong>{email}</strong>.</>
                                ) : (
                                    successMessage
                                )}
                            </Alert>
                        )}

                        <Typography variant="body2" sx={{ mb: 2, textAlign: 'center', color: 'text.secondary' }}>
                            Nhập email để nhận mã xác thực đặt lại mật khẩu.
                        </Typography>

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
                            disabled={loading}
                            size="small"
                        />

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 2, mb: 1.5, py: 1, borderRadius: 2 }}
                            disabled={loading}
                        >
                            {loading ? <CircularProgress size={iconSize.progressMedium} color="inherit" /> : 'Gửi mã OTP'}
                        </Button>

                        <Typography variant="body2" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                            Nhớ mật khẩu? <Link href="/login" tabIndex={-1}>Đăng nhập</Link>
                        </Typography>
                    </Box>
                )}

                {/* Step 2: OTP and New Password */}
                {step === 'reset' && (
                    <Box component="form" onSubmit={handleResetPassword} noValidate sx={{ width: '100%' }}>
                        {error && (
                            <Alert severity="error" sx={{ width: '100%', mb: 1.5 }}>
                                {error}
                            </Alert>
                        )}
                        {successMessage && (
                            <Alert severity="success" sx={{ width: '100%', mb: 1.5 }}>
                                {successMessage === 'otp_sent' ? (
                                    <>Mã OTP đã được gửi đến email <strong>{email}</strong>.</>
                                ) : successMessage === 'otp_resent' ? (
                                    <>Mã OTP mới đã được gửi đến email <strong>{email}</strong>.</>
                                ) : (
                                    successMessage
                                )}
                            </Alert>
                        )}

                        <TextField
                            margin="dense"
                            required
                            fullWidth
                            id="otpCode"
                            label="Mã OTP"
                            name="otpCode"
                            autoComplete="one-time-code"
                            autoFocus
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            disabled={loading}
                            size="small"
                            inputProps={{ maxLength: 6 }}
                        />

                        <Box sx={{ position: 'relative' }}>
                            <TextField
                                margin="dense"
                                required
                                fullWidth
                                name="newPassword"
                                label="Mật khẩu mới"
                                type={showNewPassword ? 'text' : 'password'}
                                id="newPassword"
                                autoComplete="new-password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                disabled={loading}
                                size="small"
                            />
                            <IconButton
                                aria-label="toggle password visibility"
                                onClick={handleClickShowNewPassword}
                                onMouseDown={handleMouseDownPassword}
                                disabled={loading}
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
                                {showNewPassword ?
                                    <Visibility fontSize='small' sx={(theme) => ({ color: theme.palette.text.secondary })} /> :
                                    <VisibilityOff fontSize='small' sx={(theme) => ({ color: theme.palette.text.secondary })} />}
                            </IconButton>
                        </Box>

                        <Box sx={{ position: 'relative' }}>
                            <TextField
                                margin="dense"
                                required
                                fullWidth
                                name="confirmPassword"
                                label="Xác nhận mật khẩu mới"
                                type={showConfirmPassword ? 'text' : 'password'}
                                id="confirmPassword"
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={loading}
                                size="small"
                            />
                            <IconButton
                                aria-label="toggle password visibility"
                                onClick={handleClickShowConfirmPassword}
                                onMouseDown={handleMouseDownPassword}
                                disabled={loading}
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
                                {showConfirmPassword ?
                                    <Visibility fontSize='small' sx={(theme) => ({ color: theme.palette.text.secondary })} /> :
                                    <VisibilityOff fontSize='small' sx={(theme) => ({ color: theme.palette.text.secondary })} />}
                            </IconButton>
                        </Box>

                        {/* OTP Validity Countdown - Moved here before submit button */}
                        {otpValidityCountdown > 0 && (
                            <Box sx={{
                                mt: 1,
                                mb: 1,
                                p: 1.5,
                                borderRadius: 2,
                                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(107, 70, 193, 0.1)',
                                border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(107, 70, 193, 0.2)'}`
                            }}>
                                <Typography variant="body2" sx={{ textAlign: 'center', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                    <AccessTime fontSize="small" />
                                    Mã OTP hết hạn sau <strong>{formatTime(otpValidityCountdown)}</strong>
                                </Typography>
                            </Box>
                        )}

                        {otpValidityCountdown === 0 && step === 'reset' && (
                            <Alert severity="warning" sx={{ width: '100%', mt: 1, mb: 1 }}>
                                Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.
                            </Alert>
                        )}

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 2, mb: 1.5, py: 1, borderRadius: 2 }}
                            disabled={loading}
                        >
                            {loading ? <CircularProgress size={iconSize.progressMedium} color="inherit" /> : 'Đặt lại mật khẩu'}
                        </Button>

                        <Typography variant="body2" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
                            Không nhận được mã?
                            {resendCountdown > 0 ? (
                                <Typography component="span" sx={{ ml: 1, color: 'text.secondary' }}>
                                    Gửi lại sau {resendCountdown}s
                                </Typography>
                            ) : (
                                <Button
                                    variant="text"
                                    onClick={handleResendOtp}
                                    disabled={loading}
                                    sx={{ ml: 0.5 }}
                                >
                                    Gửi lại
                                </Button>
                            )}
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
}