'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Grid, Alert, Button, Skeleton, useTheme, alpha,
} from '@mui/material';
import {
    TrendingUp as TrendingUpIcon,
    PieChart as PieChartIcon,
    EmojiEvents as EmojiEventsIcon,
    ReceiptLong as ReceiptLongIcon,
} from '@mui/icons-material';
import AdminBreadcrumb from '../components/AdminBreadcrumb';
import { apiClient } from 'services/apiClient';
import { DashboardStatsResponse } from './types';
import { borderRadius, getGlassCard, getGlassHighlight, getResponsiveFontSize, fontWeight } from 'theme/tokens';
import { useAuth } from '@/components/auth/AuthProvider';

import TimeFilterBar from './components/TimeFilterBar';
import KpiCards from './components/KpiCards';
import RevenueTrendChart from './components/RevenueTrendChart';
import UserGrowthChart from './components/UserGrowthChart';
import RevenueByLicenseChart from './components/RevenueByLicenseChart';
import SubscriptionDonut from './components/SubscriptionDonut';
import TransactionDonut from './components/TransactionDonut';
import TopPromotionsChart from './components/TopPromotionsChart';
import TopBrokersChart from './components/TopBrokersChart';
import RecentTransactions from './components/RecentTransactions';

/* ─── Section Header ──────────────────────────────────────────────── */
const SectionHeader: React.FC<{
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
}> = ({ icon, title, subtitle }) => {
    const theme = useTheme();
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    borderRadius: `${borderRadius.md}px`,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)}, ${alpha(theme.palette.primary.main, 0.05)})`,
                    color: theme.palette.primary.main,
                    '& svg': { fontSize: 20 },
                }}
            >
                {icon}
            </Box>
            <Box>
                <Typography
                    color="text.secondary"
                    sx={{
                        fontSize: getResponsiveFontSize('lg'),
                        fontWeight: fontWeight.semibold,
                        lineHeight: 1.3,
                        textTransform: 'uppercase',
                    }}
                >
                    {title}
                </Typography>
                {subtitle && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {subtitle}
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

/* ─── Broker Info Header ──────────────────────────────────────────── */
const BrokerInfoHeader: React.FC<{ name: string; referralCode: string; avatarUrl?: string | null }> = ({ name, referralCode, avatarUrl }) => {
    const theme = useTheme();
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 2.5,
                mb: 3,
                borderRadius: `${borderRadius.lg}px`,
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)}, ${alpha(theme.palette.primary.main, 0.04)})`,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            }}
        >
            <Box
                sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    flexShrink: 0,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: fontWeight.bold,
                    fontSize: '1.25rem',
                }}
            >
                {avatarUrl ? (
                    <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    name.charAt(0).toUpperCase()
                )}
            </Box>
            <Box>
                <Typography variant="h6" fontWeight={fontWeight.bold} color="text.primary">
                    {name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Mã broker: <strong style={{ color: theme.palette.primary.main }}>{referralCode}</strong>
                </Typography>
            </Box>
        </Box>
    );
};

/* ─── Chart Slot (lightweight inner label, no card border) ────────── */
const ChartSlot: React.FC<{
    title: string;
    children: React.ReactNode;
}> = ({ title, children }) => (
    <Box>
        <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: 'text.secondary', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: getResponsiveFontSize('sm') }}
        >
            {title}
        </Typography>
        {children}
    </Box>
);

