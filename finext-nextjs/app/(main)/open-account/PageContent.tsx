'use client';

import { useState, useRef } from 'react';
import {
    Box,
    Typography,
    TextField,
    Button,
    Card,
    useTheme,
    Snackbar,
    Alert,
    CircularProgress,
    useMediaQuery,
} from '@mui/material';
import { Icon } from '@iconify/react';
import { apiClient } from 'services/apiClient';
import {
    getResponsiveFontSize,
    fontWeight,
    borderRadius,
    getGlassCard,
    getGlassHighlight,
    getGlassEdgeLight,
    getGlowButton,
} from 'theme/tokens';

// ── Benefits data ──
const benefits = [
    {
        icon: 'mdi:chart-timeline-variant-shimmer',
        title: 'Tính năng nâng cao vĩnh viễn',
        description: 'Truy cập toàn bộ công cụ phân tích chuyên sâu, bộ lọc thông minh và dữ liệu realtime trên Finext — hoàn toàn miễn phí, không giới hạn thời gian.',
    },
    {
        icon: 'mdi:account-tie',
        title: 'Hỗ trợ từ đội ngũ Finext',
        description: 'Nhận hỗ trợ 1:1 từ đội ngũ Finext — chia sẻ góc nhìn và hỗ trợ bạn tìm hiểu phương pháp đầu tư phù hợp với mục tiêu tài chính.',
    },
    {
        icon: 'mdi:account-group',
        title: 'Nhóm Zalo VIP',
        description: 'Tham gia cộng đồng nhà đầu tư chất lượng — cập nhật nhận định thị trường, tín hiệu giao dịch và thảo luận chuyên sâu mỗi ngày.',
    },
    {
        icon: 'mdi:newspaper-variant-outline',
        title: 'Bản tin thị trường hàng ngày',
        description: 'Nhận bản tin tổng hợp diễn biến thị trường và các mã cổ phiếu tiềm năng — gửi trực tiếp đến bạn mỗi sáng.',
    },
    {
        icon: 'mdi:file-chart-outline',
        title: 'Báo cáo chiến lược định kỳ',
        description: 'Báo cáo phân tích chuyên sâu theo tuần/tháng — bao gồm chiến lược giao dịch, phân bổ danh mục và quản trị rủi ro.',
    },
    {
        icon: 'mdi:infinity',
        title: 'Quyền lợi vĩnh viễn',
        description: 'Tất cả quyền lợi trên duy trì vĩnh viễn, không phí ẩn, không thời hạn — chỉ cần mở tài khoản chứng khoán theo hướng dẫn của Finext.',
    },
];

// ── Steps data ──
const steps = [
    {
        number: '01',
        title: 'Đăng ký thông tin',
        description: 'Điền form bên dưới với họ tên và số điện thoại của bạn.',
    },
    {
        number: '02',
        title: 'Nhận hỗ trợ từ Finext',
        description: 'Đội ngũ Finext sẽ liên hệ hướng dẫn bạn mở tài khoản chứng khoán.',
    },
    {
        number: '03',
        title: 'Nhận quyền lợi',
        description: 'Sau khi hoàn tất, bạn được kích hoạt toàn bộ quyền lợi vĩnh viễn.',
    },
];

