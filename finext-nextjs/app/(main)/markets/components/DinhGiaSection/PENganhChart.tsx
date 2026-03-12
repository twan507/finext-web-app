'use client';

import { useMemo, useRef, useCallback } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { fontWeight, getResponsiveFontSize } from 'theme/tokens';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export interface PENganhDataPoint {
    nganh: string;      // Industry name
    peChange: number;   // PE value
}

interface PENganhChartProps {
    data: PENganhDataPoint[];
    marketPE?: number;
    chartHeight?: string;
    title?: string;
}

export default function PENganhChart({
    data,
    marketPE,
    chartHeight = '700px',
    title,
}: PENganhChartProps) {
    const theme = useTheme();

    const barColor = theme.palette.warning.main;

    // Sort by peChange descending (least negative first = top)
    const sortedData = useMemo(() =>
        [...data].sort((a, b) => b.peChange - a.peChange),
        [data]
    );

    const categories = useMemo(() => sortedData.map(d => d.nganh), [sortedData]);
    // Original PE values for display
    const originalValues = useMemo(() => sortedData.map(d => d.peChange), [sortedData]);

    // Log-scaled values for bar widths (visual proportion)
    // Using log10 so e.g. PE=10 → 1, PE=100 → 2, PE=200 → 2.3
    const seriesData = useMemo(() =>
        originalValues.map(v => v > 0 ? Math.log10(v) : 0),
        [originalValues]
    );

    // Ref to hold current original data for DOM label adjustment
    const seriesDataRef = useRef<number[]>([]);
    seriesDataRef.current = originalValues;

    // Detect if any data point is negative
    const hasNegative = originalValues.some(v => v < 0);

    // Adjust labels for negative values
    const adjustNegativeLabels = useCallback((el: HTMLElement) => {
        requestAnimationFrame(() => {
            const currentData = seriesDataRef.current;
            const labels = el.querySelectorAll('.apexcharts-datalabels .apexcharts-datalabel');
            labels.forEach((label, index) => {
                if (currentData[index] != null && currentData[index] < 0) {
                    const currentX = parseFloat(label.getAttribute('x') || '0');
                    if (!label.getAttribute('data-adjusted')) {
                        label.setAttribute('x', String(currentX + 10));
                        label.setAttribute('text-anchor', 'start');
                        label.setAttribute('data-adjusted', 'true');
                    }
                }
            });
        });
    }, []);

    const displaySeries = useMemo(() => [{
        name: 'P/E',
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
        annotations: marketPE && marketPE > 0 ? {
            xaxis: [{
                x: Math.log10(marketPE),
                borderColor: theme.palette.text.primary,
                strokeDashArray: 4,
                borderWidth: 1,
                label: {
                    text: `PE thị trường ${marketPE.toFixed(2)}`,
                    position: 'bottom',
                    orientation: 'horizontal',
                    borderWidth: 0,
                    style: {
                        color: theme.palette.text.primary,
                        background: 'transparent',
                        fontSize: getResponsiveFontSize('sm').md,
                        // fontWeight: Number(fontWeight.semibold),
                        padding: { left: 4, right: 4, top: 2, bottom: 2 },
                    },
                    offsetY: 20,
                },
            }],
        } : {},
        plotOptions: {
            bar: {
                horizontal: true,
                barHeight: '70%',
                borderRadius: 3,
                borderRadiusApplication: 'end',
                dataLabels: {
                    position: 'top',
                },

            },
        },
        colors: [barColor],
        dataLabels: {
            enabled: true,
            textAnchor: 'end',
            offsetX: -5,
            offsetY: 7,
            style: {
                colors: ['#ffffff'],
                fontSize: getResponsiveFontSize('xs').md,
                fontWeight: fontWeight.medium,
            },
            formatter: (_val: number, opts: any) => {
                const idx = opts.dataPointIndex;
                const orig = originalValues[idx];
                return orig != null ? orig.toFixed(1) : '';
            },
        },
        xaxis: {
            categories,
            tickAmount: 4,
            labels: {
                show: false,
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: getResponsiveFontSize('sm').md,
                },
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
            padding: { top: 0, bottom: 10, left: 20, right: 0 },
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
                    const logValue = sd[dataPointIndex];
                    if (logValue == null) return '';
                    const color = w.globals.colors[si];
                    const name = w.globals.seriesNames[si];
                    // Show original PE value, not log
                    const origValue = originalValues[dataPointIndex];
                    const formattedValue = origValue != null ? origValue.toFixed(2) : logValue.toFixed(2);

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
    }), [theme, barColor, categories, hasNegative, adjustNegativeLabels, originalValues]);

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
