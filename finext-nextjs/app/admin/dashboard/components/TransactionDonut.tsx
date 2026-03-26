'use client';
import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { useTheme, Box, Typography } from '@mui/material';
import { TransactionStatusStats } from '../types';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface Props { data: TransactionStatusStats; }

const LEGEND_ITEMS = [
    { label: 'Thành công', colorKey: 'success' as const },
    { label: 'Chờ xử lý',  colorKey: 'warning' as const },
    { label: 'Đã hủy',     colorKey: 'error'   as const },
];

const TransactionDonut: React.FC<Props> = ({ data }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const colors = [
        theme.palette.success.main,
        theme.palette.warning.main,
        theme.palette.error.main,
    ];

    const series = useMemo(() => [data.succeeded, data.pending, data.canceled], [data]);
    const total  = useMemo(() => data.succeeded + data.pending + data.canceled, [data]);

    const options: ApexOptions = {
        chart: {
            type: 'donut',
            background: 'transparent',
            fontFamily: 'inherit',
            defaultLocale: 'en',
        },
        theme: { mode: isDark ? 'dark' : 'light' },
        labels: LEGEND_ITEMS.map((i) => i.label),
        colors,
        // Hide built-in legend — rendered manually below
        legend: { show: false },
        dataLabels: {
            enabled: true,
            formatter: (val: number) => `${val.toFixed(0)}%`,
            style: { fontSize: '11px' },
        },
        plotOptions: {
            pie: {
                donut: {
                    size: '60%',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            fontSize: '12px',
                            color: theme.palette.text.secondary,
                        },
                        value: {
                            show: true,
                            fontSize: '22px',
                            fontWeight: 700,
                            color: theme.palette.text.primary,
                            formatter: (val: string) => parseInt(val, 10).toLocaleString('vi-VN'),
                        },
                        total: {
                            show: true,
                            label: 'Tổng đơn',
                            fontSize: '12px',
                            color: theme.palette.text.secondary,
                            formatter: () => total.toLocaleString('vi-VN'),
                        },
                    },
                },
            },
        },
        tooltip: {
            y: { formatter: (val: number) => `${val.toLocaleString('vi-VN')} đơn` },
        },
        stroke: { width: 2, colors: [isDark ? '#1e1e1e' : '#ffffff'] },
    };

    if (total === 0) {
        return (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                Không có giao dịch trong khoảng thời gian này
            </div>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {/* Chart */}
            <Chart options={options} series={series} type="donut" height="260px" />

            {/* Custom legend — same pattern as BreadthPolarChart / SubscriptionDonut */}
            <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1.5, mt: 1, mb: 0.5 }}>
                {LEGEND_ITEMS.map((item, idx) => (
                    <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box
                            sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                bgcolor: colors[idx],
                                flexShrink: 0,
                            }}
                        />
                        <Typography
                            color="text.secondary"
                            sx={{
                                fontSize: getResponsiveFontSize('sm'),
                                fontWeight: fontWeight.medium,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {item.label}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

export default TransactionDonut;
