'use client';

import { useMemo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import dynamic from 'next/dynamic';
import type { ApexOptions } from 'apexcharts';
import {
    formatMetricValue,
    formatMetricDelta,
    formatPeriodLabel,
    METRIC_FORMAT_CONFIG,
} from './financials-config';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface FinancialsFocusChartProps {
    metricKey: string;
    metricName: string;
    periods: string[];            // asc order, e.g. ["2024_1", ..., "2025_4"]
    values: (number | null)[];    // raw values (chưa nhân multiplier)
    mode: 'Q' | 'Y';
}

export default function FinancialsFocusChart({
    metricKey,
    metricName,
    periods,
    values,
    mode,
}: FinancialsFocusChartProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const cfg = METRIC_FORMAT_CONFIG[metricKey];
    const multiplier = cfg?.multiplier ?? 1;

    // Latest value & delta for header display
    const latestRaw = values.length > 0 ? values[values.length - 1] : null;
    const prevRaw = values.length > 1 ? values[values.length - 2] : null;
    const deltaRaw = latestRaw != null && prevRaw != null ? latestRaw - prevRaw : null;
    const { text: deltaText, color: deltaColor } = formatMetricDelta(metricKey, deltaRaw);

    const deltaColorMap = {
        success: theme.palette.success.main,
        error: theme.palette.error.main,
        neutral: theme.palette.text.disabled,
    };

    // Drop the oldest record so every displayed bar has a valid delta point.
    // Q: 9 fetched → show 8 | Y: 6 fetched → show 5
    const shownPeriods = useMemo(() => (periods.length > 1 ? periods.slice(1) : periods), [periods]);
    const shownValues  = useMemo(() => (values.length  > 1 ? values.slice(1)  : values),  [values]);

    // Bar series — scaled by multiplier
    const displayValues = useMemo(
        () => shownValues.map((v) => (v != null && isFinite(v) ? parseFloat((v * multiplier).toFixed(4)) : null)),
        [shownValues, multiplier],
    );

    // Delta series — delta[i] = shownValues[i] - values[i] (one index back in original array)
    const deltaValues = useMemo(
        () =>
            shownValues.map((v, i) => {
                const prev = values[i]; // values[i] is the record before shownValues[i] = values[i+1]
                if (v == null || !isFinite(v) || prev == null || !isFinite(prev)) return null;
                return parseFloat(((v - prev) * multiplier).toFixed(4));
            }),
        [shownValues, values, multiplier],
    );

    const xCategories = useMemo(() => shownPeriods.map(formatPeriodLabel), [shownPeriods]);

    const primaryColor = theme.palette.primary.main;
    const deltaLineColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';

    const yAxisFormatter = (val: number) => {
        if (val == null) return '';
        switch (cfg?.format) {
            case 'pct':
            case 'growth_pct':
                return `${val.toFixed(1)}%`;
            case 'days':
                return `${val.toFixed(0)}`;
            case 'multiple':
            default:
                return val.toFixed(2);
        }
    };

    const options: ApexOptions = useMemo(
        () => ({
            chart: {
                type: 'line',
                toolbar: { show: false },
                background: 'transparent',
                animations: { enabled: true, speed: 350 },
                fontFamily: 'inherit',
            },
            colors: [primaryColor, deltaLineColor],
            stroke: {
                width: [0, 2],
                curve: 'smooth',
            },
            plotOptions: {
                bar: { columnWidth: '55%', borderRadius: 3 },
            },
            markers: {
                size: [0, 4],
                strokeWidth: 0,
                hover: { size: 6 },
            },
            dataLabels: { enabled: false },
            xaxis: {
                categories: xCategories,
                labels: {
                    style: {
                        colors: theme.palette.text.disabled,
                        fontSize: '10px',
                        fontFamily: 'inherit',
                    },
                },
                axisBorder: { show: false },
                axisTicks: { show: false },
            },
            yaxis: [
                {
                    // Left: metric values (bar)
                    labels: {
                        style: {
                            colors: theme.palette.text.disabled,
                            fontSize: '10px',
                            fontFamily: 'inherit',
                        },
                        formatter: yAxisFormatter,
                    },
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                },
                {
                    // Right: delta (line)
                    opposite: true,
                    labels: {
                        style: {
                            colors: theme.palette.text.disabled,
                            fontSize: '10px',
                            fontFamily: 'inherit',
                        },
                        formatter: (val: number) => {
                            if (val == null) return '';
                            const sign = val > 0 ? '+' : '';
                            return `${sign}${val.toFixed(2)}`;
                        },
                    },
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                },
            ],
            grid: {
                borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                strokeDashArray: 3,
                yaxis: { lines: { show: true } },
                xaxis: { lines: { show: false } },
                padding: { left: 0, right: 8 },
            },
            legend: { show: false },
            tooltip: {
                theme: isDark ? 'dark' : 'light',
                style: { fontFamily: 'inherit', fontSize: '11px' },
                shared: true,
                intersect: false,
            },
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [xCategories, isDark, theme, cfg, primaryColor, deltaLineColor],
    );

    const series = useMemo(
        () => [
            { name: metricName, type: 'bar', data: displayValues },
            { name: `Δ ${mode === 'Q' ? 'QoQ' : 'YoY'}`, type: 'line', data: deltaValues },
        ],
        [metricName, displayValues, deltaValues, mode],
    );

    return (
        <Box sx={{ mb: 3 }}>
            {/* Title row */}
            <Box sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: { xs: 0.5, sm: 1 }, mb: 1 }}>
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('xs'),
                        fontWeight: fontWeight.medium,
                        color: theme.palette.text.secondary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                    }}
                >
                    {metricName}
                </Typography>
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('lg'),
                        fontWeight: fontWeight.bold,
                        color: theme.palette.text.primary,
                        fontVariantNumeric: 'tabular-nums',
                        fontFamily: 'monospace',
                    }}
                >
                    {formatMetricValue(metricKey, latestRaw)}
                </Typography>
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        fontWeight: fontWeight.medium,
                        color: deltaColorMap[deltaColor],
                        fontVariantNumeric: 'tabular-nums',
                        fontFamily: 'monospace',
                    }}
                >
                    {deltaText}
                </Typography>
                <Typography sx={{ fontSize: '11px', color: theme.palette.text.disabled }}>
                    vs kỳ trước
                </Typography>
            </Box>

            <Chart type="line" options={options} series={series} height={200} />
        </Box>
    );
}
