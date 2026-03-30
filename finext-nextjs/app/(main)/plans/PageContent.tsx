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

// ── Support tiers ──
const plans = [
    {
        id: 'BASIC',
        label: 'Cộng đồng',
        icon: 'mdi:sprout',
        color: '#25b770',
        description: 'Truy cập miễn phí các công cụ phân tích cốt lõi — dành cho mọi người dùng Finext.',
        features: ['Dữ liệu thị trường realtime', 'Bảng giá & chỉ số tổng quan', 'Phân tích ngành & nhóm ngành', 'Cộng đồng nhà đầu tư Finext'],
    },
    {
        id: 'PATRON',
        label: 'Hội viên Patron',
        icon: 'mdi:handshake',
        color: '#ed6c02',
        description: 'Ủng hộ dự án Finext để duy trì & phát triển nền tảng — nhận quyền truy cập toàn bộ tính năng nâng cao trong suốt thời gian đăng ký.',
        features: ['Tất cả tính năng Cộng đồng', 'Bộ lọc cổ phiếu đa tiêu chí (50+ chỉ báo)', 'Phân tích kỹ thuật & dòng tiền nâng cao', 'Báo cáo định kỳ & bản tin thị trường', 'Nhóm Zalo VIP & trao đổi 1:1 với đội ngũ Finext', 'Hỗ trợ ưu tiên'],
    },
];

// ── Key benefits ──
const benefits = [
    {
        icon: 'fluent-color:data-area-20',
        title: 'Dữ liệu thị trường realtime',
        description: 'Theo dõi biến động chỉ số, dòng tiền, giao dịch nước ngoài và tự doanh cập nhật liên tục trong phiên.',
    },
    {
        icon: 'fluent-color:arrow-trending-lines-24',
        title: 'Phân tích kỹ thuật chuyên sâu',
        description: 'Hơn 50 chỉ báo kỹ thuật, bộ lọc đa tiêu chí và tín hiệu giao dịch được xây dựng bởi đội ngũ Finext.',
    },
    {
        icon: 'fluent-color:poll-16',
        title: 'Sàng lọc cổ phiếu thông minh',
        description: 'Khám phá cơ hội đầu tư trên hơn 1,600 mã cổ phiếu với bộ lọc kết hợp phân tích cơ bản và kỹ thuật.',
    },
    {
        icon: 'fluent-color:book-star-24',
        title: 'Báo cáo & bản tin định kỳ',
        description: 'Nhận phân tích thị trường, chiến lược danh mục và tín hiệu giao dịch gửi trực tiếp mỗi ngày.',
    },
    {
        icon: 'mdi:account-tie',
        title: 'Hỗ trợ từ đội ngũ Finext',
        description: 'Hỗ trợ 1:1 từ đội ngũ Finext — chia sẻ góc nhìn và hỗ trợ bạn tìm hiểu phương pháp đầu tư phù hợp với mục tiêu.',
    },
    {
        icon: 'mdi:account-group',
        title: 'Cộng đồng nhà đầu tư VIP',
        description: 'Tham gia nhóm Zalo cập nhật nhận định thị trường, tín hiệu giao dịch và thảo luận chuyên sâu mỗi ngày.',
    },
];

// ── Steps ──
const steps = [
    {
        number: '01',
        title: 'Đăng ký ủng hộ',
        description: 'Điền thông tin liên hệ vào form bên dưới để đăng ký đồng hành cùng Finext.',
    },
    {
        number: '02',
        title: 'Nhận hướng dẫn từ Finext',
        description: 'Finext sẽ liên hệ trong vòng 24h để hướng dẫn chi tiết và kích hoạt quyền truy cập.',
    },
    {
        number: '03',
        title: 'Truy cập đầy đủ',
        description: 'Mở khóa toàn bộ và truy cập không giới hạn các tính năng nâng cao.',
    },
];