export default function OpenAccountContent() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const formRef = useRef<HTMLDivElement>(null);

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false,
        message: '',
        severity: 'success',
    });
    const lastSubmitRef = useRef<number>(0);
    const COOLDOWN_MS = 60_000; // 1 phút cooldown giữa các lần gửi

    const isFormValid = name.trim() && phone.trim();

    const scrollToForm = () => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const handleSubmit = async () => {
        if (!isFormValid || submitting) return;

        const now = Date.now();
        if (now - lastSubmitRef.current < COOLDOWN_MS) {
            const remaining = Math.ceil((COOLDOWN_MS - (now - lastSubmitRef.current)) / 1000);
            setSnack({ open: true, message: `Vui lòng đợi ${remaining} giây trước khi gửi lại.`, severity: 'error' });
            return;
        }

        setSubmitting(true);
        try {
            const res = await apiClient({
                url: '/api/v1/emails/open-account',
                method: 'POST',
                requireAuth: false,
                body: {
                    customer_name: name.trim(),
                    phone_number: phone.trim(),
                    customer_email: email.trim() || null,
                    note: note.trim() || null,
                },
            });
            lastSubmitRef.current = Date.now();
            setSnack({
                open: true,
                message: res.data?.message || 'Đăng ký thành công! Finext sẽ liên hệ với bạn sớm nhất.',
                severity: 'success',
            });
            setName('');
            setPhone('');
            setEmail('');
            setNote('');
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
        '& .MuiInputLabel-root': { fontSize: getResponsiveFontSize('md') },
        '& .MuiInputBase-input': { fontSize: getResponsiveFontSize('md') },
    };

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 4, md: 6 } }}>

            {/* ══════════════════════════════════
                 HERO SECTION
            ══════════════════════════════════ */}
            <Box sx={{ textAlign: 'center', mb: { xs: 5, md: 7 } }}>
                <Box
                    sx={{
                        width: 72,
                        height: 72,
                        borderRadius: '50%',
                        background: isDark
                            ? 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(59,130,246,0.25))'
                            : 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(59,130,246,0.12))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2.5,
                    }}
                >
                    <Icon icon="mdi:shield-account-outline" width={36} height={36} color={theme.palette.primary.main} />
                </Box>

                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('h2'),
                        fontWeight: fontWeight.bold,
                        color: theme.palette.text.primary,
                        mb: 2,
                        lineHeight: 1.25,
                    }}
                >
                    Mở tài khoản chứng khoán
                    <br />
                    <Box
                        component="span"
                        sx={{
                            background: isDark
                                ? 'linear-gradient(90deg, #a78bfa, #60a5fa)'
                                : 'linear-gradient(90deg, #7c3aed, #3b82f6)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        nhận trọn bộ quyền lợi vĩnh viễn
                    </Box>
                </Typography>

                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('lg'),
                        color: theme.palette.text.secondary,
                        maxWidth: 640,
                        mx: 'auto',
                        lineHeight: 1.7,
                        mb: 3,
                    }}
                >
                    Mở tài khoản chứng khoán theo hướng dẫn của Finext để được kích hoạt toàn bộ tính năng nâng cao,
                    nhận hỗ trợ từ đội ngũ Finext và nhiều đặc quyền khác —{' '}
                    <strong>hoàn toàn miễn phí, không giới hạn thời gian.</strong>
                </Typography>

                <Button
                    variant="contained"
                    size="large"
                    onClick={scrollToForm}
                    startIcon={<Icon icon="mdi:arrow-down-circle-outline" width={22} />}
                    sx={{
                        py: 1.5,
                        px: 4,
                        borderRadius: `${borderRadius.md}px`,
                        fontWeight: fontWeight.semibold,
                        fontSize: getResponsiveFontSize('md'),
                        textTransform: 'none',
                        ...getGlowButton(isDark),
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                >
                    Đăng ký ngay
                </Button>
            </Box>

            {/* ══════════════════════════════════
                 BENEFITS GRID
            ══════════════════════════════════ */}
            <Box sx={{ mb: { xs: 5, md: 7 } }}>
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('h4'),
                        fontWeight: fontWeight.bold,
                        color: theme.palette.text.primary,
                        textAlign: 'center',
                        mb: { xs: 3, md: 4 },
                    }}
                >
                    Quyền lợi khi mở tài khoản qua Finext
                </Typography>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                        gap: { xs: 2, md: 2.5 },
                    }}
                >
                    {benefits.map((benefit) => (
                        <Card
                            key={benefit.title}
                            sx={{
                                ...cardStyle,
                                p: { xs: 2.5, md: 3 },
                                display: 'flex',
                                flexDirection: 'column',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                '&:hover': {
                                    transform: 'translateY(-3px)',
                                    boxShadow: isDark
                                        ? '0 8px 32px rgba(139,92,246,0.12)'
                                        : '0 8px 32px rgba(0,0,0,0.08)',
                                },
                            }}
                        >
                            <Box
                                sx={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: `${borderRadius.md}px`,
                                    background: isDark
                                        ? 'rgba(139,92,246,0.15)'
                                        : 'rgba(139,92,246,0.08)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    mb: 1.5,
                                }}
                            >
                                <Icon
                                    icon={benefit.icon}
                                    width={24}
                                    height={24}
                                    color={theme.palette.primary.main}
                                />
                            </Box>
                            <Typography
                                sx={{
                                    fontSize: getResponsiveFontSize('md'),
                                    fontWeight: fontWeight.semibold,
                                    color: theme.palette.text.primary,
                                    mb: 0.75,
                                }}
                            >
                                {benefit.title}
                            </Typography>
                            <Typography
                                sx={{
                                    fontSize: getResponsiveFontSize('sm'),
                                    color: theme.palette.text.secondary,
                                    lineHeight: 1.6,
                                }}
                            >
                                {benefit.description}
                            </Typography>
                        </Card>
                    ))}
                </Box>
            </Box>

            {/* ══════════════════════════════════
                 HOW IT WORKS (3 Steps)
            ══════════════════════════════════ */}
            <Box sx={{ mb: { xs: 5, md: 7 } }}>
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('h4'),
                        fontWeight: fontWeight.bold,
                        color: theme.palette.text.primary,
                        textAlign: 'center',
                        mb: { xs: 3, md: 4 },
                    }}
                >
                    Chỉ 3 bước đơn giản
                </Typography>

                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        gap: { xs: 2, md: 3 },
                        justifyContent: 'center',
                    }}
                >
                    {steps.map((step, idx) => (
                        <Box
                            key={step.number}
                            sx={{
                                flex: 1,
                                position: 'relative',
                                textAlign: 'center',
                                px: 2,
                            }}
                        >
                            {/* Connector line for desktop */}
                            {!isMobile && idx < steps.length - 1 && (
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        top: 28,
                                        right: -20,
                                        width: 40,
                                        height: 2,
                                        background: isDark
                                            ? 'linear-gradient(90deg, rgba(139,92,246,0.4), rgba(59,130,246,0.4))'
                                            : 'linear-gradient(90deg, rgba(139,92,246,0.25), rgba(59,130,246,0.25))',
                                        zIndex: 0,
                                    }}
                                />
                            )}

                            <Box
                                sx={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: '50%',
                                    background: isDark
                                        ? 'linear-gradient(135deg, #7c3aed, #3b82f6)'
                                        : 'linear-gradient(135deg, #8b5cf6, #60a5fa)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    mx: 'auto',
                                    mb: 1.5,
                                    position: 'relative',
                                    zIndex: 1,
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('lg'),
                                        fontWeight: fontWeight.bold,
                                        color: '#fff',
                                    }}
                                >
                                    {step.number}
                                </Typography>
                            </Box>
                            <Typography
                                sx={{
                                    fontSize: getResponsiveFontSize('md'),
                                    fontWeight: fontWeight.semibold,
                                    color: theme.palette.text.primary,
                                    mb: 0.5,
                                }}
                            >
                                {step.title}
                            </Typography>
                            <Typography
                                sx={{
                                    fontSize: getResponsiveFontSize('sm'),
                                    color: theme.palette.text.secondary,
                                    lineHeight: 1.5,
                                }}
                            >
                                {step.description}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            </Box>

            {/* ══════════════════════════════════
                 REGISTRATION FORM
            ══════════════════════════════════ */}
            <Box ref={formRef} sx={{ maxWidth: 600, mx: 'auto' }}>
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('h4'),
                        fontWeight: fontWeight.bold,
                        color: theme.palette.text.primary,
                        textAlign: 'center',
                        mb: 1,
                    }}
                >
                    Đăng ký mở tài khoản
                </Typography>
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        color: theme.palette.text.secondary,
                        textAlign: 'center',
                        mb: 3,
                        lineHeight: 1.6,
                    }}
                >
                    Để lại thông tin, Finext sẽ liên hệ hướng dẫn bạn mở tài khoản và kích hoạt quyền lợi.
                </Typography>

                <Card sx={{ ...cardStyle, p: { xs: 2.5, md: 4 } }}>
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

                        {/* Email */}
                        <TextField
                            label="Email (không bắt buộc)"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            fullWidth
                            sx={inputSx}
                        />

                        {/* Note */}
                        <TextField
                            label="Ghi chú (không bắt buộc)"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            fullWidth
                            multiline
                            rows={3}
                            placeholder="VD: Bạn đã có kinh nghiệm đầu tư chưa, đang quan tâm mảng nào..."
                            sx={inputSx}
                        />

                        {/* Submit */}
                        <Button
                            variant="contained"
                            size="large"
                            disabled={!isFormValid || submitting}
                            onClick={handleSubmit}
                            startIcon={
                                submitting
                                    ? <CircularProgress size={18} color="inherit" />
                                    : <Icon icon="mdi:rocket-launch-outline" width={20} />
                            }
                            sx={{
                                py: 1.5,
                                borderRadius: `${borderRadius.md}px`,
                                fontWeight: fontWeight.semibold,
                                fontSize: getResponsiveFontSize('md'),
                                textTransform: 'none',
                                ...getGlowButton(isDark),
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                '&.Mui-disabled': { opacity: 0.5 },
                            }}
                        >
                            {submitting ? 'Đang gửi...' : 'Đăng ký mở tài khoản'}
                        </Button>

                        {/* Trust signal */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
                            <Icon icon="mdi:shield-check" width={16} color={theme.palette.success.main} />
                            <Typography
                                sx={{
                                    fontSize: getResponsiveFontSize('xs'),
                                    color: theme.palette.text.disabled,
                                }}
                            >
                                Thông tin của bạn được bảo mật và chỉ dùng để liên hệ hỗ trợ.
                            </Typography>
                        </Box>
                    </Box>
                </Card>
            </Box>

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
