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

// ── Plan tiers ──
const plans = [
    {
        id: 'BASIC',
        label: 'Basic',
        icon: 'mdi:sprout',
        color: '#25b770',
        description: 'Công cụ phân tích thị trường cốt lõi — lý tưởng cho nhà đầu tư mới bắt đầu hành trình.',
        features: ['Dữ liệu thị trường realtime', 'Bảng giá & chỉ số tổng quan', 'Phân tích ngành & nhóm ngành', 'Cộng đồng nhà đầu tư Finext'],
    },
    {
        id: 'PROFESSIONAL',
        label: 'Professional',
        icon: 'mdi:crown',
        color: '#8b5cf6',
        description: 'Bộ công cụ phân tích chuyên sâu đầy đủ nhất — dành cho nhà đầu tư nghiêm túc và chuyên nghiệp.',
        features: ['Tất cả tính năng Basic', 'Bộ lọc cổ phiếu đa tiêu chí (50+ chỉ báo)', 'Phân tích kỹ thuật & dòng tiền nâng cao', 'Báo cáo định kỳ & bản tin thị trường', 'Nhóm Zalo VIP & tư vấn chuyên gia 1:1', 'Hỗ trợ ưu tiên'],
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
        description: 'Hơn 50 chỉ báo kỹ thuật, bộ lọc đa tiêu chí và tín hiệu giao dịch được xây dựng bởi đội ngũ chuyên gia.',
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
        title: 'Tư vấn từ chuyên gia',
        description: 'Hỗ trợ 1:1 từ đội ngũ chuyên gia giàu kinh nghiệm giúp xây dựng chiến lược đầu tư phù hợp với mục tiêu.',
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
        title: 'Chọn gói & đăng ký',
        description: 'Chọn gói quan tâm và điền thông tin liên hệ vào form bên dưới.',
    },
    {
        number: '02',
        title: 'Nhận tư vấn từ Finext',
        description: 'Đội ngũ Finext sẽ liên hệ trong vòng 24h để tư vấn chi tiết và hướng dẫn kích hoạt.',
    },
    {
        number: '03',
        title: 'Trải nghiệm đầy đủ',
        description: 'Tận hưởng toàn bộ tính năng của gói bạn chọn — ngay lập tức sau khi kích hoạt.',
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

    const isFormValid = name.trim() && phone.trim();

    const scrollToForm = () => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const handleSubmit = async () => {
        if (!isFormValid || submitting) return;
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
                    plan_interest: 'PROFESSIONAL',
                    note: note.trim() || null,
                },
            });
            setSnack({
                open: true,
                message: res.data?.message || 'Đăng ký thành công! Finext sẽ liên hệ tư vấn cho bạn sớm nhất.',
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
                    <Icon icon="mdi:crown-outline" width={36} height={36} color={theme.palette.primary.main} />
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
                    Nâng cấp trải nghiệm với{' '}
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
                        Finext Professional
                    </Box>
                </Typography>

                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('lg'),
                        color: theme.palette.text.secondary,
                        maxWidth: 600,
                        mx: 'auto',
                        mb: 3.5,
                        lineHeight: 1.7,
                    }}
                >
                    Bạn đang dùng gói Basic miễn phí — hãy nâng cấp lên <strong>Professional</strong> để mở khóa toàn bộ
                    công cụ phân tích chuyên sâu, bộ lọc cổ phiếu thông minh và quyền lợi tư vấn 1:1 từ chuyên gia.
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
                    Đăng ký tư vấn miễn phí
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
                    Các gói thành viên
                </Typography>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                        gap: 2.5,
                        maxWidth: 720,
                        mx: 'auto',
                    }}
                >
                    {plans.map((plan) => {
                        const isSelected = plan.id === 'PROFESSIONAL';
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
                    Tại sao chọn Finext?
                </Typography>
                <Typography sx={{
                    fontSize: getResponsiveFontSize('md'),
                    color: theme.palette.text.secondary,
                    textAlign: 'center',
                    mb: 4,
                }}>
                    Nền tảng phân tích đầu tư chứng khoán toàn diện — được xây dựng bởi chuyên gia.
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
                 HOW IT WORKS
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
                    Chỉ 3 bước để bắt đầu
                </Typography>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                        gap: 2.5,
                    }}
                >
                    {steps.map((step, i) => (
                        <Card key={step.number} sx={{ ...cardStyle, p: 3, textAlign: 'center' }}>
                            <Typography
                                sx={{
                                    fontSize: '2.5rem',
                                    fontWeight: fontWeight.extrabold,
                                    lineHeight: 1,
                                    mb: 1.5,
                                    background: isDark
                                        ? 'linear-gradient(135deg, #c4b5fd 0%, #93c5fd 100%)'
                                        : 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
                                    backgroundClip: 'text',
                                    WebkitBackgroundClip: 'text',
                                    color: 'transparent',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            >
                                {step.number}
                            </Typography>
                            <Typography sx={{
                                fontSize: getResponsiveFontSize('md'),
                                fontWeight: fontWeight.semibold,
                                color: theme.palette.text.primary,
                                mb: 1,
                            }}>
                                {step.title}
                            </Typography>
                            <Typography sx={{
                                fontSize: getResponsiveFontSize('sm'),
                                color: theme.palette.text.secondary,
                                lineHeight: 1.65,
                            }}>
                                {step.description}
                            </Typography>
                        </Card>
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
                            Đăng ký tư vấn miễn phí
                        </Typography>
                        <Typography sx={{
                            fontSize: getResponsiveFontSize('md'),
                            color: theme.palette.text.secondary,
                        }}>
                            Điền thông tin bên dưới — đội ngũ Finext sẽ liên hệ trong vòng 24 giờ.
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
                                Gửi yêu cầu tư vấn
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
                        Thông tin của bạn được bảo mật tuyệt đối và chỉ dùng để liên hệ tư vấn.
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
