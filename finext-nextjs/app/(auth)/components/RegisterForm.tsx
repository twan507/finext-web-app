'use client';

import React, { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from 'services/apiClient';

// MUI
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';

// Google OAuth
import { useGoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';

import AuthCard from './AuthCard';
import AuthField from './AuthField';
import AuthAlert from './AuthAlert';
import PasswordStrengthBar from './PasswordStrengthBar';
import { iconSize, layoutTokens, getResponsiveFontSize, fontWeight, getGlowButton } from 'theme/tokens';

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
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [showOtpStep, setShowOtpStep] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState('');
    // Compliance pivot 2026-05-07: OTP step replaced by success message — state below unused
    // const [otpCode, setOtpCode] = useState('');
    // const [otpLoading, setOtpLoading] = useState(false);
    // const [resendCooldown, setResendCooldown] = useState(0);

    const router = useRouter();

    // Compliance pivot 2026-05-07: OTP resend cooldown disabled
    // useEffect(() => {
    //     if (resendCooldown <= 0) return;
    //     const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    //     return () => clearTimeout(timer);
    // }, [resendCooldown]);

    useEffect(() => {
        if (!error) return;
        const timer = setTimeout(() => setError(null), 4000);
        return () => clearTimeout(timer);
    }, [error]);

    // Lấy Client ID từ environment variables
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    const handleClickShowPassword = () => setShowPassword((show) => !show);
    const handleClickShowConfirmPassword = () => setShowConfirmPassword((show) => !show);

    // Xóa lỗi của 1 field khi user gõ lại (phản hồi tức thì, không dồn all-at-once).
    const clearFieldError = (key: string) => {
        setFieldErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    // Validate cấp field: gom lỗi theo từng ô thay vì 1 chuỗi lỗi gộp.
    const validateForm = () => {
        const errs: Record<string, string> = {};
        if (!fullName.trim()) {
            errs.fullName = 'Vui lòng nhập họ và tên.';
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email.trim() || !emailRegex.test(email.trim())) {
            errs.email = 'Địa chỉ email không hợp lệ.';
        }
        if (phoneNumber.trim()) {
            const phoneRegex = /^(0|\+84)[3-9]\d{8}$/;
            if (!phoneRegex.test(phoneNumber.trim())) {
                errs.phoneNumber = 'Số điện thoại không hợp lệ (VD: 0912345678 hoặc +84912345678).';
            }
        }
        if (!password || password.length < 8) {
            errs.password = 'Mật khẩu phải có ít nhất 8 ký tự.';
        } else if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
            errs.password = 'Mật khẩu phải chứa ít nhất 1 chữ cái và 1 chữ số.';
        }
        if (password !== confirmPassword) {
            errs.confirmPassword = 'Mật khẩu xác nhận không khớp.';
        }
        if (referralCode.trim() && !/^[A-Za-z0-9]{4}$/.test(referralCode.trim())) {
            errs.referralCode = 'Mã giới thiệu phải gồm đúng 4 ký tự chữ hoặc số.';
        }
        if (!agreeTerms) {
            errs.terms = 'Vui lòng đồng ý với điều khoản sử dụng.';
        }
        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
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
                email: email.trim().toLowerCase(),
                phone_number: phoneNumber.trim() || undefined,
                password: password,
                referral_code: referralCode.trim() || undefined,
            };

            await apiClient<MessageResponse>({
                url: '/api/v1/auth/register',
                method: 'POST',
                body: registerData,
                requireAuth: false,
            });

            setRegisteredEmail(email.trim().toLowerCase());
            setShowOtpStep(true);
        } catch (err: any) {
            setError(err.message || 'Lỗi kết nối hoặc có lỗi xảy ra trong quá trình đăng ký.');
        } finally {
            setLoading(false);
        }
    };

    // Compliance pivot 2026-05-07: OTP verify/resend disabled — admin manual approval
    // const handleVerifyOtp = async () => {
    //     setOtpLoading(true);
    //     setError(null);
    //     setSuccessMessage(null);
    //     try {
    //         await apiClient<{ message?: string }>({
    //             url: '/api/v1/otps/verify',
    //             method: 'POST',
    //             body: { email: registeredEmail, otp_type: 'email_verification', otp_code: otpCode },
    //             requireAuth: false,
    //         });
    //         setSuccessMessage('Xác thực email thành công! Đang chuyển đến đăng nhập...');
    //         setTimeout(() => router.push('/login'), 2000);
    //     } catch (err: any) {
    //         setError(err.message || 'Lỗi xác thực OTP. Vui lòng thử lại.');
    //     } finally {
    //         setOtpLoading(false);
    //     }
    // };

    // const handleResendOtp = async () => {
    //     setError(null);
    //     setSuccessMessage(null);
    //     try {
    //         await apiClient({
    //             url: '/api/v1/otps/request',
    //             method: 'POST',
    //             body: { email: registeredEmail, otp_type: 'email_verification' },
    //             requireAuth: false,
    //         });
    //         setResendCooldown(60);
    //     } catch (err: any) {
    //         setError(err.message || 'Không thể gửi lại mã OTP. Vui lòng thử lại.');
    //     }
    // };

    return (
        <AuthCard title="Tạo tài khoản mới!" hideLogoOnMobile>
            {showOtpStep ? (
                /* Compliance pivot 2026-05-07: bỏ OTP step, hiện success message.
                   Admin sẽ kích hoạt tài khoản thủ công trong vòng 1 giờ. */
                <Box sx={{ width: '100%' }}>
                    <AuthAlert open severity="success">
                        <strong>Yêu cầu tạo tài khoản thành công!</strong>
                        <br />
                        Chúng tôi đã gửi email xác nhận đến <strong>{registeredEmail}</strong>.
                        <br />
                        Đội ngũ Finext sẽ xét duyệt yêu cầu trong vòng <strong>1 giờ</strong>. Tài khoản sẽ được kích hoạt nếu đáp ứng đủ điều kiện.
                    </AuthAlert>
                    <Button
                        fullWidth
                        variant="contained"
                        onClick={() => router.push('/login')}
                        sx={(t) => ({
                            py: 1, borderRadius: 2,
                            ...getGlowButton(t.palette.mode === 'dark'),
                        })}
                    >
                        Quay lại trang đăng nhập
                    </Button>
                </Box>
            ) : (
            <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
                <AuthAlert open={!!error} severity="error">
                    {error}
                </AuthAlert>
                <AuthAlert open={!!successMessage} severity="success">
                    {successMessage}
                </AuthAlert>

                <AuthField
                    margin="dense"
                    required
                    id="fullName"
                    label="Họ và tên"
                    name="fullName"
                    autoComplete="name"
                    autoFocus
                    value={fullName}
                    onChange={(e) => { setFullName(e.target.value); clearFieldError('fullName'); }}
                    disabled={loading || googleLoading || !!successMessage}
                    size="small"
                    error={!!fieldErrors.fullName}
                    helperText={fieldErrors.fullName}
                />

                <AuthField
                    margin="dense"
                    required
                    id="email"
                    label="Email"
                    name="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
                    disabled={loading || googleLoading || !!successMessage}
                    size="small"
                    error={!!fieldErrors.email}
                    helperText={fieldErrors.email}
                />

                <AuthField
                    margin="dense"
                    id="phoneNumber"
                    label="Số điện thoại (không bắt buộc)"
                    name="phoneNumber"
                    autoComplete="tel"
                    value={phoneNumber}
                    onChange={(e) => { setPhoneNumber(e.target.value); clearFieldError('phoneNumber'); }}
                    disabled={loading || googleLoading || !!successMessage}
                    size="small"
                    error={!!fieldErrors.phoneNumber}
                    helperText={fieldErrors.phoneNumber}
                />

                <AuthField
                    margin="dense"
                    required
                    name="password"
                    label="Mật khẩu (tối thiểu 8 ký tự)"
                    id="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
                    disabled={loading || googleLoading || !!successMessage}
                    size="small"
                    passwordToggle
                    showPassword={showPassword}
                    onTogglePassword={handleClickShowPassword}
                    error={!!fieldErrors.password}
                    helperText={fieldErrors.password}
                />
                <PasswordStrengthBar password={password} />

                <AuthField
                    margin="dense"
                    required
                    name="confirmPassword"
                    label="Xác nhận mật khẩu"
                    id="confirmPassword"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError('confirmPassword'); }}
                    disabled={loading || googleLoading || !!successMessage}
                    size="small"
                    passwordToggle
                    showPassword={showConfirmPassword}
                    onTogglePassword={handleClickShowConfirmPassword}
                    error={!!fieldErrors.confirmPassword}
                    helperText={fieldErrors.confirmPassword}
                />

                <AuthField
                    margin="dense"
                    id="referralCode"
                    label="Mã giới thiệu (không bắt buộc)"
                    name="referralCode"
                    value={referralCode}
                    onChange={(e) => { setReferralCode(e.target.value); clearFieldError('referralCode'); }}
                    disabled={loading || googleLoading || !!successMessage}
                    size="small"
                    error={!!fieldErrors.referralCode}
                    helperText={fieldErrors.referralCode}
                />

                <FormControlLabel
                    control={
                        <Checkbox
                            size="small"
                            checked={agreeTerms}
                            onChange={(e) => { setAgreeTerms(e.target.checked); clearFieldError('terms'); }}
                            disabled={loading || googleLoading || !!successMessage}
                            tabIndex={-1}
                        />
                    }
                    label={
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                            Tôi đã đọc và đồng ý với <Link href="/policies/content" underline="hover" tabIndex={-1}>Chính sách nội dung</Link> <br></br> và <Link href="policies/privacy" underline="hover" tabIndex={-1}>Chính sách bảo mật</Link>
                        </Typography>
                    }
                    sx={{ mt: 1.5, mb: fieldErrors.terms ? 0.5 : 2, alignItems: 'flex-start' }}
                />
                {fieldErrors.terms && (
                    <Typography
                        sx={(theme) => ({
                            mb: 1.5,
                            ml: 0.5,
                            fontSize: getResponsiveFontSize('xs'),
                            color: theme.palette.error.main,
                        })}
                    >
                        {fieldErrors.terms}
                    </Typography>
                )}

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

                {/* Compliance pivot 2026-05-07: Google register hidden — bypass admin approval flow. */}
                {false && (
                    <>
                        <Divider sx={{ my: 1.5 }}>hoặc</Divider>
                        {googleClientId ? (
                            <GoogleOAuthProvider clientId={googleClientId!}>
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
                    </>
                )}

                <Typography variant="body2" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
                    Đã có tài khoản? <Link href="/login" tabIndex={-1}>Đăng nhập</Link>
                </Typography>
            </Box>
            )}
        </AuthCard>
    );
}