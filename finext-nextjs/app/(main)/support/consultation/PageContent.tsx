'use client';

import { useState, useRef } from 'react';
import {
    Box,
    Typography,
    TextField,
    Button,
    Card,
    useTheme,
    MenuItem,
    Snackbar,
    Alert,
    CircularProgress,
} from '@mui/material';
import { Icon } from '@iconify/react';
import { apiClient } from 'services/apiClient';
import { getResponsiveFontSize, fontWeight, borderRadius, getGlassCard, getGlassHighlight, getGlassEdgeLight, getGlowButton } from 'theme/tokens';

const subjectOptions = [
    'Hướng dẫn sử dụng sản phẩm Finext',
    'Tư vấn danh mục đầu tư',
    'Tư vấn phân tích kỹ thuật',
    'Tư vấn quản lý rủi ro',
    'Khác',
];

export default function ConsultationContent() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false,
        message: '',
        severity: 'success',
    });
    const lastSubmitRef = useRef<number>(0);
    const COOLDOWN_MS = 60_000; // 1 phút cooldown giữa các lần gửi

    const isFormValid = name.trim() && phone.trim() && subject;

    const handleSubmit = async () => {
        if (!isFormValid || submitting) return;

        // Rate limit: 1 lần/phút
        const now = Date.now();
        if (now - lastSubmitRef.current < COOLDOWN_MS) {
            const remaining = Math.ceil((COOLDOWN_MS - (now - lastSubmitRef.current)) / 1000);
            setSnack({ open: true, message: `Vui lòng đợi ${remaining} giây trước khi gửi lại.`, severity: 'error' });
            return;
        }

        setSubmitting(true);
        try {
            const res = await apiClient({
                url: '/api/v1/emails/consultation',
                method: 'POST',
                requireAuth: false,
                body: {
                    customer_name: name.trim(),
                    phone_number: phone.trim(),
                    customer_email: email.trim() || null,
                    subject_topic: subject,
                    message: message.trim() || null,
                },
            });

            lastSubmitRef.current = Date.now(); // Ghi nhận thời điểm gửi thành công
            setSnack({
                open: true,
                message: res.data?.message || 'Yêu cầu tư vấn đã được gửi thành công!',
                severity: 'success',
            });

            // Reset form
            setName('');
            setPhone('');
            setEmail('');
            setSubject('');
            setMessage('');
        } catch (err: any) {
            setSnack({
                open: true,
                message: err?.message || 'Gửi yêu cầu thất bại. Vui lòng thử lại sau.',
                severity: 'error',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const cardStyle = {
        borderRadius: `${borderRadius.lg}px`,
        backgroundImage: 'none',
        overflow: 'hidden',
        position: 'relative' as const,
        ...getGlassCard(isDark),
        '&::before': getGlassHighlight(isDark),
        '&::after': getGlassEdgeLight(isDark),
    };

    const inputSx = {
        '& .MuiOutlinedInput-root': {
            borderRadius: `${borderRadius.md}px`,
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            '& fieldset': {
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
                transition: 'border-color 0.2s ease',
            },
            '&:hover fieldset': {
                borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.25)',
            },
            '&.Mui-focused fieldset': {
                borderColor: theme.palette.primary.main,
                borderWidth: '2px',
            },
        },
        '& .MuiInputLabel-root': {
            fontSize: getResponsiveFontSize('md'),
        },
        '& .MuiInputBase-input': {
            fontSize: getResponsiveFontSize('md'),
        },
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                px: { xs: 2, md: 3 },
                py: { xs: 4, md: 6 },
                maxWidth: 720,
                mx: 'auto',
            }}
        >
            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: { xs: 3, md: 4 } }}>
                <Box
                    sx={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        background: isDark
                            ? 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,130,246,0.2))'
                            : 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(59,130,246,0.1))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2,
                    }}
                >
                    <Icon
                        icon="mdi:calendar-account-outline"
                        width={32}
                        height={32}
                        color={theme.palette.primary.main}
                    />
                </Box>
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('h3'),
                        fontWeight: fontWeight.bold,
                        color: theme.palette.text.primary,
                        mb: 1,
                    }}
                >
                    Đặt lịch tư vấn cá nhân
                </Typography>
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('md'),
                        color: theme.palette.text.secondary,
                        maxWidth: 480,
                        mx: 'auto',
                        lineHeight: 1.6,
                    }}
                >
                    Điền thông tin bên dưới, đội ngũ Finext sẽ liên hệ với bạn trong thời gian sớm nhất.
                </Typography>
            </Box>

            {/* Form Card */}
            <Card sx={{ ...cardStyle, width: '100%', p: { xs: 2.5, md: 4 } }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    {/* Name & Phone */}
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                        <TextField
                            label="Họ và tên"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            fullWidth
                            required
                            sx={inputSx}
                        />
                        <TextField
                            label="Số điện thoại"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            fullWidth
                            required
                            sx={inputSx}
                        />
                    </Box>

                    {/* Email (optional) */}
                    <TextField
                        label="Email (không bắt buộc)"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        fullWidth
                        sx={inputSx}
                    />

                    {/* Subject */}
                    <TextField
                        select
                        label="Chủ đề tư vấn"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        fullWidth
                        required
                        sx={inputSx}
                    >
                        {subjectOptions.map((option) => (
                            <MenuItem key={option} value={option}>
                                {option}
                            </MenuItem>
                        ))}
                    </TextField>

                    {/* Message */}
                    <TextField
                        label="Nội dung yêu cầu (không bắt buộc)"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        fullWidth
                        multiline
                        rows={4}
                        sx={inputSx}
                    />

                    {/* Submit Button */}
                    <Button
                        variant="contained"
                        size="large"
                        disabled={!isFormValid || submitting}
                        onClick={handleSubmit}
                        startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Icon icon="mdi:send" width={20} />}
                        sx={{
                            py: 1.5,
                            borderRadius: `${borderRadius.md}px`,
                            fontWeight: fontWeight.semibold,
                            fontSize: getResponsiveFontSize('md'),
                            textTransform: 'none',
                            ...getGlowButton(isDark),
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&.Mui-disabled': {
                                opacity: 0.5,
                            },
                        }}
                    >
                        {submitting ? 'Đang gửi...' : 'Đặt lịch tư vấn'}
                    </Button>
                </Box>
            </Card>

            {/* Snackbar */}
            <Snackbar
                open={snack.open}
                autoHideDuration={5000}
                onClose={() => setSnack(s => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnack(s => ({ ...s, open: false }))}
                    severity={snack.severity}
                    variant="filled"
                    sx={{ borderRadius: `${borderRadius.md}px` }}
                >
                    {snack.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
