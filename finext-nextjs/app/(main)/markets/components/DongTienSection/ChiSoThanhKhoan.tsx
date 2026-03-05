'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material';
import { fontWeight, getResponsiveFontSize } from 'theme/tokens';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { getVsiColor } from 'theme/colorHelpers';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface NhomCPBarChart2Props {
    chartHeight?: string;
    title?: string;
    categories: string[];
    series: { name: string; data: number[]; color?: string }[];
    unit?: 'percent' | 'number';
}

export default function NhomCPBarChart2({
    chartHeight = '230px',
    title,
    categories,
    series,
    unit = 'percent',
}: NhomCPBarChart2Props) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md')); // < 768px
    const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

    // Ref to hold current series data for DOM label adjustment
    const seriesDataRef = useRef<number[]>([]);

    // Tính màu per-bar: data đã là vsi*100 nên chia 100 để lấy giá trị gốc
    const barColors = useMemo(() => {
        const firstSeries = series[0];
        if (!firstSeries) return [];
        return firstSeries.data.map(val => getVsiColor(val / 100, theme));
    }, [series, theme]);

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

    const { displaySeries, displayBarColors } = useMemo(() => {
        const filtered = series
            .map((s, i) => ({ series: s, index: i }))
            .filter(item => !hiddenSeries.has(item.series.name));

        return {
            displaySeries: filtered.map(item => ({ name: item.series.name, data: item.series.data })),
            // Với distributed colors, ApexCharts dùng mảng colors để tô từng bar
            displayBarColors: barColors,
        };
    }, [series, barColors, hiddenSeries]);

    // Keep ref in sync with latest display data
    seriesDataRef.current = displaySeries.length > 0 ? displaySeries[0].data : [];

    // Adjust labels for negative values: shift them to the left of the bar end
    const adjustNegativeLabels = useCallback((el: HTMLElement) => {
        requestAnimationFrame(() => {
            const currentData = seriesDataRef.current;
            const labels = el.querySelectorAll('.apexcharts-datalabels .apexcharts-datalabel');
            labels.forEach((label, index) => {
                if (currentData[index] != null && currentData[index] < 0) {
                    const currentX = parseFloat(label.getAttribute('x') || '0');
                    if (!label.getAttribute('data-adjusted')) {
                        // Shift label further left so it appears outside the negative bar
                        label.setAttribute('x', String(currentX - 10));
                        label.setAttribute('text-anchor', 'end');
                        label.setAttribute('data-adjusted', 'true');
                    }
                }
            });
        });
    }, []);

    const chartOptions: ApexOptions = useMemo(() => ({
        chart: {
            type: 'bar',
            stacked: false,
            background: 'transparent',
            toolbar: { show: false },
            fontFamily: 'inherit',
            animations: { enabled: true, speed: 300 },
            events: {
                mounted: function (chartContext: any) {
                    adjustNegativeLabels(chartContext.el);
                },
                updated: function (chartContext: any) {
                    const labels = chartContext.el.querySelectorAll('.apexcharts-datalabels .apexcharts-datalabel');
                    labels.forEach((label: Element) => label.removeAttribute('data-adjusted'));
                    adjustNegativeLabels(chartContext.el);
                },
            },
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
                distributed: true,
                dataLabels: {
                    position: 'top',
                },
            },
        },
        colors: displayBarColors,
        dataLabels: {
            enabled: true,
            textAnchor: 'start',
            offsetX: 5,
            offsetY: 7,
            style: {
                colors: [theme.palette.text.secondary],
                fontSize: getResponsiveFontSize('sm').md,
                fontWeight: fontWeight.medium,
            },
            formatter: (val: number) => unit === 'percent' ? `${val.toFixed(1)}%` : `${val.toFixed(1)}`,
        },
        xaxis: {
            categories,
            tickAmount: 4,
            labels: {
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: getResponsiveFontSize('sm').md,
                },
                formatter: (val: string) => unit === 'percent' ? `${Math.round(parseFloat(val))}%` : `${Math.round(parseFloat(val))}`,
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
                show: isMobile,
                offsetY: 3,
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
            padding: { top: 0, bottom: 0, left: 5, right: 50 },
        },
        legend: { show: false },
        tooltip: {
            enabled: true,
            shared: true,
            intersect: false,
            custom: function ({ series: seriesData, dataPointIndex, w }) {
                const categoryName = w.globals.labels[dataPointIndex] || '';
                const bgColor = theme.palette.mode === 'dark' ? 'rgba(26, 26, 26, 0.9)' : 'rgba(255, 255, 255, 0.9)';
                const textColor = theme.palette.mode === 'dark' ? '#e0e0e0' : '#333333';

                const rows = seriesData.map((sd: number[], si: number) => {
                    const value = sd[dataPointIndex];
                    if (value == null) return '';

                    const isDistributed = w.config.plotOptions.bar?.distributed;
                    const color = isDistributed ? w.globals.colors[dataPointIndex] : w.globals.colors[si];
                    const name = w.globals.seriesNames[si];
                    const formattedValue = unit === 'percent'
                        ? `${value.toFixed(1)}%`
                        : `${Math.round(value)}`;

                    return `
                        <div style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${color};"></span>
                            <span style="flex: 1; font-size: 12px;">${name}:</span>
                            <span style="font-weight: 600; font-size: 12px;">${formattedValue}</span>
                        </div>
                    `;
                }).join('');

                if (!rows) return '';

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
                        ${rows}
                    </div>
                `;
            },
        },
        states: {
            hover: { filter: { type: 'none' } },
            active: { filter: { type: 'none' } },
        },
    }), [theme, displayBarColors, categories, unit, isMobile]);

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