/* ═══════════════════════════════════════════════════════════════════ */
/*  DASHBOARD PAGE                                                    */
/* ═══════════════════════════════════════════════════════════════════ */
const DashboardHomePage: React.FC = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { session, hasPermission } = useAuth();
    const isBroker = !hasPermission('transaction:read_any') && hasPermission('transaction:read_referred');
    const [data, setData] = useState<DashboardStatsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().slice(0, 10);
    });
    const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient({
                url: '/api/v1/admin/dashboard/stats',
                method: 'GET',
                queryParams: { start_date: startDate, end_date: endDate },
                useCache: false,   // Dashboard must always show real-time data
            });
            setData(response.data as DashboardStatsResponse);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Không thể tải dữ liệu dashboard';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRangeChange = useCallback((start: string, end: string) => {
        setStartDate(start);
        setEndDate(end);
    }, []);

    /* Glass card sx — consistent with the rest of the project */
    const glassSx = {
        ...getGlassCard(isDark),
        borderRadius: `${borderRadius.lg}px`,
        p: 2,
        position: 'relative' as const,
        '&::before': getGlassHighlight(isDark),
    };

    /* Skeleton helper */
    const sk = (h: number) => <Skeleton variant="rounded" height={h} sx={{ borderRadius: `${borderRadius.md}px` }} />;

    return (
        <Box>
            <AdminBreadcrumb />

            {/* ── Header Row ─────────────────────────────────────── */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: { xs: 'flex-start', md: 'center' },
                    justifyContent: 'space-between',
                    flexDirection: { xs: 'column', md: 'row' },
                    gap: 2,
                    mb: 3,
                }}
            >
                <Box>
                    <Typography
                        variant="h4"
                        component="h1"
                        sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}
                    >
                        Dashboard
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                        Tổng quan hoạt động kinh doanh
                    </Typography>
                </Box>
                <TimeFilterBar onRangeChange={handleRangeChange} onRefresh={fetchData} loading={loading} />
            </Box>

            {/* ── Error ──────────────────────────────────────────── */}
            {error && (
                <Alert
                    severity="error"
                    sx={{ mb: 3, borderRadius: `${borderRadius.md}px` }}
                    action={
                        <Button color="inherit" size="small" onClick={fetchData}>
                            Thử lại
                        </Button>
                    }
                >
                    {error}
                </Alert>
            )}

            {/* ── Broker Info Header ────────────────────────────── */}
            {isBroker && session?.user?.referral_code && (
                <BrokerInfoHeader
                    name={session.user.full_name}
                    referralCode={session.user.referral_code}
                    avatarUrl={session.user.avatar_url}
                />
            )}

            {/* ── KPI Strip ─────────────────────────────────────── */}
            <Box sx={{ mb: 3 }}>
                {loading || !data ? (
                    <Grid container spacing={2}>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Grid size={{ xs: 6, sm: 4, md: 3, lg: 'auto' }} key={i} sx={{ flex: { lg: 1 } }}>
                                {sk(110)}
                            </Grid>
                        ))}
                    </Grid>
                ) : (
                    <KpiCards kpis={data.kpis} totalUsers={data.total_users} isBroker={isBroker} />
                )}
            </Box>

            {/* ── Section 1–3 — Admin/Manager only ──────────────── */}
            {!isBroker && (
                <>
                    {/* ── Section 1 — Trend Analytics ────────────────────── */}
                    <Box sx={{ mb: 3 }}>
                        <Box sx={glassSx}>
                            <SectionHeader
                                icon={<TrendingUpIcon />}
                                title="Phân tích xu hướng"
                                subtitle="Doanh thu & tăng trưởng người dùng theo thời gian"
                            />
                            <Grid container spacing={3}>
                                <Grid size={{ xs: 12, lg: 6 }}>
                                    <ChartSlot title="Xu hướng doanh thu">
                                        {loading || !data ? sk(350) : <RevenueTrendChart data={data.revenue_trend} />}
                                    </ChartSlot>
                                </Grid>
                                <Grid size={{ xs: 12, lg: 6 }}>
                                    <ChartSlot title="Tăng trưởng người dùng">
                                        {loading || !data ? sk(350) : <UserGrowthChart data={data.user_growth} />}
                                    </ChartSlot>
                                </Grid>
                            </Grid>
                        </Box>
                    </Box>

                    {/* ── Section 2 — Distribution Breakdown ─────────────── */}
                    <Box sx={{ mb: 3 }}>
                        <Box sx={glassSx}>
                            <SectionHeader
                                icon={<PieChartIcon />}
                                title="Phân bổ & cơ cấu"
                                subtitle="Cơ cấu doanh thu, subscription và trạng thái giao dịch"
                            />
                            <Grid container spacing={3}>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <ChartSlot title="Doanh thu theo gói">
                                        {loading || !data ? sk(300) : <RevenueByLicenseChart data={data.revenue_by_license} />}
                                    </ChartSlot>
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <ChartSlot title="Phân bổ Subscription">
                                        {loading || !data ? sk(300) : <SubscriptionDonut data={data.subscription_distribution} />}
                                    </ChartSlot>
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <ChartSlot title="Trạng thái giao dịch">
                                        {loading || !data ? sk(300) : <TransactionDonut data={data.transaction_status} />}
                                    </ChartSlot>
                                </Grid>
                            </Grid>
                        </Box>
                    </Box>

                    {/* ── Section 3 — Top Rankings ───────────────────────── */}
                    <Box sx={{ mb: 3 }}>
                        <Box sx={glassSx}>
                            <SectionHeader
                                icon={<EmojiEventsIcon />}
                                title="Bảng xếp hạng"
                                subtitle="Top khuyến mãi & đối tác môi giới"
                            />
                            <Grid container spacing={3}>
                                <Grid size={{ xs: 12, lg: 6 }}>
                                    <ChartSlot title="Top khuyến mãi">
                                        {loading || !data ? sk(300) : <TopPromotionsChart data={data.top_promotions} />}
                                    </ChartSlot>
                                </Grid>
                                <Grid size={{ xs: 12, lg: 6 }}>
                                    <ChartSlot title="Top Brokers">
                                        {loading || !data ? sk(300) : <TopBrokersChart data={data.top_brokers} />}
                                    </ChartSlot>
                                </Grid>
                            </Grid>
                        </Box>
                    </Box>
                </>
            )}

            {/* ── Broker Revenue Trend ───────────────────────────── */}
            {isBroker && data && data.revenue_trend.length > 0 && (
                <>
                    <SectionHeader icon={<TrendingUpIcon />} title="Xu hướng doanh thu của bạn" />
                    <Grid container spacing={3} sx={{ mb: 4 }}>
                        <Grid size={{ xs: 12 }}>
                            <RevenueTrendChart data={data.revenue_trend} />
                        </Grid>
                    </Grid>
                </>
            )}

            {/* ── Section 4 — Recent Activity ────────────────────── */}
            <Box sx={glassSx}>
                <SectionHeader
                    icon={<ReceiptLongIcon />}
                    title={isBroker ? "Giao dịch qua mã của bạn" : "Giao dịch gần đây"}
                    subtitle="Giao dịch mới nhất trong hệ thống"
                />
                {loading || !data ? sk(200) : <RecentTransactions transactions={data.recent_transactions} />}
            </Box>
        </Box>
    );
};

export default DashboardHomePage;
