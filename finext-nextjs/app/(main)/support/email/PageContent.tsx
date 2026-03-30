'use client';

import { useState, useEffect } from 'react';
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
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { getResponsiveFontSize, fontWeight, borderRadius, getGlassCard, getGlassHighlight, getGlassEdgeLight, getGlowButton } from 'theme/tokens';

const FINEXT_EMAIL = 'finext.vn@gmail.com';

const subjectOptions = [
    'Hỗ trợ kỹ thuật',
    'Hỗ trợ sản phẩm',
    'Góp ý & Phản hồi',
    'Hợp tác kinh doanh',
    'Khác',
];

export default function EmailSupportContent() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const router = useRouter();
    const { session, loading } = useAuth();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [snackOpen, setSnackOpen] = useState(false);

    // Pre-fill from session
    useEffect(() => {
        if (session?.user) {
            setName(session.user.full_name || '');
            setEmail(session.user.email || '');
        }
    }, [session]);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!loading && !session) {
            router.push('/login?callbackUrl=/support/email');
        }
    }, [loading, session, router]);

    const isFormValid = name.trim() && email.trim() && subject && message.trim();

    const handleSubmit = () => {
        if (!isFormValid) return;
        const fullSubject = `[Finext] ${subject} - từ ${name}`;
        const fullBody = `Kính gửi Finext,\n\n${message}\n\n---\nHọ tên: ${name}\nEmail: ${email}`;
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(FINEXT_EMAIL)}&su=${encodeURIComponent(fullSubject)}&body=${encodeURIComponent(fullBody)}`;
        window.open(gmailUrl, '_blank');
        setSnackOpen(true);
    };

    const handleCopyEmail = () => {
        navigator.clipboard.writeText(FINEXT_EMAIL);
        setSnackOpen(true);
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

    // Show loading spinner while auth is resolving
    if (loading || !session) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress size={32} />
            </Box>
        );
    }

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
                        icon="mdi:email-fast-outline"
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
                    Gửi yêu cầu hỗ trợ
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
                    Điền nội dung bên dưới, hệ thống sẽ mở Gmail với thông tin được điền sẵn để bạn gửi đến Finext.
                </Typography>
            </Box>

            {/* Form Card */}
            <Card sx={{ ...cardStyle, width: '100%', p: { xs: 2.5, md: 4 } }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    {/* Name & Email Row — pre-filled & read-only */}
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                        <TextField
                            label="Họ và tên"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            fullWidth
                            required
                            InputProps={{ readOnly: !!session.user.full_name }}
                            sx={{
                                ...inputSx,
                                ...(session.user.full_name && {
                                    '& .MuiOutlinedInput-root': {
                                        ...inputSx['& .MuiOutlinedInput-root'],
                                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                    },
                                }),
                            }}
                        />
                        <TextField
                            label="Email"
                            type="email"
                            value={email}
                            fullWidth
                            required
                            InputProps={{ readOnly: true }}
                            sx={{
                                ...inputSx,
                                '& .MuiOutlinedInput-root': {
                                    ...inputSx['& .MuiOutlinedInput-root'],
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                },
                            }}
                        />
                    </Box>

                    {/* Subject */}
                    <TextField
                        select
                        label="Chủ đề"
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
                        label="Nội dung"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        fullWidth
                        required
                        multiline
                        rows={5}
                        sx={inputSx}
                    />

                    {/* Submit Button */}
                    <Button
                        variant="contained"
                        size="large"
                        disabled={!isFormValid}
                        onClick={handleSubmit}
                        startIcon={<Icon icon="mdi:gmail" width={20} />}
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
                        Mở Gmail và gửi
                    </Button>
                </Box>
            </Card>

            {/* Alternative: Copy email */}
            <Box
                sx={{
                    mt: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                }}
            >
                <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: theme.palette.text.secondary }}>
                    Hoặc gửi email trực tiếp đến:
                </Typography>
                <Box
                    onClick={handleCopyEmail}
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        cursor: 'pointer',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: `${borderRadius.sm}px`,
                        backgroundColor: isDark ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.08)',
                        border: `1px solid ${isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.15)'}`,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                            backgroundColor: isDark ? 'rgba(139,92,246,0.18)' : 'rgba(139,92,246,0.14)',
                            transform: 'translateY(-1px)',
                        },
                    }}
                >
                    <Typography
                        sx={{
                            fontSize: getResponsiveFontSize('sm'),
                            fontWeight: fontWeight.semibold,
                            color: theme.palette.primary.main,
                        }}
                    >
                        {FINEXT_EMAIL}
                    </Typography>
                    <Icon icon="mdi:content-copy" width={14} color={theme.palette.primary.main} />
                </Box>
            </Box>

            {/* Snackbar */}
            <Snackbar
                open={snackOpen}
                autoHideDuration={3000}
                onClose={() => setSnackOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackOpen(false)}
                    severity="success"
                    variant="filled"
                    sx={{ borderRadius: `${borderRadius.md}px` }}
                >
                    Đã sao chép email!
                </Alert>
            </Snackbar>
        </Box>
    );
}
