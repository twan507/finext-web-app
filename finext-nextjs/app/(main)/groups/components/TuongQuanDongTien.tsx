'use client';

import { useMemo, useState, useCallback } from 'react';
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material';
import { fontWeight, getResponsiveFontSize } from 'theme/tokens';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface TuongQuanDongTienProps {
    chartHeight?: string;
    title?: string;
    dates: string[];
    series: { name: string; data: number[] }[];
    unit?: 'percent' | 'number';
}

export default function TuongQuanDongTien({
    chartHeight = '250px',
    title,
    dates,
    series,
    unit = 'percent',
}: TuongQuanDongTienProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

    const colors = useMemo(() => [
        theme.palette.primary.main,
        theme.palette.secondary.main,
        theme.palette.trend.up,
        theme.palette.trend.down,
    ], [theme]);

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

    const displaySeries = useMemo(() => {
        const dummy = {
            name: '0% Reference',
            type: 'line',
            data: dates.map(() => 0),
        };
        const active = series.map(s => ({
            ...s,
            data: hiddenSeries.has(s.name) ? [] : s.data,
        }));
        return [dummy, ...active];
    }, [series, hiddenSeries, dates]);

    const displayAnnotations = useMemo(() =>
        series
            .map((s, i) => ({ series: s, color: colors[i % colors.length] }))
            .filter(item => !hiddenSeries.has(item.series.name))
            .map(item => {
                const data = item.series.data;
                if (!data || data.length === 0) return null;
                const lastValue = data[data.length - 1];
                return {
                    y: lastValue,
                    borderColor: 'transparent',
                    strokeDashArray: 0,
                    label: {
                        borderColor: 'transparent',
                        style: {
                            color: '#fff',
                            background: item.color,
                            fontSize: getResponsiveFontSize('sm').md,
                            fontWeight: fontWeight.medium,
                            padding: { left: 6, right: 6, top: 2, bottom: 2 },
                        },
                        text: unit === 'percent' ? `${lastValue.toFixed(1)}%` : `${lastValue.toFixed(1)}`,
                        position: 'right' as const,
                        textAnchor: 'start' as const,
                        offsetX: 15.5,
                        offsetY: 8,
                        borderRadius: 2,
                    },
                };
            }).filter(Boolean),
        [series, colors, hiddenSeries, unit]
    );

    const chartOptions: ApexOptions = useMemo(() => ({
        chart: {
            type: 'line',
            background: 'transparent',
            toolbar: { show: false },
            zoom: { enabled: false },
            fontFamily: 'inherit',
            animations: { enabled: true, speed: 300, dynamicAnimation: { enabled: true, speed: 150 } },
            redrawOnParentResize: true,
            dropShadow: {
                enabled: true,
                top: 0,
                left: 0,
                blur: 5,
                opacity: 0.8,
                color: colors as unknown as string,
            },
        },
        annotations: {
            position: 'back',
            yaxis: displayAnnotations as any[],
        },
        colors: [theme.palette.text.secondary, ...colors],
        stroke: {
            width: [2, 2.5, 2.5, 2.5, 2.5, 2.5],
            curve: 'smooth',
            dashArray: [4, 0, 0, 0, 0, 0],
        },
        xaxis: {
            categories: dates,
            tooltip: { enabled: false },
            axisBorder: { show: false },
            axisTicks: { show: false },
            crosshairs: {
                stroke: {
                    color: (theme.palette as any).component?.chart?.crosshair || theme.palette.divider,
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
                hideOverlappingLabels: true,
            },
            tickAmount: isMobile ? 4 : 7,
        },
        yaxis: {
            opposite: true,
            labels: {
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: getResponsiveFontSize('sm').md,
                },
                formatter: (val: number) => unit === 'percent' ? `${val.toFixed(1)}%\u00A0\u00A0\u00A0` : `${val.toFixed(1)}\u00A0\u00A0\u00A0`,
                offsetX: -10,
            },
        },
        grid: {
            padding: { left: 20, right: 5, bottom: 0, top: 0 },
            borderColor: theme.palette.divider,
            strokeDashArray: 0,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
        },
        legend: { show: false },
        tooltip: {
            enabled: true,
            shared: true,
            intersect: false,
            custom: function ({ series: seriesData, seriesIndex, dataPointIndex, w }) {
                const dateStr = dates[dataPointIndex] || '';

                let seriesHTML = '';
                seriesData.forEach((sd: any, idx: number) => {
                    const name = w.globals.seriesNames[idx];
                    if (name === '0% Reference') return;

                    const value = sd[dataPointIndex];
                    if (value == null) return;
                    const color = w.globals.colors[idx];
                    const formattedValue = unit === 'percent'
                        ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
                        : `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;

                    seriesHTML += `
                        <div style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${color};"></span>
                            <span style="flex: 1; font-size: 12px;">${name}:</span>
                            <span style="font-weight: 600; font-size: 12px;">${formattedValue}</span>
                        </div>
                    `;
                });

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
                            ${dateStr}
                        </div>
                        ${seriesHTML}
                    </div>
                `;
            },
        },
        markers: {
            size: 0,
            colors: [theme.palette.mode === 'dark' ? '#000000' : '#ffffff'],
            strokeColors: colors,
            strokeWidth: 2,
            hover: { size: 6 },
        },
        states: {
            hover: { filter: { type: 'none' } },
            active: { filter: { type: 'none' } },
        },
    }), [theme, colors, displayAnnotations, dates, isMobile, unit]);

    // Dynamic legend labels from series names
    const legendLabels = useMemo(() => series.map(s => s.name), [series]);

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
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 0, flexWrap: 'wrap', position: 'relative', zIndex: 2 }}>
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
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colors[index % colors.length] }} />
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
                    type="line"
                    height="100%"
                    width="100%"
                />
            </Box>
        </Box>
    );
}
