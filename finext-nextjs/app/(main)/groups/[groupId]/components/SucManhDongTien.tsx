'use client';

import { useMemo, useState, useCallback } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { fontWeight, getResponsiveFontSize } from 'theme/tokens';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface SucManhDongTienProps {
    chartHeight?: string;
    title?: string;
    dates: string[];
    t5ScoreData: number[];  // line series
    t0ScoreData: number[];  // bar series
}

export default function SucManhDongTien({
    chartHeight = '250px',
    title,
    dates,
    t5ScoreData,
    t0ScoreData,
}: SucManhDongTienProps) {
    const theme = useTheme();
    const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

    const lineColor = theme.palette.primary.main;
    const barColorPositive = theme.palette.trend.up;
    const barColorNegative = theme.palette.trend.down;

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

    const legendItems = useMemo(() => [
        { name: 'Dòng tiền trong tuần', color: lineColor },
        { name: 'Dòng tiền trong phiên', color: barColorPositive },
    ], [lineColor, barColorPositive]);

    // Build series: line (t5_score) + bar (t0_score)
    const displaySeries = useMemo(() => {
        return [
            {
                name: 'Dòng tiền trong tuần',
                type: 'line',
                data: hiddenSeries.has('Dòng tiền trong tuần') ? [] : t5ScoreData,
            },
            {
                name: 'Dòng tiền trong phiên',
                type: 'column',
                data: hiddenSeries.has('Dòng tiền trong phiên') ? [] : t0ScoreData,
            },
        ];
    }, [t5ScoreData, t0ScoreData, hiddenSeries]);

    // Bar colors based on positive/negative
    const barFillColors = useMemo(() =>
        t0ScoreData.map(v => v >= 0 ? barColorPositive : barColorNegative),
        [t0ScoreData, barColorPositive, barColorNegative]);

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
                color: [lineColor, 'transparent'] as unknown as string,
            },
        },
        colors: [lineColor, barColorPositive],
        stroke: {
            width: [2.5, 0],
            curve: 'smooth',
        },
        fill: {
            colors: [lineColor, barColorPositive],
        },
        plotOptions: {
            bar: {
                columnWidth: '60%',
                borderRadius: 2,
                colors: {
                    ranges: [
                        { from: -Infinity, to: -0.001, color: barColorNegative },
                        { from: -0.001, to: 0.001, color: theme.palette.trend.ref },
                        { from: 0.001, to: Infinity, color: barColorPositive },
                    ],
                },
            },
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
            tickAmount: 4,
        },
        yaxis: [
            {
                // Left y-axis for t5_score (line)
                seriesName: 'Dòng tiền trong tuần',
                labels: {
                    style: {
                        colors: theme.palette.text.secondary,
                        fontSize: getResponsiveFontSize('sm').md,
                    },
                    formatter: (val: number) => `${val.toFixed(1)}\u00A0\u00A0`,
                },
            },
            {
                // Right y-axis for t0_score (bar)
                opposite: true,
                seriesName: 'Dòng tiền trong phiên',
                labels: {
                    style: {
                        colors: theme.palette.text.secondary,
                        fontSize: getResponsiveFontSize('sm').md,
                    },
                    formatter: (val: number) => `\u00A0\u00A0${val.toFixed(1)}`,
                },
            },
        ],
        grid: {
            padding: { left: 10, right: 5, bottom: 0, top: 0 },
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
            custom: function ({ series: seriesData, dataPointIndex, w }) {
                const dateStr = dates[dataPointIndex] || '';
                let seriesHTML = '';
                seriesData.forEach((sd: any, idx: number) => {
                    const name = w.globals.seriesNames[idx];
                    const value = sd[dataPointIndex];
                    if (value == null) return;
                    const color = idx === 0 ? lineColor : (value >= 0 ? barColorPositive : barColorNegative);
                    const formattedValue = `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
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
            strokeColors: [lineColor],
            strokeWidth: 2,
            hover: { size: 6 },
        },
        states: {
            hover: { filter: { type: 'none' } },
            active: { filter: { type: 'none' } },
        },
        dataLabels: { enabled: false },
    }), [theme, lineColor, barColorPositive, barColorNegative, dates]);

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
                {legendItems.map((item) => {
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
