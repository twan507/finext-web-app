'use client';

import { useMemo, useRef, useCallback } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { fontWeight, getResponsiveFontSize } from 'theme/tokens';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export interface PENganhDataPoint {
    nganh: string;      // Industry name
    peChange: number;   // % change
}

interface PENganhChartProps {
    data: PENganhDataPoint[];
    chartHeight?: string;
    title?: string;
}

export default function PENganhChart({
    data,
    chartHeight = '340px',
    title,
}: PENganhChartProps) {
    const theme = useTheme();

    const trendUpColor = theme.palette.trend.up;
    const trendDownColor = theme.palette.trend.down;

    // Sort by peChange descending (least negative first = top)
    const sortedData = useMemo(() =>
        [...data].sort((a, b) => b.peChange - a.peChange),
        [data]
    );

    const categories = useMemo(() => sortedData.map(d => d.nganh), [sortedData]);
    const seriesData = useMemo(() => sortedData.map(d => d.peChange), [sortedData]);

    // Ref to hold current series data for DOM label adjustment
    const seriesDataRef = useRef<number[]>([]);
    seriesDataRef.current = seriesData;

    // Detect if any data point is negative
    const hasNegative = seriesData.some(v => v < 0);

    // Adjust labels for negative values
    const adjustNegativeLabels = useCallback((el: HTMLElement) => {
        requestAnimationFrame(() => {
            const currentData = seriesDataRef.current;
            const labels = el.querySelectorAll('.apexcharts-datalabels .apexcharts-datalabel');
            labels.forEach((label, index) => {
                if (currentData[index] != null && currentData[index] < 0) {
                    const currentX = parseFloat(label.getAttribute('x') || '0');
                    if (!label.getAttribute('data-adjusted')) {
                        label.setAttribute('x', String(currentX - 5));
                        label.setAttribute('text-anchor', 'end');
                        label.setAttribute('data-adjusted', 'true');
                    }
                }
            });
        });
    }, []);

    const displaySeries = useMemo(() => [{
        name: 'PE Ngành',
        data: seriesData,
    }], [seriesData]);

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
                dataLabels: {
                    position: 'top',
                },
                colors: {
                    ranges: [
                        { from: -Infinity, to: -0.0001, color: trendDownColor },
                        { from: 0, to: Infinity, color: trendUpColor },
                    ],
                },
            },
        },
        colors: [trendUpColor],
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
            formatter: (val: number) => `${val.toFixed(1)}%`,
        },
        xaxis: {
            categories,
            tickAmount: 4,
            labels: {
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: getResponsiveFontSize('sm').md,
                },
                formatter: (val: string) => `${parseFloat(val).toFixed(1)}%`,
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
                ...(hasNegative && { offsetX: -25 }),
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
            padding: { top: 0, bottom: 0, left: hasNegative ? 25 : 5, right: 50 },
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
                    const color = w.globals.colors[si];
                    const name = w.globals.seriesNames[si];
                    const formattedValue = `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

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
    }), [theme, trendUpColor, trendDownColor, categories, hasNegative, adjustNegativeLabels]);

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
