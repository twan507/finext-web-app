'use client';

import { useMemo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import dynamic from 'next/dynamic';
import type { ApexOptions } from 'apexcharts';
import { formatMetricValue, formatMetricDelta, formatPeriodLabel, METRIC_FORMAT_CONFIG } from './stock-financials-config';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface Props {
    metricKey: string;
    metricName: string;
    periods: string[];
    values: (number | null)[];
    mode: 'Q' | 'Y';
}

export default function StockFinancialsFocusChart({ metricKey, metricName, periods, values, mode }: Props) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const cfg = METRIC_FORMAT_CONFIG[metricKey];
    const multiplier = cfg?.multiplier ?? 1;
    const isCurrencyBn = cfg?.format === 'currency_bn';

    const latestRaw = values.length > 0 ? values[values.length - 1] : null;
    const prevRaw = values.length > 1 ? values[values.length - 2] : null;
    const deltaRaw = latestRaw != null && prevRaw != null ? latestRaw - prevRaw : null;
    const { text: deltaText, color: deltaColor } = formatMetricDelta(metricKey, deltaRaw, latestRaw, prevRaw);

    const deltaColorMap = { success: theme.palette.success.main, error: theme.palette.error.main, neutral: theme.palette.text.disabled };

    // Drop oldest record so every bar has a delta
    const shownPeriods = useMemo(() => (periods.length > 1 ? periods.slice(1) : periods), [periods]);
    const shownValues = useMemo(() => (values.length > 1 ? values.slice(1) : values), [values]);

    // Bar series — scaled
    const displayValues = useMemo(() => {
        if (isCurrencyBn) {
            return shownValues.map((v) => (v != null && isFinite(v) ? parseFloat((v / 1_000_000_000).toFixed(2)) : null));
        }
        return shownValues.map((v) => (v != null && isFinite(v) ? parseFloat((v * multiplier).toFixed(4)) : null));
    }, [shownValues, multiplier, isCurrencyBn]);

    // Delta series
    const deltaValues = useMemo(() => {
        return shownValues.map((v, i) => {
            const prev = values[i];
            if (v == null || !isFinite(v) || prev == null || !isFinite(prev)) return null;
            if (isCurrencyBn) {
                if (prev === 0) return null;
                return parseFloat((((v - prev) / Math.abs(prev)) * 100).toFixed(2));
            }
            return parseFloat(((v - prev) * multiplier).toFixed(4));
        });
    }, [shownValues, values, multiplier, isCurrencyBn]);

    const xCategories = useMemo(() => shownPeriods.map(formatPeriodLabel), [shownPeriods]);

    const primaryColor = theme.palette.primary.main;
    const deltaLineColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';

    const yAxisFormatter = (val: number) => {
        if (val == null) return '';
        if (isCurrencyBn) return `${Math.round(val).toLocaleString('en-US')}`;
        switch (cfg?.format) {
            case 'pct': case 'growth_pct': return `${val.toFixed(1)}%`;
            case 'days': return `${val.toFixed(0)}`;
            default: return val.toFixed(2);
        }
    };

    const options: ApexOptions = useMemo(() => ({
        chart: { type: 'line', toolbar: { show: false }, background: 'transparent', animations: { enabled: true, speed: 350 }, fontFamily: 'inherit', zoom: { enabled: false } },
        colors: [primaryColor, deltaLineColor],
        stroke: { width: [0, 2], curve: 'smooth' },
        plotOptions: { bar: { columnWidth: '55%', borderRadius: 3 } },
        markers: { size: [0, 4], strokeWidth: 0, hover: { size: 6 } },
        dataLabels: { enabled: false },
        xaxis: {
            categories: xCategories,
            labels: { style: { colors: theme.palette.text.disabled, fontSize: '10px', fontFamily: 'inherit' } },
            axisBorder: { show: false }, axisTicks: { show: false },
        },
        yaxis: [
            {
                labels: { style: { colors: theme.palette.text.disabled, fontSize: '10px', fontFamily: 'inherit' }, formatter: yAxisFormatter },
                axisBorder: { show: false }, axisTicks: { show: false },
            },
            {
                opposite: true,
                labels: {
                    style: { colors: theme.palette.text.disabled, fontSize: '10px', fontFamily: 'inherit' },
                    formatter: (val: number) => { if (val == null) return ''; const s = val > 0 ? '+' : ''; return `${s}${val.toFixed(2)}`; },
                },
                axisBorder: { show: false }, axisTicks: { show: false },
            },
        ],
        grid: {
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            strokeDashArray: 3, yaxis: { lines: { show: true } }, xaxis: { lines: { show: false } }, padding: { left: 0, right: 8 },
        },
        legend: { show: false },
        tooltip: {
            shared: true,
            intersect: false,
            custom: function ({ series: s, dataPointIndex, w }: any) {
                const label = xCategories[dataPointIndex] || '';
                const bgColor = isDark ? 'rgba(26,26,26,0.9)' : 'rgba(255,255,255,0.9)';
                const textColor = isDark ? '#e0e0e0' : '#333333';
                let seriesHTML = '';
                s.forEach((sd: any[], idx: number) => {
                    const value = sd[dataPointIndex];
                    if (value == null) return;
                    const name = w.globals.seriesNames[idx];
                    const color = w.globals.colors[idx];
                    let formatted: string;
                    if (idx === 0) {
                        if (isCurrencyBn) {
                            formatted = `${Math.round(value).toLocaleString('en-US')} tỷ`;
                        } else {
                            const unit = cfg?.unit ?? '';
                            formatted = `${value.toFixed(cfg?.format === 'days' ? 1 : 2)}${unit}`;
                        }
                    } else {
                        const sign = value > 0 ? '+' : '';
                        const dUnit = isCurrencyBn ? '%' : (cfg?.deltaUnit ?? '');
                        formatted = `${sign}${value.toFixed(2)}${dUnit ? ' ' + dUnit : ''}`;
                    }
                    seriesHTML += `<div style="display:flex;align-items:center;gap:8px;padding:3px 0;">
                        <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></span>
                        <span style="flex:1;font-size:11px;">${name}:</span>
                        <span style="font-weight:600;font-size:11px;">${formatted}</span>
                    </div>`;
                });
                return `<div style="background:${bgColor};border:none;border-radius:6px;padding:10px 12px;color:${textColor};min-width:150px;box-shadow:none;filter:none;">
                    <div style="font-weight:600;margin-bottom:5px;font-size:11px;">${label}</div>
                    ${seriesHTML}
                </div>`;
            },
        },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [xCategories, isDark, theme, cfg, primaryColor, deltaLineColor]);

    const series = useMemo(() => [
        { name: metricName, type: 'bar', data: displayValues },
        { name: `Δ ${mode === 'Q' ? 'QoQ' : 'YoY'}`, type: 'line', data: deltaValues },
    ], [metricName, displayValues, deltaValues, mode]);

    return (
        <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: { xs: 0.5, sm: 1 }, mb: 1 }}>
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.medium, color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {metricName}
                </Typography>
                <Typography sx={{ fontSize: getResponsiveFontSize('lg'), fontWeight: fontWeight.bold, color: theme.palette.text.primary, fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
                    {formatMetricValue(metricKey, latestRaw)}
                </Typography>
                <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.medium, color: deltaColorMap[deltaColor], fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
                    {deltaText}
                </Typography>
                <Typography sx={{ fontSize: '11px', color: theme.palette.text.disabled }}>vs kỳ trước</Typography>
            </Box>
            <Box sx={{
                '& .apexcharts-tooltip': { boxShadow: 'none !important', filter: 'none !important', background: 'transparent !important', border: 'none !important' },
                '& .apexcharts-tooltip.apexcharts-theme-light, & .apexcharts-tooltip.apexcharts-theme-dark': { boxShadow: 'none !important', filter: 'none !important', background: 'transparent !important' },
            }}>
                <Chart type="line" options={options} series={series} height={200} />
            </Box>
        </Box>
    );
}
