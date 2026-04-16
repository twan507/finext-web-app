'use client';

import { useCallback, useMemo } from 'react';
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
    selectedBarIndex: number;
    onBarClick: (barIndex: number) => void;
}

export default function StockFinancialsFocusChart({ metricKey, metricName, periods, values, mode, selectedBarIndex, onBarClick }: Props) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const cfg = METRIC_FORMAT_CONFIG[metricKey];
    const multiplier = cfg?.multiplier ?? 1;
    const isCurrencyBn = cfg?.format === 'currency_bn';

    // selectedBarIndex is index into shownValues; shownValues[i] = values[i+1]
    const selectedRaw = (selectedBarIndex + 1 < values.length) ? values[selectedBarIndex + 1] : null;
    const prevRaw = (selectedBarIndex >= 0 && selectedBarIndex < values.length) ? values[selectedBarIndex] : null;
    const deltaRaw = selectedRaw != null && prevRaw != null ? selectedRaw - prevRaw : null;
    const { text: deltaText, color: deltaColor } = formatMetricDelta(metricKey, deltaRaw, selectedRaw, prevRaw);

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
    const dimColor = isDark ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.2)';

    const barData = useMemo(
        () =>
            displayValues.map((v, i) => ({
                x: xCategories[i] ?? '',
                y: v,
                fillColor: i === selectedBarIndex ? primaryColor : dimColor,
            })),
        [displayValues, xCategories, selectedBarIndex, primaryColor, dimColor],
    );

    const deltaData = useMemo(
        () =>
            deltaValues.map((v, i) => ({
                x: xCategories[i] ?? '',
                y: v,
            })),
        [deltaValues, xCategories],
    );

    const yAxisFormatter = (val: number) => {
        if (val == null) return '';
        if (isCurrencyBn) return `${Math.round(val).toLocaleString('en-US')}`;
        switch (cfg?.format) {
            case 'pct': case 'growth_pct': return `${val.toFixed(1)}%`;
            case 'days': return `${val.toFixed(0)}`;
            default: return val.toFixed(2);
        }
    };

    // Click handler: determine which column was clicked based on X position
    const handleChartClick = useCallback((_event: any, chartContext: any, config: any) => {
        if (config?.dataPointIndex != null && config.dataPointIndex >= 0) {
            onBarClick(config.dataPointIndex);
            return;
        }
        const chartEl = chartContext?.el as HTMLElement | undefined;
        if (!chartEl) return;
        const plotArea = chartEl.querySelector('.apexcharts-plot-area') as HTMLElement | null;
        if (!plotArea) return;
        const rect = plotArea.getBoundingClientRect();
        const clientX = (_event as MouseEvent)?.clientX;
        if (clientX == null) return;
        const relX = clientX - rect.left;
        const colCount = xCategories.length;
        if (colCount === 0) return;
        const colWidth = rect.width / colCount;
        const idx = Math.floor(relX / colWidth);
        if (idx >= 0 && idx < colCount) {
            onBarClick(idx);
        }
    }, [onBarClick, xCategories]);

    const options: ApexOptions = useMemo(() => ({
        chart: {
            type: 'line', toolbar: { show: false }, background: 'transparent', animations: { enabled: true, speed: 350 }, fontFamily: 'inherit', zoom: { enabled: false },
            events: {
                click: handleChartClick,
            },
        },
        states: {
            hover: { filter: { type: 'none' } },
            active: { filter: { type: 'none' } },
        },
        colors: [primaryColor, deltaLineColor],
        stroke: { width: [0, 2], curve: 'smooth' },
        plotOptions: { bar: { columnWidth: '55%', borderRadius: 3 } },
        markers: { size: [0, 4], strokeWidth: 0, hover: { size: 6 } },
        dataLabels: { enabled: false },
        xaxis: {
            type: 'category',
            labels: { style: { colors: theme.palette.text.disabled, fontSize: '12px', fontFamily: 'inherit' } },
            axisBorder: { show: false }, axisTicks: { show: false }, tooltip: { enabled: false },
        },
        yaxis: [
            {
                labels: { style: { colors: theme.palette.text.disabled, fontSize: '12px', fontFamily: 'inherit' }, formatter: yAxisFormatter },
                axisBorder: { show: false }, axisTicks: { show: false },
            },
            {
                opposite: true,
                labels: {
                    style: { colors: theme.palette.text.disabled, fontSize: '12px', fontFamily: 'inherit' },
                    formatter: (val: number) => { if (val == null) return ''; const s = val > 0 ? '+' : ''; return `${s}${val.toFixed(2)}`; },
                },
                axisBorder: { show: false }, axisTicks: { show: false },
            },
        ],
        grid: {
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            strokeDashArray: 0, yaxis: { lines: { show: true } }, xaxis: { lines: { show: false } }, padding: { left: 15, right: 15 },
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
    }), [xCategories, isDark, theme, cfg, primaryColor, deltaLineColor, handleChartClick]);

    const series = useMemo(() => [
        { name: metricName, type: 'bar', data: barData },
        { name: `Δ ${mode === 'Q' ? 'QoQ' : 'YoY'}`, type: 'line', data: deltaData },
    ], [metricName, barData, deltaData, mode]);

    return (
        <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: { xs: 0.5, sm: 1 }, mb: 1 }}>
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.medium, color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {metricName}
                </Typography>
                <Typography sx={{ fontSize: getResponsiveFontSize('lg'), fontWeight: fontWeight.bold, color: theme.palette.text.primary, fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
                    {formatMetricValue(metricKey, selectedRaw)}
                </Typography>
                <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.medium, color: deltaColorMap[deltaColor], fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
                    {deltaText}
                </Typography>
                <Typography sx={{ fontSize: '11px', color: theme.palette.text.disabled }}>vs kỳ trước</Typography>
            </Box>
            <Box sx={{
                cursor: 'pointer',
                '& .apexcharts-tooltip': { boxShadow: 'none !important', filter: 'none !important', background: 'transparent !important', border: 'none !important' },
                '& .apexcharts-tooltip.apexcharts-theme-light, & .apexcharts-tooltip.apexcharts-theme-dark': { boxShadow: 'none !important', filter: 'none !important', background: 'transparent !important' },
            }}>
                <Chart type="line" options={options} series={series} height={200} />
            </Box>
        </Box>
    );
}
