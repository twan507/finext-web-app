'use client';

import { useMemo, useState, useCallback } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { fontWeight, getResponsiveFontSize } from 'theme/tokens';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface NhomCPBarChart1Props {
    chartHeight?: string;
    title?: string;
    categories: string[];
    series: { name: string; data: number[]; color?: string }[];
    unit?: 'percent' | 'number';
}

export default function NhomCPBarChart1({
    chartHeight = '230px',
    title,
    categories,
    series,
    unit = 'percent',
}: NhomCPBarChart1Props) {
    const theme = useTheme();
    const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

    const trendUpColor = theme.palette.trend.up;
    const trendDownColor = theme.palette.trend.down;

    const handleLegendClick = useCallback((seriesName: string) => {
        setHiddenSeries(prev => {
            const next = new Set(prev);
            if (next.has(seriesName)) {
                next.delete(seriesName);
            } else {
                next.add(seriesName);
            }
            return next;
        });
    }, []);

    const { displaySeries } = useMemo(() => {
        const filtered = series
            .map((s) => ({ series: s }))
            .filter(item => !hiddenSeries.has(item.series.name));

        return {
            displaySeries: filtered.map(item => ({ name: item.series.name, data: item.series.data })),
        };
    }, [series, hiddenSeries]);

    const chartOptions: ApexOptions = useMemo(() => ({
        chart: {
            type: 'bar',
            stacked: false,
            background: 'transparent',
            toolbar: { show: false },
            fontFamily: 'inherit',
            animations: { enabled: true, speed: 300 },
        },
        annotations: {
            xaxis: [{
                x: 0,
                borderColor: theme.palette.text.secondary,
                strokeDashArray: 0,
                borderWidth: 2,
            }],
        },
        plotOptions: {
            bar: {
                horizontal: true,
                barHeight: '55%',
                borderRadius: 3,
                borderRadiusApplication: 'end',
                colors: {
                    ranges: [
                        { from: -Infinity, to: -0.0001, color: trendDownColor },
                        { from: 0, to: Infinity, color: trendUpColor },
                    ],
                },
            },
        },
        colors: [trendUpColor],
        dataLabels: { enabled: false },
        xaxis: {
            categories,
            labels: {
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: getResponsiveFontSize('sm').md,
                },
                formatter: (val: string) => unit === 'percent' ? `${parseFloat(val).toFixed(1)}%` : `${parseFloat(val).toFixed(1)}`,
                offsetY: -3.2,
            },
            axisBorder: {
                show: true,
                color: theme.palette.divider,
            },
            axisTicks: { show: false },
            crosshairs: { show: false },
        },
        yaxis: {
            labels: {
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: getResponsiveFontSize('sm').md,
                    fontWeight: fontWeight.medium,
                },
            },
        },
        grid: {
            borderColor: theme.palette.divider,
            strokeDashArray: 0,
            xaxis: { lines: { show: true } },
            yaxis: { lines: { show: false } },
            padding: { top: 0, bottom: 0, left: 5, right: 5 },
        },
        legend: { show: false },
        tooltip: {
            enabled: true,
            shared: false,
            intersect: true,
            custom: function ({ series: seriesData, seriesIndex, dataPointIndex, w }) {
                const categoryName = w.globals.labels[dataPointIndex] || '';
                const value = seriesData[seriesIndex]?.[dataPointIndex];
                if (value == null) return '';

                const color = w.globals.colors[seriesIndex];
                const name = w.globals.seriesNames[seriesIndex];
                const formattedValue = unit === 'percent'
                    ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
                    : `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;

                const bgColor = theme.palette.mode === 'dark' ? 'rgba(26, 26, 26, 0.9)' : 'rgba(255, 255, 255, 0.9)';
                const textColor = theme.palette.mode === 'dark' ? '#e0e0e0' : '#333333';

                return `
                    <div style="
                        background: ${bgColor};
                        border: none;
                        border-radius: 6px;
                        padding: 12px;
                        color: ${textColor};
                        min-width: 140px;
                        box-shadow: none !important;
                        filter: none !important;
                        -webkit-box-shadow: none !important;
                        -moz-box-shadow: none !important;
                    ">
                        <div style="font-weight: 600; margin-bottom: 8px; font-size: 13px; color: ${textColor};">
                            ${categoryName}
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${color};"></span>
                            <span style="flex: 1; font-size: 12px;">${name}:</span>
                            <span style="font-weight: 600; font-size: 12px;">${formattedValue}</span>
                        </div>
                    </div>
                `;
            },
        },
        states: {
            hover: { filter: { type: 'darken', value: 0.9 } },
            active: { filter: { type: 'none' } },
        },
    }), [theme, trendUpColor, trendDownColor, categories, unit]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {title && (
                <Typography
                    color="text.secondary"
                    sx={{
                        fontSize: getResponsiveFontSize('md'),
                        fontWeight: fontWeight.semibold,
                        textAlign: 'center',
                        mb: 0.5,
                    }}
                >
                    {title}
                </Typography>
            )}
            {/* Invisible placeholder to match legend height of sibling charts */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 0, flexWrap: 'wrap', visibility: 'hidden', pointerEvents: 'none' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%' }} />
                    <Typography
                        color="text.secondary"
                        sx={{
                            fontSize: getResponsiveFontSize('xs'),
                            fontWeight: fontWeight.medium,
                        }}
                    >
                        &nbsp;
                    </Typography>
                </Box>
            </Box>
            <Box sx={{
                mt: -2,
                width: '100%',
                height: chartHeight,
                '& .apexcharts-tooltip': {
                    boxShadow: 'none !important',
                    filter: 'none !important',
                    WebkitBoxShadow: 'none !important',
                    MozBoxShadow: 'none !important',
                    background: 'transparent !important',
                    border: 'none !important',
                    padding: '0 !important',
                    transform: 'translateY(-20px)',
                },
                '& .apexcharts-tooltip.apexcharts-theme-light, & .apexcharts-tooltip.apexcharts-theme-dark': {
                    boxShadow: 'none !important',
                    filter: 'none !important',
                    background: 'transparent !important',
                },
                '& .apexcharts-xcrosshairs, & .apexcharts-ycrosshairs, & .apexcharts-xcrosshairs-fill': {
                    display: 'none !important',
                },
            }}>
                <Chart
                    key={theme.palette.mode}
                    options={chartOptions}
                    series={displaySeries}
                    type="bar"
                    height="100%"
                    width="100%"
                />
            </Box>
        </Box>
    );
}
