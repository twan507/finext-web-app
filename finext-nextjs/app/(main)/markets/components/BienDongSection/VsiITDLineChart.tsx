'use client';

import { useMemo } from 'react';
import { Box, useTheme, useMediaQuery, Skeleton } from '@mui/material';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

interface VsiITDLineChartProps {
    /** Pre-processed series data: x = sequential index, y = vsi% value */
    seriesData: { x: number; y: number }[];
    /** Map from sequential index → UTC timestamp (ms) for label formatting */
    indexToTimestamp: Map<number, number>;
    /** Max index for fixed x-axis width (full trading day) */
    xAxisMax?: number;
    chartHeight?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VsiITDLineChart({
    seriesData,
    indexToTimestamp,
    xAxisMax,
    chartHeight = '280px',
}: VsiITDLineChartProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));

    const upColor = theme.palette.trend.up;
    const downColor = theme.palette.trend.down;
    const refColor = theme.palette.trend.ref;
    const crosshairColor = (theme.palette as any).component?.chart?.crosshair || theme.palette.divider;

    const chartColors = useMemo(() => [theme.palette.primary.main], [theme]);

    const chartOptions: ApexOptions = useMemo(() => ({
        chart: {
            type: 'line',
            background: 'transparent',
            toolbar: { show: false },
            fontFamily: 'inherit',
            animations: { enabled: true, speed: 300, dynamicAnimation: { enabled: true, speed: 150 } },
            zoom: { enabled: false },
            selection: { enabled: false },
            redrawOnParentResize: true,
            dropShadow: {
                enabled: true,
                top: 0,
                left: 0,
                blur: 5,
                opacity: 1,
                color: chartColors as unknown as string,
            },
        },
        stroke: {
            curve: 'smooth',
            width: [2, 2.5],
            dashArray: [4, 0],
        },
        colors: [theme.palette.text.secondary, ...chartColors],
        fill: {
            type: ['solid', 'gradient'],
            gradient: {
                shade: 'dark',
                type: 'vertical',
                shadeIntensity: 0.4,
                opacityFrom: 0.7,
                opacityTo: 0.1,
            },
        },
        xaxis: {
            type: 'numeric',
            min: 0,
            max: xAxisMax,
            tickAmount: isMobile ? 6 : 6,
            tooltip: { enabled: false },
            axisBorder: { show: false },
            axisTicks: { show: false },
            crosshairs: {
                stroke: {
                    color: crosshairColor,
                    width: 1,
                    dashArray: 3,
                },
            },
            labels: {
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: getResponsiveFontSize('sm').md,
                },
                rotate: 0,
                hideOverlappingLabels: false,
                showDuplicates: true,
                formatter: (value: string) => {
                    const index = Math.round(parseFloat(value));
                    if (isNaN(index)) return '';
                    const ts = indexToTimestamp.get(index);
                    if (!ts) return '';
                    const d = new Date(ts);
                    const hours = d.getUTCHours().toString().padStart(2, '0');
                    const minutes = d.getUTCMinutes().toString().padStart(2, '0');
                    return `${hours}:${minutes}`;
                },
            },
        },
        yaxis: {
            opposite: true,
            labels: {
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: getResponsiveFontSize('sm').md,
                },
                formatter: (val: number) => `${val.toFixed(0)}%\u00A0\u00A0\u00A0`,
                offsetX: -10,
            },
        },
        grid: {
            borderColor: theme.palette.divider,
            strokeDashArray: 0,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
            padding: { top: 0, bottom: 0, left: 20, right: 5 },
        },
        // Price tag for last data point
        annotations: {
            position: 'back',
            yaxis: [
                ...(seriesData.length > 0 ? [{
                    y: seriesData[seriesData.length - 1].y,
                    borderColor: 'transparent',
                    strokeDashArray: 0,
                    label: {
                        borderColor: 'transparent',
                        style: {
                            color: '#fff',
                            background: chartColors[0],
                            fontSize: getResponsiveFontSize('sm').md,
                            fontWeight: fontWeight.medium,
                            padding: {
                                left: 6,
                                right: 6,
                                top: 2,
                                bottom: 2,
                            },
                        },
                        text: `${seriesData[seriesData.length - 1].y.toFixed(0)}%`,
                        position: 'right' as const,
                        textAnchor: 'start',
                        offsetX: 15.5,
                        offsetY: 8,
                    },
                }] : []),
            ],
        },
        tooltip: {
            enabled: true,
            shared: true,
            intersect: false,
            custom: function ({ series, seriesIndex, dataPointIndex, w }) {
                const xValue = w.globals.seriesX[seriesIndex][dataPointIndex];
                const index = Math.round(xValue);
                const ts = indexToTimestamp.get(index);

                let timeStr = '';
                if (ts) {
                    const d = new Date(ts);
                    const hours = d.getUTCHours().toString().padStart(2, '0');
                    const minutes = d.getUTCMinutes().toString().padStart(2, '0');
                    timeStr = `${hours}:${minutes}`;
                }

                const value = series[1]?.[dataPointIndex];
                const formattedValue = value != null ? `${value.toFixed(2)}%` : '—';
                const color = w.globals.colors[1];

                const bgColor = theme.palette.mode === 'dark' ? 'rgba(26, 26, 26, 0.9)' : 'rgba(255, 255, 255, 0.9)';
                const textColor = theme.palette.mode === 'dark' ? '#e0e0e0' : '#333333';

                return `
                    <div style="
                        background: ${bgColor};
                        border: none;
                        border-radius: 6px;
                        padding: 12px;
                        color: ${textColor};
                        min-width: 160px;
                        box-shadow: none !important;
                        filter: none !important;
                        -webkit-box-shadow: none !important;
                        -moz-box-shadow: none !important;
                    ">
                        <div style="font-weight: 600; margin-bottom: 8px; font-size: 13px; color: ${textColor};">
                            ${timeStr}
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${color};"></span>
                            <span style="flex: 1; font-size: 12px;">Chỉ số thanh khoản:</span>
                            <span style="font-weight: 600; font-size: 12px;">${formattedValue}</span>
                        </div>
                    </div>
                `;
            },
        },
        legend: { show: false },
        dataLabels: { enabled: false },
        markers: {
            size: 0,
            colors: [theme.palette.mode === 'dark' ? '#000000' : '#ffffff'],
            strokeColors: chartColors,
            strokeWidth: 2,
            hover: { size: 6 },
        },
    }), [theme, chartColors, indexToTimestamp, isMobile, crosshairColor, upColor, refColor]);

    const series = useMemo(() => [
        {
            name: '100% Reference',
            type: 'line',
            data: seriesData.map(d => ({ x: d.x, y: 100 })),
        },
        {
            name: 'Chỉ số thanh khoản',
            type: 'area',
            data: seriesData,
        },
    ], [seriesData]);

    const isLoading = !seriesData || seriesData.length === 0;

    return (
        <Box sx={{
            width: '100%',
            height: chartHeight,
            ml: (isMobile || isTablet) ? 0 : -4,
            '& .apexcharts-tooltip': {
                boxShadow: 'none !important',
                filter: 'none !important',
                WebkitBoxShadow: 'none !important',
                MozBoxShadow: 'none !important',
                background: 'transparent !important',
                border: 'none !important',
                padding: '0 !important',
            },
            '& .apexcharts-tooltip.apexcharts-theme-light, & .apexcharts-tooltip.apexcharts-theme-dark': {
                boxShadow: 'none !important',
                filter: 'none !important',
                background: 'transparent !important',
            },
            '& .apexcharts-yaxis-annotations line': {
                filter: `drop-shadow(0 0 4px ${theme.palette.text.secondary})`,
            },
        }}>
            {isLoading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pt: 2 }}>
                    <Box sx={{ display: 'flex', flex: 1, gap: 1 }}>
                        {/* Chart area placeholder */}
                        <Box sx={{ flex: 1, position: 'relative' }}>
                            <Skeleton
                                variant="rectangular"
                                sx={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: 1,
                                }}
                            />
                        </Box>
                        {/* Y-axis labels */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', py: 1 }}>
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} variant="text" width={40} height={16} />
                            ))}
                        </Box>
                    </Box>
                    {/* X-axis labels */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', pr: 6 }}>
                        {[...Array(7)].map((_, i) => (
                            <Skeleton key={i} variant="text" width={35} height={16} />
                        ))}
                    </Box>
                </Box>
            ) : (
                <Chart
                    options={chartOptions}
                    series={series}
                    type="area"
                    height="100%"
                    width="100%"
                />
            )}
        </Box>
    );
}
