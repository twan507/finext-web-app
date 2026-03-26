'use client';
import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { useTheme, Box } from '@mui/material';
import { RevenueByLicenseItem, formatCurrency } from '../types';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const L_PALETTE = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#f43f5e', '#3b82f6'];

interface Props { data: RevenueByLicenseItem[]; }

const RevenueByLicenseChart: React.FC<Props> = ({ data }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const series = useMemo(() => [{ name: 'Doanh thu', data: data.map((d) => d.revenue) }], [data]);
    const categories = useMemo(() => data.map((d) => d.license_name || d.license_key), [data]);

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
        plotOptions: {
            bar: {
                horizontal: true,
                barHeight: '60%',
                borderRadius: 3,
                borderRadiusApplication: 'end',
                distributed: true,
            },
        },
        colors: L_PALETTE,
        dataLabels: {
            enabled: true,
            formatter: (val: number, opts: any) => {
                const item = data[opts.dataPointIndex];
                return `${formatCurrency(val)} (${item?.count ?? 0} đơn)`;
            },
            style: {
                fontSize: getResponsiveFontSize('xs').md,
                fontWeight: String(fontWeight.medium),
                colors: ['#ffffff'],
            },
        },
        xaxis: {
            labels: {
                formatter: (val: string) => formatCurrency(Number(val)),
                style: { colors: theme.palette.text.secondary, fontSize: getResponsiveFontSize('sm').md },
                offsetY: -3.2,
            },
            axisBorder: { show: true, color: theme.palette.divider },
            axisTicks: { show: false },
            crosshairs: { show: false },
        },
        yaxis: {
            labels: {
                style: { colors: [theme.palette.text.secondary], fontSize: getResponsiveFontSize('sm').md, fontWeight: fontWeight.medium },
            },
        },
        grid: {
            borderColor: theme.palette.divider,
            strokeDashArray: 0,
            xaxis: { lines: { show: true } },
            yaxis: { lines: { show: false } },
            padding: { top: 0, bottom: 0, left: 6, right: 5 },
        },
        legend: { show: false },
        states: {
            hover: { filter: { type: 'none' } },
            active: { filter: { type: 'none' } },
        },
        tooltip: {
            enabled: true,
            shared: false,
            intersect: true,
            custom: ({ dataPointIndex, w }) => {
                const item = data[dataPointIndex];
                if (!item) return '';
                const bgColor = isDark ? 'rgba(26,26,26,0.9)' : 'rgba(255,255,255,0.9)';
                const textColor = isDark ? '#e0e0e0' : '#333333';
                const color = w.globals.colors[dataPointIndex];
                return `<div style="background:${bgColor};border:none;border-radius:6px;padding:10px 12px;color:${textColor};min-width:180px;box-shadow:none!important;filter:none!important;">
                    <div style="font-weight:600;margin-bottom:6px;font-size:13px;">${item.license_name || item.license_key}</div>
                    <div style="display:flex;align-items:center;gap:6px;padding:2px 0;">
                        <span style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:${color};"></span>
                        <span style="font-size:12px;">Doanh thu:</span>
                        <span style="font-weight:600;font-size:12px;">${formatCurrency(item.revenue)}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;padding:2px 0;">
                        <span style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:transparent;"></span>
                        <span style="font-size:12px;">Số đơn:</span>
                        <span style="font-weight:600;font-size:12px;">${item.count}</span>
                    </div>
                </div>`;
            },
        },
    }), [theme, isDark, categories, data]);

    if (!data || data.length === 0) {
        return <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.palette.text.secondary, fontSize: '0.875rem' }}>Không có dữ liệu doanh thu theo gói</div>;
    }

    return (
        <Box sx={{
            width: '100%', height: 290,
            '& .apexcharts-tooltip': { boxShadow: 'none!important', filter: 'none!important', WebkitBoxShadow: 'none!important', background: 'transparent!important', border: 'none!important', padding: '0!important' },
            '& .apexcharts-tooltip.apexcharts-theme-light, & .apexcharts-tooltip.apexcharts-theme-dark': { boxShadow: 'none!important', filter: 'none!important', background: 'transparent!important' },
        }}>
            <Chart key={theme.palette.mode} options={options} series={series} type="bar" height="100%" width="100%" />
        </Box>
    );
};

export default RevenueByLicenseChart;
