'use client';

import React from 'react';
import { Box, Grid, Paper, Typography, Avatar, useTheme } from '@mui/material';
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

interface KpiCardsProps {
    kpis: KpiStats;
}

interface KpiCardConfig {
    key: keyof KpiStats;
    label: string;
    icon: React.ReactNode;
    isCurrency: boolean;
    isPercent: boolean;
    invertChange?: boolean; // true for metrics where lower is better (churn, pending)
}

const KPI_CONFIG: KpiCardConfig[] = [
    { key: 'total_revenue', label: 'Tổng doanh thu', icon: <RevenueIcon />, isCurrency: true, isPercent: false },
    { key: 'successful_orders', label: 'Đơn thành công', icon: <OrdersIcon />, isCurrency: false, isPercent: false },
    { key: 'new_users', label: 'User mới', icon: <NewUserIcon />, isCurrency: false, isPercent: false },
    { key: 'active_subscriptions', label: 'Subscriptions active', icon: <SubsIcon />, isCurrency: false, isPercent: false },
    { key: 'churn_rate', label: 'Tỷ lệ churn', icon: <ChurnIcon />, isCurrency: false, isPercent: true, invertChange: true },
    { key: 'pending_orders', label: 'Đơn chờ xử lý', icon: <PendingIcon />, isCurrency: false, isPercent: false, invertChange: true },
];

const KpiCards: React.FC<KpiCardsProps> = ({ kpis }) => {
    const theme = useTheme();

    const cardHoverStyles = {
        transition: theme.transitions.create(['transform', 'box-shadow'], {
            duration: theme.transitions.duration.short,
        }),
        '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: theme.shadows[3],
        },
    };

    return (
        <Grid container spacing={2.5}>
            {KPI_CONFIG.map((cfg) => {
                const metric = kpis[cfg.key];
                const change = calcChange(metric.current, metric.previous);
                const isPositiveChange = cfg.invertChange ? change <= 0 : change >= 0;
                const displayValue = cfg.isCurrency
                    ? formatCurrency(metric.current)
                    : cfg.isPercent
                        ? `${metric.current}%`
                        : metric.current.toLocaleString('vi-VN');

                return (
                    <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }} key={cfg.key}>
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 2.5,
                                borderRadius: theme.shape.borderRadius,
                                borderColor: theme.palette.divider,
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                ...cardHoverStyles,
                            }}
                        >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                <Box>
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                        {cfg.label}
                                    </Typography>
                                    <Typography variant="h5" component="h3" sx={{ mt: 0.5, color: 'text.primary' }}>
                                        {displayValue}
                                    </Typography>
                                </Box>
                                <Avatar
                                    sx={{
                                        bgcolor: theme.palette.mode === 'light' ? theme.palette.grey[100] : theme.palette.grey[800],
                                        color: 'text.secondary',
                                    }}
                                >
                                    {cfg.icon}
                                </Avatar>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                {isPositiveChange ? (
                                    <ArrowUpIcon sx={{ fontSize: 16, color: 'success.main' }} />
                                ) : (
                                    <ArrowDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
                                )}
                                <Typography
                                    variant="body2"
                                    sx={{ color: isPositiveChange ? 'success.main' : 'error.main', ml: 0.25 }}
                                >
                                    {Math.abs(change)}%
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.disabled', ml: 1 }}>
                                    vs kỳ trước
                                </Typography>
                            </Box>
                        </Paper>
                    </Grid>
                );
            })}
        </Grid>
    );
};

export default KpiCards;
