'use client';

import { useMemo, useState, useCallback } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { fontWeight, getResponsiveFontSize } from 'theme/tokens';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const STACK_COUNT = 5; // T-4 → T-0

interface DongTienStackedBarChartProps {
    chartHeight?: string;
    dates: string[];
    series: { name: string; data: number[] }[];
}

export default function DongTienStackedBarChart({
    chartHeight = '250px',
    dates,
    series,
}: DongTienStackedBarChartProps) {
    const theme = useTheme();
    const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

    // Colors: T-4 (bottom) → T-0 (top)
    const colors = useMemo(() => [
        theme.palette.trend.down,    // T-4
        theme.palette.trend.ref,     // T-3
        theme.palette.info.main,     // T-2
        theme.palette.trend.up,      // T-1
        theme.palette.primary.main,  // T-0
    ], [theme]);

    // Build stacked series: each layer = one day (T-4 to T-0)
    // Each layer has 3 data points: [VNINDEX_val, FNXINDEX_val, DongTien_val]
    const stackedSeries = useMemo(() => {
        if (!series || series.length === 0 || !dates || dates.length === 0) return [];

        const totalDates = dates.length;
        const layers: { name: string; data: number[] }[] = [];

        for (let i = 0; i < STACK_COUNT; i++) {
            const dayIndex = totalDates - STACK_COUNT + i; // oldest first (T-4, T-3, ..., T-0)
            const label = `T-${STACK_COUNT - 1 - i}`;

            if (dayIndex < 0) {
                // Not enough data, fill with 0
                layers.push({
                    name: label,
                    data: series.map(() => 0),
                });
            } else {
                layers.push({
                    name: label,
                    data: series.map(s => {
                        const val = s.data[dayIndex] ?? 0;
                        return Math.abs(val);
                    }),
                });
            }
        }

        return layers;
    }, [series, dates]);

    const categories = useMemo(() => series.map(s => s.name), [series]);

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

    // Filter out hidden series entirely
    const { displaySeries, displayColors } = useMemo(() => {
        const filtered = stackedSeries
            .map((s, i) => ({ series: s, color: colors[i], index: i }))
            .filter(item => !hiddenSeries.has(item.series.name));

        return {
            displaySeries: filtered.map(item => item.series),
            displayColors: filtered.map(item => item.color),
        };
    }, [stackedSeries, colors, hiddenSeries]);

    const chartOptions: ApexOptions = useMemo(() => ({
        chart: {
            type: 'bar',
            stacked: true,
            background: 'transparent',
            toolbar: { show: false },
            fontFamily: 'inherit',
            animations: { enabled: true, speed: 300 },
        },
        plotOptions: {
            bar: {
                columnWidth: '55%',
                borderRadius: 3,
                borderRadiusApplication: 'end',
                borderRadiusWhenStacked: 'last',
            },
        },
        colors: displayColors,
        dataLabels: { enabled: false },
        xaxis: {
            categories,
            labels: {
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: getResponsiveFontSize('sm').md,
                    fontWeight: fontWeight.medium,
                },
            },
            axisBorder: {
                show: true,
                color: theme.palette.divider,
            },
            axisTicks: { show: false },
            crosshairs: {
                show: false,
            },
        },
        yaxis: {
            labels: {
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: '0.6875rem',
                },
                formatter: (val: number) => `${val.toFixed(1)}%`,
            },
        },
        grid: {
            borderColor: theme.palette.divider,
            strokeDashArray: 0,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
            padding: { top: 0, bottom: 0, left: 15, right: 0 },
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
                const formattedValue = `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

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
    }), [theme, displayColors, categories]);

    const legendLabels = Array.from({ length: STACK_COUNT }, (_, i) => `T-${STACK_COUNT - 1 - i}`);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 0.5, flexWrap: 'wrap' }}>
                {legendLabels.map((label, index) => {
                    const isHidden = hiddenSeries.has(label);
                    return (
                        <Box
                            key={label}
                            onClick={() => handleLegendClick(label)}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                cursor: 'pointer',
                                opacity: isHidden ? 0.35 : 1,
                                transition: 'opacity 0.2s',
                                '&:hover': { opacity: isHidden ? 0.5 : 0.8 },
                            }}
                        >
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colors[index] }} />
                            <Typography
                                color="text.secondary"
                                sx={{
                                    fontSize: getResponsiveFontSize('xs'),
                                    fontWeight: fontWeight.medium,
                                    textDecoration: isHidden ? 'line-through' : 'none',
                                }}
                            >
                                {label}
                            </Typography>
                        </Box>
                    );
                })}
            </Box>
            <Box sx={{
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
                    transform: 'translateX(20px)',
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
