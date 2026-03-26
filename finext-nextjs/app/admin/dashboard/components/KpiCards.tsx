'use client';

import React from 'react';
import { Box, Grid, Typography, useTheme, alpha } from '@mui/material';
import {
    LocalAtm as RevenueIcon,
    ShoppingCartOutlined as OrdersIcon,
    PersonAddAlt1Outlined as NewUserIcon,
    CardMembership as SubsIcon,
    TrendingDown as ChurnIcon,
    HourglassEmpty as PendingIcon,
    BarChart as ArpuIcon,
    CompareArrows as ConversionIcon,
    ArrowUpward as ArrowUpIcon,
    ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import { KpiStats, formatCurrency, calcChange } from '../types';
import { borderRadius, getGlassCard, getGlassHighlight } from 'theme/tokens';

interface KpiCardsProps {
    kpis: KpiStats;
    totalUsers?: number;
}

interface KpiCardConfig {
    key: keyof KpiStats | 'arpu' | 'conversion_rate';
    label: string;
    icon: React.ReactNode;
    isCurrency: boolean;
    isPercent: boolean;
    invertChange?: boolean;
    accentHue: string; // css color string
}

// Project-aligned accent hues (matching tokens.ts primary violet + semantic palette)
const KPI_CONFIG: KpiCardConfig[] = [
    { key: 'total_revenue',        label: 'Tổng doanh thu',  icon: <RevenueIcon />,    isCurrency: true,  isPercent: false, accentHue: '#8b5cf6' }, // primary violet
    { key: 'successful_orders',    label: 'Đơn thành công',  icon: <OrdersIcon />,     isCurrency: false, isPercent: false, accentHue: '#10b981' }, // emerald
    { key: 'new_users',            label: 'User mới',        icon: <NewUserIcon />,    isCurrency: false, isPercent: false, accentHue: '#3b82f6' }, // blue
    { key: 'active_subscriptions', label: 'Subscriptions',   icon: <SubsIcon />,       isCurrency: false, isPercent: false, accentHue: '#f59e0b' }, // amber
    { key: 'arpu',                 label: 'ARPU',             icon: <ArpuIcon />,       isCurrency: true,  isPercent: false, accentHue: '#a855f7' }, // purple
    { key: 'churn_rate',           label: 'Tỷ lệ churn',     icon: <ChurnIcon />,      isCurrency: false, isPercent: true,  invertChange: true, accentHue: '#e14040' }, // rose (down trend)
    { key: 'pending_orders',       label: 'Đơn chờ xử lý',  icon: <PendingIcon />,    isCurrency: false, isPercent: false, invertChange: true, accentHue: '#ed6c02' }, // orange
    { key: 'conversion_rate',      label: 'Conversion',      icon: <ConversionIcon />, isCurrency: false, isPercent: true,  accentHue: '#06b6d4' }, // cyan
];

const KpiCards: React.FC<KpiCardsProps> = ({ kpis, totalUsers }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    // Compute derived metrics
    const activeSubs = kpis.active_subscriptions.current;
    const prevActiveSubs = kpis.active_subscriptions.previous;
    const totalRevenue = kpis.total_revenue.current;
    const prevRevenue = kpis.total_revenue.previous;

    const arpu = activeSubs > 0 ? totalRevenue / activeSubs : 0;
    const prevArpu = prevActiveSubs > 0 ? prevRevenue / prevActiveSubs : 0;

    // Conversion = active paid subs / total users × 100%
    const conversionRate = totalUsers && totalUsers > 0 ? parseFloat(((activeSubs / totalUsers) * 100).toFixed(1)) : 0;
    const prevConversionRate = 0; // placeholder — no totalUsers for prev period currently

    return (
        <Grid container spacing={2}>
            {KPI_CONFIG.map((cfg) => {
                // Resolve current & previous values
                let current: number;
                let previous: number;

                if (cfg.key === 'arpu') {
                    current = arpu;
                    previous = prevArpu;
                } else if (cfg.key === 'conversion_rate') {
                    current = conversionRate;
                    previous = prevConversionRate;
                } else {
                    const metric = kpis[cfg.key as keyof KpiStats];
                    current = metric.current;
                    previous = metric.previous;
                }

                const change = calcChange(current, previous);
                const isPositiveChange = cfg.invertChange ? change <= 0 : change >= 0;

                const displayValue = cfg.isCurrency
                    ? formatCurrency(current)
                    : cfg.isPercent
                        ? `${current}%`
                        : current.toLocaleString('vi-VN');

                const accentColor = cfg.accentHue;

                return (
                    <Grid size={{ xs: 6, sm: 4, md: 3, lg: 'auto' }} key={cfg.key} sx={{ flex: { lg: 1 } }}>
                        <Box
                            sx={{
                                ...getGlassCard(isDark),
                                borderRadius: `${borderRadius.lg}px`,
                                position: 'relative',
                                overflow: 'hidden',
                                p: 2,
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                '&::before': getGlassHighlight(isDark),
                            }}
                        >
                            {/* Top accent bar */}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: '3px',
                                    background: `linear-gradient(90deg, ${accentColor}, ${alpha(accentColor, 0.3)})`,
                                    zIndex: 1,
                                }}
                            />

                            {/* Icon + Label */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 28,
                                        height: 28,
                                        borderRadius: `${borderRadius.sm}px`,
                                        bgcolor: alpha(accentColor, isDark ? 0.15 : 0.1),
                                        color: accentColor,
                                        '& svg': { fontSize: 16 },
                                    }}
                                >
                                    {cfg.icon}
                                </Box>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: 'text.secondary',
                                        fontWeight: 500,
                                        lineHeight: 1.2,
                                        fontSize: '0.7rem',
                                    }}
                                >
                                    {cfg.label}
                                </Typography>
                            </Box>

                            {/* Value */}
                            <Typography
                                variant="h5"
                                component="p"
                                sx={{
                                    fontWeight: 700,
                                    color: 'text.primary',
                                    lineHeight: 1.2,
                                    mb: 1,
                                    fontSize: { xs: '1.05rem', sm: '1.2rem' },
                                }}
                            >
                                {displayValue}
                            </Typography>

                            {/* Change indicator */}
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Box
                                    sx={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 0.25,
                                        px: 0.75,
                                        py: 0.25,
                                        borderRadius: `${borderRadius.sm}px`,
                                        bgcolor: alpha(
                                            isPositiveChange
                                                ? theme.palette.success.main
                                                : theme.palette.error.main,
                                            isDark ? 0.15 : 0.08,
                                        ),
                                    }}
                                >
                                    {isPositiveChange ? (
                                        <ArrowUpIcon sx={{ fontSize: 14, color: 'success.main' }} />
                                    ) : (
                                        <ArrowDownIcon sx={{ fontSize: 14, color: 'error.main' }} />
                                    )}
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            fontSize: '0.68rem',
                                            fontWeight: 600,
                                            color: isPositiveChange ? 'success.main' : 'error.main',
                                        }}
                                    >
                                        {Math.abs(change)}%
                                    </Typography>
                                </Box>
                                <Typography
                                    variant="caption"
                                    sx={{ color: 'text.disabled', ml: 0.75, fontSize: '0.65rem' }}
                                >
                                    vs trước
                                </Typography>
                            </Box>
                        </Box>
                    </Grid>
                );
            })}
        </Grid>
    );
};

export default KpiCards;
