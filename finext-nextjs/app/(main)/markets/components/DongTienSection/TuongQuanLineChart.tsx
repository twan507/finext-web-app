'use client';

import { useMemo, useState, useCallback } from 'react';
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material';
import { fontWeight, getResponsiveFontSize } from 'theme/tokens';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// ── Category mode (1W, 1M, 3M, …) ────────────────────────────────────────────
interface CategoryModeProps {
    mode?: 'category';
    chartHeight?: string;
    dates: string[];
    series: { name: string; data: number[] }[];
    // 1D-only props – unused in category mode
    itdSeries?: never;
    indexToTimestamp?: never;
    xAxisMax?: never;
}

// ── ITD mode (1D) ─────────────────────────────────────────────────────────────
interface ItdModeProps {
    mode: 'itd';
    chartHeight?: string;
    /** Pre-processed series: x = sequential index, y = value */
    itdSeries: { name: string; data: { x: number; y: number }[] }[];
    /** Map index → UTC timestamp (ms) for label formatting */
    indexToTimestamp: Map<number, number>;
    /** Max index for fixed x-axis width */
    xAxisMax?: number;
    // category-only props – unused
    dates?: never;
    series?: never;
}

type DongTienLineChartProps = CategoryModeProps | ItdModeProps;

export default function DongTienLineChart(props: DongTienLineChartProps) {
    const {
        chartHeight = '250px',
        mode = 'category',
    } = props;

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

    const colors = useMemo(() => [
        theme.palette.primary.main,
        theme.palette.secondary.main,
        theme.palette.trend.up,
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

    const isItd = mode === 'itd';

    // ========== DISPLAY SERIES ==========
    const displaySeries = useMemo(() => {
        if (isItd) {
            const { itdSeries } = props as ItdModeProps;
            // 0% reference: use a line from x=0 to x=xAxisMax with y=0
            const maxIdx = (props as ItdModeProps).xAxisMax ?? 0;
            // Collect all unique x positions from active series to build dummy with same density
            const allX = new Set<number>();
            itdSeries.forEach(s => {
                if (!hiddenSeries.has(s.name)) {
                    s.data.forEach(p => allX.add(p.x));
                }
            });
            const sortedX = Array.from(allX).sort((a, b) => a - b);
            const dummy = {
                name: '0% Reference',
                type: 'line' as const,
                data: sortedX.map(x => ({ x, y: 0 })),
            };
            const active = itdSeries.map(s => ({
                ...s,
                data: hiddenSeries.has(s.name) ? [] : s.data,
            }));
            return [dummy, ...active];
        } else {
            const { dates, series } = props as CategoryModeProps;
            const dummy = {
                name: '0% Reference',
                type: 'line' as const,
                data: dates.map(() => 0),
            };
            const active = series.map(s => ({
                ...s,
                data: hiddenSeries.has(s.name) ? [] : s.data,
            }));
            return [dummy, ...active];
        }
    }, [isItd, props, hiddenSeries]);

    // ========== ANNOTATIONS ==========
    const displayAnnotations = useMemo(() => {
        const seriesList = isItd
            ? (props as ItdModeProps).itdSeries
            : (props as CategoryModeProps).series;

        return seriesList
            .map((s: any, i: number) => ({ series: s, color: colors[i % colors.length] }))
            .filter((item: any) => !hiddenSeries.has(item.series.name))
            .map((item: any) => {
                const data = item.series.data;
                if (!data || data.length === 0) return null;

                let lastValue: number;
                if (isItd) {
                    // {x, y} format
                    lastValue = data[data.length - 1].y;
                } else {
                    // number[] format — find last non-null
                    let val: number | null = null;
                    for (let i = data.length - 1; i >= 0; i--) {
                        if (data[i] !== null && data[i] !== undefined) { val = data[i]; break; }
                    }
                    if (val === null) return null;
                    lastValue = val;
                }

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
                        text: `${lastValue.toFixed(1)}%`,
                        position: 'right' as const,
                        textAnchor: 'start' as const,
                        offsetX: 15.5,
                        offsetY: 8,
                        borderRadius: 2,
                    },
                };
            }).filter(Boolean);
    }, [isItd, props, colors, hiddenSeries]);

    // ========== CHART OPTIONS ==========
    const chartOptions: ApexOptions = useMemo(() => {
        const crosshairColor = (theme.palette as any).component?.chart?.crosshair || theme.palette.divider;

        // xaxis config depends on mode
        const xaxisConfig: ApexXAxis = isItd
            ? {
                type: 'numeric',
                min: 0,
                max: (props as ItdModeProps).xAxisMax,
                tickAmount: isMobile ? 6 : 10,
                tooltip: { enabled: false },
                axisBorder: { show: false },
                axisTicks: { show: false },
                crosshairs: {
                    stroke: { color: crosshairColor, width: 1, dashArray: 3 },
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
                        const ts = (props as ItdModeProps).indexToTimestamp.get(index);
                        if (!ts) return '';
                        const d = new Date(ts);
                        const hours = d.getUTCHours().toString().padStart(2, '0');
                        const minutes = d.getUTCMinutes().toString().padStart(2, '0');
                        return `${hours}:${minutes}`;
                    },
                },
            }
            : {
                categories: (props as CategoryModeProps).dates,
                tooltip: { enabled: false },
                axisBorder: { show: false },
                axisTicks: { show: false },
                crosshairs: {
                    stroke: { color: crosshairColor, width: 1, dashArray: 3 },
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
            };

        return {
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
                    color: [theme.palette.text.secondary, ...colors] as unknown as string,
                },
            },
            annotations: {
                position: 'back',
                yaxis: displayAnnotations as any[],
            },
            colors: [theme.palette.text.secondary, ...colors],
            stroke: {
                width: [2, 2.5, 2.5, 2.5],
                curve: 'smooth',
                dashArray: [4, 0, 0, 0],
            },
            xaxis: xaxisConfig,
            yaxis: {
                opposite: true,
                labels: {
                    style: {
                        colors: theme.palette.text.secondary,
                        fontSize: getResponsiveFontSize('sm').md,
                    },
                    formatter: (val: number) => `${val.toFixed(1)}%\u00A0\u00A0\u00A0`,
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
                    let dateStr = '';

                    if (isItd) {
                        // Lookup timestamp from index
                        const xValue = w.globals.seriesX[seriesIndex]?.[dataPointIndex];
                        const index = Math.round(xValue);
                        const ts = (props as ItdModeProps).indexToTimestamp.get(index);
                        if (ts) {
                            const d = new Date(ts);
                            const hours = d.getUTCHours().toString().padStart(2, '0');
                            const minutes = d.getUTCMinutes().toString().padStart(2, '0');
                            dateStr = `${hours}:${minutes}`;
                        }
                    } else {
                        dateStr = (props as CategoryModeProps).dates[dataPointIndex] || '';
                    }

                    let seriesHTML = '';
                    seriesData.forEach((sd: any, idx: number) => {
                        const name = w.globals.seriesNames[idx];
                        if (name === '0% Reference') return;

                        const value = sd[dataPointIndex];
                        if (value == null) return;
                        const color = w.globals.colors[idx];
                        const formattedValue = `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

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
                strokeColors: [theme.palette.text.secondary, ...colors],
                strokeWidth: 2,
                hover: { size: 6 },
            },
            states: {
                hover: { filter: { type: 'none' } },
                active: { filter: { type: 'none' } },
            },
        };
    }, [theme, colors, displayAnnotations, props, isMobile, isItd]);

    const legendLabels = ['VNINDEX', 'FNXINDEX', 'Dòng tiền'];

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
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
                    key={`${theme.palette.mode}-${mode}`}
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
