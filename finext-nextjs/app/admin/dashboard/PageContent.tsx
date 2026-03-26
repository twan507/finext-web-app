'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, Grid, Alert, Button, Skeleton, useTheme,
} from '@mui/material';
import AdminBreadcrumb from '../components/AdminBreadcrumb';
import { apiClient } from 'services/apiClient';
import { DashboardStatsResponse } from './types';

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

const DashboardHomePage: React.FC = () => {
    const theme = useTheme();
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

    const cardHoverStyles = {
        transition: theme.transitions.create(['transform', 'box-shadow'], {
            duration: theme.transitions.duration.short,
        }),
        '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: theme.shadows[3],
        },
    };

    const sectionPaperSx = {
        p: 2.5,
        borderRadius: theme.shape.borderRadius,
        borderColor: theme.palette.divider,
        ...cardHoverStyles,
    };

    return (
        <Box>
            <AdminBreadcrumb />

            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" component="h1" sx={{ mb: 0.5, color: 'text.primary' }}>
                    Dashboard Overview
                </Typography>
            </Box>

            {/* Time Filter */}
            <Box sx={{ mb: 3 }}>
                <TimeFilterBar onRangeChange={handleRangeChange} onRefresh={fetchData} loading={loading} />
            </Box>

            {/* Error */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }} action={
                    <Button color="inherit" size="small" onClick={fetchData}>Thử lại</Button>
                }>
                    {error}
                </Alert>
            )}

            {/* KPI Cards */}
            <Box sx={{ mb: 3 }}>
                {loading || !data ? (
                    <Grid container spacing={2.5}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }} key={i}>
                                <Skeleton variant="rounded" height={130} />
                            </Grid>
                        ))}
                    </Grid>
                ) : (
                    <KpiCards kpis={data.kpis} />
                )}
            </Box>

            {/* Row 1: Revenue Trend + User Growth */}
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, lg: 6 }}>
                    <Paper variant="outlined" sx={sectionPaperSx}>
                        <Typography variant="h6" sx={{ mb: 2, color: 'text.primary' }}>
                            Xu hướng doanh thu
                        </Typography>
                        {loading || !data ? (
                            <Skeleton variant="rounded" height={350} />
                        ) : (
                            <RevenueTrendChart data={data.revenue_trend} />
                        )}
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                    <Paper variant="outlined" sx={sectionPaperSx}>
                        <Typography variant="h6" sx={{ mb: 2, color: 'text.primary' }}>
                            Tăng trưởng người dùng
                        </Typography>
                        {loading || !data ? (
                            <Skeleton variant="rounded" height={350} />
                        ) : (
                            <UserGrowthChart data={data.user_growth} />
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {/* Row 2: Revenue by License + Subscription Donut + Transaction Donut */}
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper variant="outlined" sx={sectionPaperSx}>
                        <Typography variant="h6" sx={{ mb: 2, color: 'text.primary' }}>
                            Doanh thu theo gói
                        </Typography>
                        {loading || !data ? (
                            <Skeleton variant="rounded" height={300} />
                        ) : (
                            <RevenueByLicenseChart data={data.revenue_by_license} />
                        )}
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper variant="outlined" sx={sectionPaperSx}>
                        <Typography variant="h6" sx={{ mb: 2, color: 'text.primary' }}>
                            Phân bổ Subscription
                        </Typography>
                        {loading || !data ? (
                            <Skeleton variant="rounded" height={300} />
                        ) : (
                            <SubscriptionDonut data={data.subscription_distribution} />
                        )}
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper variant="outlined" sx={sectionPaperSx}>
                        <Typography variant="h6" sx={{ mb: 2, color: 'text.primary' }}>
                            Trạng thái giao dịch
                        </Typography>
                        {loading || !data ? (
                            <Skeleton variant="rounded" height={300} />
                        ) : (
                            <TransactionDonut data={data.transaction_status} />
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {/* Row 3: Top Promotions + Top Brokers */}
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, lg: 6 }}>
                    <Paper variant="outlined" sx={sectionPaperSx}>
                        <Typography variant="h6" sx={{ mb: 2, color: 'text.primary' }}>
                            Top Khuyến mãi
                        </Typography>
                        {loading || !data ? (
                            <Skeleton variant="rounded" height={300} />
                        ) : (
                            <TopPromotionsChart data={data.top_promotions} />
                        )}
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                    <Paper variant="outlined" sx={sectionPaperSx}>
                        <Typography variant="h6" sx={{ mb: 2, color: 'text.primary' }}>
                            Top Brokers
                        </Typography>
                        {loading || !data ? (
                            <Skeleton variant="rounded" height={300} />
                        ) : (
                            <TopBrokersChart data={data.top_brokers} />
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {/* Recent Transactions */}
            <Paper variant="outlined" sx={sectionPaperSx}>
                <Typography variant="h6" sx={{ mb: 2, color: 'text.primary' }}>
                    Giao dịch gần đây
                </Typography>
                {loading || !data ? (
                    <Skeleton variant="rounded" height={200} />
                ) : (
                    <RecentTransactions transactions={data.recent_transactions} />
                )}
            </Paper>
        </Box>
    );
};

export default DashboardHomePage;
