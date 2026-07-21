'use client';

import React, { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from 'services/apiClient';

// MUI
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import ArrowBack from '@mui/icons-material/ArrowBackIosNew';
import AccessTime from '@mui/icons-material/AccessTime';

import AuthCard from '../components/AuthCard';
import AuthField from '../components/AuthField';
import AuthAlert from '../components/AuthAlert';
import { iconSize, fontWeight, getGlowButton } from 'theme/tokens';

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
                    email: email.trim().toLowerCase(),
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
                    email: email.trim().toLowerCase(),
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
                    email: email.trim().toLowerCase(),
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
            <AuthCard title={step === 'email' ? 'Quên mật khẩu?' : 'Đặt lại mật khẩu'} hideLogoOnMobile>
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
                        <AuthAlert open={!!error} severity="error">
                            {error}
                        </AuthAlert>
                        <AuthAlert open={!!successMessage} severity="success">
                            {successMessage === 'otp_sent' ? (
                                <>Mã OTP đã được gửi đến email <strong>{email}</strong>. Vui lòng kiểm tra hộp thư.</>
                            ) : successMessage === 'otp_resent' ? (
                                <>Mã OTP mới đã được gửi đến email <strong>{email}</strong>.</>
                            ) : (
                                successMessage
                            )}
                        </AuthAlert>

                        <Typography variant="body2" sx={{ mb: 2, textAlign: 'center', color: 'text.secondary' }}>
                            Nhập email để nhận mã xác thực đặt lại mật khẩu.
                        </Typography>

                        <AuthField
                            margin="dense"
                            required
                            id="email"
                            label="Email"
                            name="email"
                            autoComplete="email"
                            autoFocus
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            size="medium"
                        />

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={(t) => ({ mt: 2, mb: 1.5, py: 1, borderRadius: 2, ...getGlowButton(t.palette.mode === 'dark') })}
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
                        <AuthAlert open={!!error} severity="error">
                            {error}
                        </AuthAlert>
                        <AuthAlert open={!!successMessage} severity="success">
                            {successMessage === 'otp_sent' ? (
                                <>Mã OTP đã được gửi đến email <strong>{email}</strong>.</>
                            ) : successMessage === 'otp_resent' ? (
                                <>Mã OTP mới đã được gửi đến email <strong>{email}</strong>.</>
                            ) : (
                                successMessage
                            )}
                        </AuthAlert>

                        <AuthField
                            margin="dense"
                            required
                            id="otpCode"
                            label="Mã OTP"
                            name="otpCode"
                            autoComplete="one-time-code"
                            autoFocus
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            disabled={loading}
                            size="medium"
                            inputProps={{ maxLength: 6 }}
                        />

                        <AuthField
                            margin="dense"
                            required
                            name="newPassword"
                            label="Mật khẩu mới"
                            id="newPassword"
                            autoComplete="new-password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={loading}
                            size="medium"
                            passwordToggle
                            showPassword={showNewPassword}
                            onTogglePassword={handleClickShowNewPassword}
                        />

                        <AuthField
                            margin="dense"
                            required
                            name="confirmPassword"
                            label="Xác nhận mật khẩu mới"
                            id="confirmPassword"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={loading}
                            size="medium"
                            passwordToggle
                            showPassword={showConfirmPassword}
                            onTogglePassword={handleClickShowConfirmPassword}
                        />

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
                                <Typography variant="body2" sx={{ textAlign: 'center', fontWeight: fontWeight.medium, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                    <AccessTime fontSize="small" />
                                    Mã OTP hết hạn sau <strong>{formatTime(otpValidityCountdown)}</strong>
                                </Typography>
                            </Box>
                        )}

                        <AuthAlert open={otpValidityCountdown === 0 && step === 'reset'} severity="warning">
                            Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.
                        </AuthAlert>

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={(t) => ({ mt: 2, mb: 1.5, py: 1, borderRadius: 2, ...getGlowButton(t.palette.mode === 'dark') })}
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
            </AuthCard>
        </Box>
    );
}