export default function PlansPageContent() {
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
                url: '/api/v1/emails/plan-inquiry',
                method: 'POST',
                requireAuth: false,
                body: {
                    customer_name: name.trim(),
                    phone_number: phone.trim(),
                    customer_email: email.trim() || null,
                    plan_interest: 'PATRON',
                    note: note.trim() || null,
                },
            });
            lastSubmitRef.current = Date.now();
            setSnack({
                open: true,
                message: res.data?.message || 'Đăng ký thành công! Đội ngũ Finext sẽ liên hệ bạn sớm nhất.',
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
                    <Icon icon="mdi:heart-outline" width={36} height={36} color={theme.palette.primary.main} />
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
                    Đồng hành cùng{' '}
                    <Box
                        component="span"
                        sx={{
                            background: isDark
                                ? 'linear-gradient(135deg, #c4b5fd, #93c5fd)'
                                : 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            color: 'transparent',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        Finext
                    </Box>
                </Typography>

                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('lg'),
                        color: theme.palette.text.secondary,
                        maxWidth: 750,
                        mx: 'auto',
                        mb: 3.5,
                        lineHeight: 1.7,
                    }}
                >
                    Finext là nền tảng dữ liệu chứng khoán độc lập, được duy trì và phát triển bởi cộng đồng.
                    Sự đồng hành của bạn giúp nền tảng tiếp tục phát triển — đổi lại, bạn nhận quyền truy cập{' '}
                    <strong style={{ color: theme.palette.primary.main }}>toàn bộ</strong> công cụ phân tích nâng cao trong suốt thời gian đăng ký.
                </Typography>

                <Button
                    variant="contained"
                    size="large"
                    onClick={scrollToForm}
                    sx={{
                        borderRadius: `${borderRadius.pill}px`,
                        px: 4,
                        py: 1.5,
                        fontSize: getResponsiveFontSize('md'),
                        fontWeight: fontWeight.semibold,
                        textTransform: 'none',
                        color: '#fff',
                        background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                        ...getGlowButton(isDark),
                        '&:hover': {
                            background: 'linear-gradient(135deg, #6d28d9, #2563eb)',
                        },
                    }}
                >
                    Ủng hộ ngay
                </Button>
            </Box>

            {/* ══════════════════════════════════
                 PLANS GRID
            ══════════════════════════════════ */}
            <Box sx={{ mb: { xs: 5, md: 7 } }}>
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('xl'),
                        fontWeight: fontWeight.bold,
                        color: theme.palette.text.primary,
                        textAlign: 'center',
                        mb: 4,
                    }}
                >
                    Hình thức đồng hành
                </Typography>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                        gap: 2.5,
                        maxWidth: 780,
                        mx: 'auto',
                    }}
                >
                    {plans.map((plan) => {
                        const isSelected = plan.id === 'PATRON';
                        return (
                            <Card
                                key={plan.id}
                                sx={{
                                    ...cardStyle,
                                    p: 3,
                                    border: isSelected
                                        ? `2px solid ${plan.color}`
                                        : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                                    boxShadow: isSelected
                                        ? `0 0 0 4px ${plan.color}22, 0 8px 24px rgba(0,0,0,0.12)`
                                        : undefined,
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                                    <Box
                                        sx={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: `${borderRadius.md}px`,
                                            background: `${plan.color}22`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Icon icon={plan.icon} width={22} height={22} color={plan.color} />
                                    </Box>
                                    <Typography sx={{
                                        fontSize: getResponsiveFontSize('lg'),
                                        fontWeight: fontWeight.bold,
                                        color: isSelected ? plan.color : theme.palette.text.primary,
                                    }}>
                                        {plan.label}
                                    </Typography>
                                    {isSelected && (
                                        <Box sx={{ ml: 'auto' }}>
                                            <Icon icon="mdi:check-circle" width={20} height={20} color={plan.color} />
                                        </Box>
                                    )}
                                </Box>

                                <Typography sx={{
                                    fontSize: getResponsiveFontSize('sm'),
                                    color: theme.palette.text.secondary,
                                    mb: 2,
                                    lineHeight: 1.6,
                                }}>
                                    {plan.description}
                                </Typography>

                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                    {plan.features.map((f) => (
                                        <Box key={f} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                            <Icon icon="mdi:check" width={16} height={16} color={plan.color} style={{ marginTop: 2, flexShrink: 0 }} />
                                            <Typography sx={{
                                                fontSize: getResponsiveFontSize('sm'),
                                                color: theme.palette.text.secondary,
                                                lineHeight: 1.5,
                                            }}>
                                                {f}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            </Card>
                        );
                    })}
                </Box>
            </Box>

            {/* ══════════════════════════════════
                 BENEFITS GRID
            ══════════════════════════════════ */}
            <Box sx={{ mb: { xs: 5, md: 7 } }}>
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('xl'),
                        fontWeight: fontWeight.bold,
                        color: theme.palette.text.primary,
                        textAlign: 'center',
                        mb: 1.5,
                    }}
                >
                    Bạn nhận được gì khi ủng hộ?
                </Typography>
                <Typography sx={{
                    fontSize: getResponsiveFontSize('md'),
                    color: theme.palette.text.secondary,
                    textAlign: 'center',
                    mb: 4,
                }}>
                    Toàn bộ tính năng nâng cao được mở khóa trong suốt thời gian đăng ký — cảm ơn bạn đã đồng hành cùng Finext.
                </Typography>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                        gap: 2.5,
                    }}
                >
                    {benefits.map((b) => (
                        <Card key={b.title} sx={{ ...cardStyle, p: 3 }}>
                            <Box
                                sx={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: `${borderRadius.md}px`,
                                    background: isDark
                                        ? 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,130,246,0.15))'
                                        : 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(59,130,246,0.08))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    mb: 2,
                                }}
                            >
                                <Icon icon={b.icon} width={26} height={26} />
                            </Box>
                            <Typography sx={{
                                fontSize: getResponsiveFontSize('md'),
                                fontWeight: fontWeight.semibold,
                                color: theme.palette.text.primary,
                                mb: 1,
                            }}>
                                {b.title}
                            </Typography>
                            <Typography sx={{
                                fontSize: getResponsiveFontSize('sm'),
                                color: theme.palette.text.secondary,
                                lineHeight: 1.65,
                            }}>
                                {b.description}
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
                        fontSize: getResponsiveFontSize('xl'),
                        fontWeight: fontWeight.bold,
                        color: theme.palette.text.primary,
                        textAlign: 'center',
                        mb: { xs: 3, md: 4 },
                    }}
                >
                    Chỉ 3 bước để bắt đầu
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
                 CONTACT FORM
            ══════════════════════════════════ */}
            <Box ref={formRef}>
                <Card sx={{ ...cardStyle, p: { xs: 3, md: 5 } }}>
                    {/* Form header */}
                    <Box sx={{ textAlign: 'center', mb: 4 }}>
                        <Typography
                            sx={{
                                fontSize: getResponsiveFontSize('xxl'),
                                fontWeight: fontWeight.bold,
                                color: theme.palette.text.primary,
                                mb: 1,
                            }}
                        >
                            Đăng ký ủng hộ dự án
                        </Typography>
                        <Typography sx={{
                            fontSize: getResponsiveFontSize('md'),
                            color: theme.palette.text.secondary,
                        }}>
                            Để lại thông tin — đội ngũ Finext sẽ liên hệ hướng dẫn trong vòng 24 giờ.
                        </Typography>
                    </Box>

                    {/* Fields */}
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                            gap: 2,
                            mb: 2,
                        }}
                    >
                        <TextField
                            label="Họ và tên *"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            fullWidth
                            sx={inputSx}
                        />
                        <TextField
                            label="Số điện thoại *"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            fullWidth
                            sx={inputSx}
                        />
                    </Box>

                    <TextField
                        label="Email (tuỳ chọn)"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        fullWidth
                        sx={{ ...inputSx, mb: 2 }}
                    />
                    <TextField
                        label="Ghi chú thêm (tuỳ chọn)"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                        placeholder="Câu hỏi, yêu cầu đặc biệt hoặc thời điểm bạn muốn được liên hệ..."
                        sx={{ ...inputSx, mb: 3 }}
                    />

                    <Button
                        variant="contained"
                        size="large"
                        fullWidth
                        disabled={!isFormValid || submitting}
                        onClick={handleSubmit}
                        sx={{
                            borderRadius: `${borderRadius.md}px`,
                            py: 1.75,
                            fontSize: getResponsiveFontSize('md'),
                            fontWeight: fontWeight.semibold,
                            textTransform: 'none',
                            color: '#fff',
                            background: isFormValid
                                ? 'linear-gradient(135deg, #7c3aed, #3b82f6)'
                                : undefined,
                            ...(isFormValid ? getGlowButton(isDark) : {}),
                            '&:hover': {
                                background: isFormValid
                                    ? 'linear-gradient(135deg, #6d28d9, #2563eb)'
                                    : undefined,
                                boxShadow: 'none',
                            },
                            '&.Mui-disabled': {
                                opacity: 0.5,
                            },
                        }}
                    >
                        {submitting ? (
                            <CircularProgress size={22} sx={{ color: 'white' }} />
                        ) : (
                            <>
                                <Icon icon="mdi:send" width={18} height={18} style={{ marginRight: 8 }} />
                                Gửi yêu cầu
                            </>
                        )}
                    </Button>

                    <Typography
                        sx={{
                            fontSize: getResponsiveFontSize('xs'),
                            color: theme.palette.text.disabled,
                            textAlign: 'center',
                            mt: 2,
                        }}
                    >
                        Thông tin của bạn được bảo mật tuyệt đối và chỉ dùng để liên hệ hỗ trợ.
                    </Typography>
                </Card>
            </Box>

            <Snackbar
                open={snack.open}
                autoHideDuration={6000}
                onClose={() => setSnack(s => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    severity={snack.severity}
                    onClose={() => setSnack(s => ({ ...s, open: false }))}
                    sx={{ borderRadius: `${borderRadius.md}px`, fontSize: getResponsiveFontSize('sm') }}
                >
                    {snack.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
