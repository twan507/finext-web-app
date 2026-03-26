'use client';
import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { useTheme, Box } from '@mui/material';
import { RevenueTrendItem, formatCurrency } from '../types';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface Props { data: RevenueTrendItem[]; }

const RevenueTrendChart: React.FC<Props> = ({ data }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const series = useMemo(() => [{
        name: 'Doanh thu',
        data: data.map((d) => d.revenue),
    }], [data]);

    const categories = useMemo(() => data.map((d) => d.date), [data]);

    const options: ApexOptions = useMemo(() => ({
        chart: {
            type: 'area',
            toolbar: { show: false },
            background: 'transparent',
            fontFamily: 'inherit',
            defaultLocale: 'en',
            animations: { enabled: true, speed: 300 },
            zoom: { enabled: false },
        },
        theme: { mode: isDark ? 'dark' : 'light' },
        colors: [theme.palette.primary.main],
        stroke: { width: 2.5, curve: 'smooth' },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.35,
                opacityTo: 0.02,
                stops: [0, 100],
            },
        },
        xaxis: {
            categories,
            axisBorder: { show: true, color: theme.palette.divider },
            axisTicks: { show: false },
            crosshairs: { stroke: { color: theme.palette.divider, width: 1, dashArray: 3 } },
            labels: {
                style: { colors: theme.palette.text.secondary, fontSize: getResponsiveFontSize('sm').md },
                rotate: -30,
                maxHeight: 60,
            },
            tooltip: { enabled: false },
        },
        yaxis: {
            labels: {
                formatter: (val: number) => formatCurrency(val),
                style: { colors: [theme.palette.text.secondary], fontSize: getResponsiveFontSize('sm').md },
            },
        },
        grid: {
            borderColor: theme.palette.divider,
            strokeDashArray: 0,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
            padding: { top: 0, bottom: 0, left: 6, right: 5 },
        },
        dataLabels: { enabled: false },
        markers: { size: 0, hover: { size: 4 } },
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
                const date = categories[dataPointIndex] || '';
                const val = s[0]?.[dataPointIndex];
                const bgColor = isDark ? 'rgba(26,26,26,0.9)' : 'rgba(255,255,255,0.9)';
                const textColor = isDark ? '#e0e0e0' : '#333333';
                const color = w.globals.colors[0];
                return `
                    <div style="background:${bgColor};border:none;border-radius:6px;padding:10px 12px;color:${textColor};min-width:160px;box-shadow:none!important;filter:none!important;">
                        <div style="font-weight:600;margin-bottom:6px;font-size:13px;">${date}</div>
                        <div style="display:flex;align-items:center;gap:8px;padding:3px 0;">
                            <span style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></span>
                            <span style="flex:1;font-size:12px;">Doanh thu:</span>
                            <span style="font-weight:600;font-size:12px;">${formatCurrency(val ?? 0)}</span>
                        </div>
                    </div>`;
            },
        },
    }), [theme, isDark, categories]);

    if (!data || data.length === 0) {
        return <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.palette.text.secondary, fontSize: '0.875rem' }}>Không có dữ liệu doanh thu</div>;
    }

    return (
        <Box sx={{
            width: '100%', height: 309,
            '& .apexcharts-tooltip': { boxShadow: 'none!important', filter: 'none!important', WebkitBoxShadow: 'none!important', background: 'transparent!important', border: 'none!important', padding: '0!important' },
            '& .apexcharts-tooltip.apexcharts-theme-light, & .apexcharts-tooltip.apexcharts-theme-dark': { boxShadow: 'none!important', filter: 'none!important', background: 'transparent!important' },
            '& .apexcharts-svg, & .apexcharts-canvas': { cursor: 'default!important' },
        }}>
            <Chart key={theme.palette.mode} options={options} series={series} type="area" height="100%" width="100%" />
        </Box>
    );
};

export default RevenueTrendChart;
