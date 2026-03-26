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
    ArrowUpward as ArrowUpIcon,
    ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import { KpiStats, formatCurrency, calcChange } from '../types';
import { borderRadius, getGlassCard, getGlassHighlight } from 'theme/tokens';

interface KpiCardsProps {
    kpis: KpiStats;
}

interface KpiCardConfig {
    key: keyof KpiStats;
    label: string;
    icon: React.ReactNode;
    isCurrency: boolean;
    isPercent: boolean;
    invertChange?: boolean;
    accent: string; // hsl hue for subtle accent
}

const KPI_CONFIG: KpiCardConfig[] = [
    { key: 'total_revenue', label: 'Tổng doanh thu', icon: <RevenueIcon />, isCurrency: true, isPercent: false, accent: '270' },
    { key: 'successful_orders', label: 'Đơn thành công', icon: <OrdersIcon />, isCurrency: false, isPercent: false, accent: '150' },
    { key: 'new_users', label: 'User mới', icon: <NewUserIcon />, isCurrency: false, isPercent: false, accent: '210' },
    { key: 'active_subscriptions', label: 'Subscriptions', icon: <SubsIcon />, isCurrency: false, isPercent: false, accent: '30' },
    { key: 'churn_rate', label: 'Tỷ lệ churn', icon: <ChurnIcon />, isCurrency: false, isPercent: true, invertChange: true, accent: '0' },
    { key: 'pending_orders', label: 'Đơn chờ xử lý', icon: <PendingIcon />, isCurrency: false, isPercent: false, invertChange: true, accent: '45' },
];

const KpiCards: React.FC<KpiCardsProps> = ({ kpis }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return (
        <Grid container spacing={2}>
            {KPI_CONFIG.map((cfg) => {
                const metric = kpis[cfg.key];
                const change = calcChange(metric.current, metric.previous);
                const isPositiveChange = cfg.invertChange ? change <= 0 : change >= 0;
                const displayValue = cfg.isCurrency
                    ? formatCurrency(metric.current)
                    : cfg.isPercent
                        ? `${metric.current}%`
                        : metric.current.toLocaleString('vi-VN');

                const accentColor = isDark
                    ? `hsl(${cfg.accent}, 65%, 65%)`
                    : `hsl(${cfg.accent}, 55%, 50%)`;

                return (
                    <Grid size={{ xs: 6, sm: 4, lg: 2 }} key={cfg.key}>
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
                                    fontSize: { xs: '1.1rem', sm: '1.25rem' },
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
