'use client';
import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { useTheme, Box, Typography } from '@mui/material';
import { SubscriptionDistributionItem } from '../types';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const DONUT_PALETTE = [
    '#8b5cf6', // primary violet
    '#06b6d4', // cyan
    '#f59e0b', // amber
    '#10b981', // emerald
    '#f43f5e', // rose
    '#3b82f6', // blue
    '#a855f7', // purple
    '#ec4899', // pink
];

interface Props { data: SubscriptionDistributionItem[]; }

const SubscriptionDonut: React.FC<Props> = ({ data }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const series = useMemo(() => data.map((d) => d.count), [data]);
    const labels = useMemo(() => data.map((d) => d.license_name || d.license_key), [data]);
    const total = useMemo(() => data.reduce((s, d) => s + d.count, 0), [data]);

    const options: ApexOptions = {
        chart: {
            type: 'donut',
            background: 'transparent',
            fontFamily: 'inherit',
            defaultLocale: 'en',
        },
        theme: { mode: isDark ? 'dark' : 'light' },
        colors: DONUT_PALETTE,
        labels,
        // Hide built-in legend — we render our own below
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
                            label: 'Tổng',
                            fontSize: '12px',
                            color: theme.palette.text.secondary,
                            formatter: () => total.toLocaleString('vi-VN'),
                        },
                    },
                },
            },
        },
        tooltip: {
            y: { formatter: (val: number) => `${val.toLocaleString('vi-VN')} subs` },
        },
        stroke: { width: 2, colors: [isDark ? '#1e1e1e' : '#ffffff'] },
    };

    if (!data || data.length === 0) {
        return (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.palette.text.secondary, fontSize: '0.875rem' }}>
                Không có subscription nào đang hoạt động
            </div>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {/* Chart */}
            <Chart options={options} series={series} type="donut" height="230px" />

            {/* Custom legend — same pattern as BreadthPolarChart */}
            <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1.5, mt: 1, mb: 0.5 }}>
                {labels.map((label, idx) => (
                    <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box
                            sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                bgcolor: DONUT_PALETTE[idx % DONUT_PALETTE.length],
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
                            {label}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

export default SubscriptionDonut;
