'use client';

import { useMemo, useState, useCallback } from 'react';
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material';
import { fontWeight, getResponsiveFontSize } from 'theme/tokens';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface PhanBoDongTienProps {
    chartHeight?: string;
    title?: string;
    categories: string[];
    flowData: {
        flowIn: number;
        flowOut: number;
        flowNeutral: number;
    }[];
}

export default function PhanBoDongTien({
    chartHeight = '230px',
    title,
    categories,
    flowData,
}: PhanBoDongTienProps) {
    const theme = useTheme();
    const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
    const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

    const trendUpColor = theme.palette.trend.up;
    const trendDownColor = theme.palette.trend.down;
    const trendRefColor = theme.palette.trend.ref;

    const baseSeries = useMemo(() => [
        { name: 'Tiền vào', color: trendUpColor, data: flowData.map(d => d.flowIn) },
        { name: 'Không đổi', color: trendRefColor, data: flowData.map(d => d.flowNeutral) },
        { name: 'Tiền ra', color: trendDownColor, data: flowData.map(d => d.flowOut) },
    ], [flowData, trendUpColor, trendRefColor, trendDownColor]);

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

    const { displaySeries, displayColors } = useMemo(() => {
        return {
            displaySeries: baseSeries.map(s => ({
                name: s.name,
                data: hiddenSeries.has(s.name) ? s.data.map(() => 0) : s.data,
            })),
            displayColors: baseSeries.map(s => s.color),
        };
    }, [baseSeries, hiddenSeries]);

    const chartOptions: ApexOptions = useMemo(() => ({
        chart: {
            type: 'bar',
            stacked: true,
            stackType: '100%',
            background: 'transparent',
            toolbar: { show: false },
            fontFamily: 'inherit',
            animations: { enabled: true, speed: 300 },
        },
        plotOptions: {
            bar: {
                horizontal: true,
                barHeight: '55%',
                borderRadius: 3,
                borderRadiusApplication: 'around' as const,
                borderRadiusWhenStacked: 'all' as const,
            },
        },
        colors: displayColors,
        dataLabels: {
            enabled: true,
            offsetY: 7,
            style: {
                colors: [theme.palette.text.secondary],
                fontSize: getResponsiveFontSize('xs').md,
                fontWeight: fontWeight.semibold,
            },
            formatter: function (val: number) {
                if (val < 10) return '';
                return `${val.toFixed(0)}%`;
            },
            dropShadow: { enabled: false },
        },
        xaxis: {
            categories,
            tickAmount: 4,
            labels: {
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: getResponsiveFontSize('sm').md,
                },
                formatter: (val: string) => `${parseFloat(val).toFixed(0)}%`,
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
                show: isTablet,
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
            padding: { top: 0, bottom: 0, left: 5, right: 5 },
        },
        legend: { show: false },
        tooltip: {
            enabled: true,
            shared: true,
            intersect: false,
            custom: function ({ series: seriesData, dataPointIndex, w }: any) {
                const categoryName = w.globals.labels[dataPointIndex] || '';
                const total = seriesData.reduce((sum: number, s: number[]) => sum + (s[dataPointIndex] || 0), 0);

                const bgColor = theme.palette.mode === 'dark' ? 'rgba(26, 26, 26, 0.9)' : 'rgba(255, 255, 255, 0.9)';
                const textColor = theme.palette.mode === 'dark' ? '#e0e0e0' : '#333333';

                const items = w.globals.seriesNames.map((name: string, idx: number) => {
                    const value = seriesData[idx]?.[dataPointIndex] || 0;
                    const pct = total > 0 ? (value / total * 100).toFixed(1) : '0.0';
                    const color = w.globals.colors[idx];
                    return `
                        <div style="display: flex; align-items: center; gap: 8px; padding: 3px 0;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${color}; flex-shrink: 0;"></span>
                            <span style="flex: 1; font-size: 12px;">${name}:</span>
                            <span style="font-weight: 600; font-size: 12px;">${pct}%</span>
                        </div>
                    `;
                }).join('');

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
                    ">
                        <div style="font-weight: 600; margin-bottom: 8px; font-size: 13px; color: ${textColor};">
                            ${categoryName}
                        </div>
                        ${items}
                    </div>
                `;
            },
        },
        states: {
            hover: { filter: { type: 'none' } },
            active: { filter: { type: 'none' } },
        },
    }), [theme, displayColors, categories, isTablet]);

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
            {/* Legend */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 0, flexWrap: 'wrap', position: 'relative', zIndex: 2 }}>
                {baseSeries.map(item => {
                    const isHidden = hiddenSeries.has(item.name);
                    return (
                        <Box
                            key={item.name}
                            onClick={() => handleLegendClick(item.name)}
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
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color }} />
                            <Typography
                                color="text.secondary"
                                sx={{
                                    fontSize: getResponsiveFontSize('xs'),
                                    fontWeight: fontWeight.medium,
                                    textDecoration: isHidden ? 'line-through' : 'none',
                                }}
                            >
                                {item.name}
                            </Typography>
                        </Box>
                    );
                })}
            </Box>
            <Box sx={{
                mt: -2,
                width: '100%',
                px: { lg: 2 },
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
                }
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
