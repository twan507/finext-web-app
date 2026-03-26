'use client';
import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { useTheme, Box, Typography } from '@mui/material';
import { TopPromotionItem, formatCurrency } from '../types';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface Props { data: TopPromotionItem[]; }

const LEGEND = [
    { name: 'Tổng giảm giá', colorKey: 'secondary' as const },
    { name: 'Lượt dùng', colorKey: 'warning' as const },
];

const TopPromotionsChart: React.FC<Props> = ({ data }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const colors = [theme.palette.secondary.main, theme.palette.warning.main];
    const categories = useMemo(() => data.map((d) => d.code), [data]);

    const series = useMemo(() => [
        { name: 'Tổng giảm giá', type: 'bar',  data: data.map((d) => d.total_discount) },
        { name: 'Lượt dùng',     type: 'line', data: data.map((d) => d.usage_count) },
    ], [data]);

    const options: ApexOptions = useMemo(() => ({
        chart: {
            type: 'bar',
            toolbar: { show: false },
            background: 'transparent',
            fontFamily: 'inherit',
            defaultLocale: 'en',
            animations: { enabled: true, speed: 300 },
        },
        theme: { mode: isDark ? 'dark' : 'light' },
        colors,
        plotOptions: { bar: { columnWidth: '55%', borderRadius: 3, borderRadiusApplication: 'end' } },
        stroke: { width: [0, 2.5], curve: 'smooth' },
        markers: { size: [0, 4], hover: { size: 6 } },
        xaxis: {
            categories,
            axisBorder: { show: true, color: theme.palette.divider },
            axisTicks: { show: false },
            crosshairs: { stroke: { color: theme.palette.divider, width: 1, dashArray: 3 } },
            labels: {
                style: { colors: theme.palette.text.secondary, fontSize: getResponsiveFontSize('sm').md },
                rotate: -30,
                trim: true,
                maxHeight: 60,
            },
            tooltip: { enabled: false },
        },
        yaxis: [
            {
                seriesName: 'Tổng giảm giá',
                title: { text: 'Giảm giá', style: { fontSize: getResponsiveFontSize('xs').md, color: theme.palette.text.secondary, fontWeight: String(fontWeight.medium) } },
                labels: {
                    formatter: (val: number) => formatCurrency(val),
                    style: { colors: [theme.palette.text.secondary], fontSize: getResponsiveFontSize('sm').md },
                },
            },
            {
                seriesName: 'Lượt dùng',
                opposite: true,
                title: { text: 'Lượt', style: { fontSize: getResponsiveFontSize('xs').md, color: theme.palette.text.secondary, fontWeight: String(fontWeight.medium) } },
                labels: {
                    formatter: (val: number) => `${Math.round(val)}`,
                    style: { colors: [theme.palette.text.secondary], fontSize: getResponsiveFontSize('sm').md },
                },
            },
        ],
        grid: {
            borderColor: theme.palette.divider,
            strokeDashArray: 0,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
            padding: { top: 0, bottom: 0, left: 6, right: 5 },
        },
        dataLabels: { enabled: false },
        legend: { show: false },
        states: {
            hover: { filter: { type: 'none' } },
            active: { filter: { type: 'none' } },
        },
        tooltip: {
            enabled: true,
            shared: true,
            intersect: false,
            custom: ({ series: s, dataPointIndex, w }) => {
                const cat = categories[dataPointIndex] || '';
                const bgColor = isDark ? 'rgba(26,26,26,0.9)' : 'rgba(255,255,255,0.9)';
                const textColor = isDark ? '#e0e0e0' : '#333333';
                const rows = s.map((sd: number[], si: number) => {
                    const val = sd[dataPointIndex];
                    if (val == null) return '';
                    const color = w.globals.colors[si];
                    const name = w.globals.seriesNames[si];
                    const fmt = si === 0 ? formatCurrency(val) : `${Math.round(val)} lượt`;
                    return `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;">
                        <span style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:${color};"></span>
                        <span style="font-size:12px;color:${textColor};">${name}:</span>
                        <span style="font-weight:600;font-size:12px;color:${textColor};">${fmt}</span>
                    </div>`;
                }).join('');
                return `<div style="background:${bgColor};border:none;border-radius:6px;padding:10px 12px;color:${textColor};min-width:180px;box-shadow:none!important;filter:none!important;">
                    <div style="font-weight:600;margin-bottom:6px;font-size:13px;">${cat}</div>${rows}</div>`;
            },
        },
    }), [theme, isDark, colors, categories]);

    if (!data || data.length === 0) {
        return <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.palette.text.secondary, fontSize: '0.875rem' }}>Chưa có dữ liệu khuyến mãi</div>;
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 0, flexWrap: 'wrap' }}>
                {LEGEND.map((item, idx) => (
                    <Box key={item.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colors[idx], flexShrink: 0 }} />
                        <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.medium }}>{item.name}</Typography>
                    </Box>
                ))}
            </Box>
            <Box sx={{
                width: '100%', height: 280, mt: -1,
                '& .apexcharts-tooltip': { boxShadow: 'none!important', filter: 'none!important', WebkitBoxShadow: 'none!important', background: 'transparent!important', border: 'none!important', padding: '0!important' },
                '& .apexcharts-tooltip.apexcharts-theme-light, & .apexcharts-tooltip.apexcharts-theme-dark': { boxShadow: 'none!important', filter: 'none!important', background: 'transparent!important' },
            }}>
                <Chart key={theme.palette.mode} options={options} series={series} type="bar" height="100%" width="100%" />
            </Box>
        </Box>
    );
};

export default TopPromotionsChart;
