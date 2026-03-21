'use client';

import { useMemo, useState, useCallback } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { fontWeight, getResponsiveFontSize } from 'theme/tokens';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

interface RankingLineChartProps {
    dates: string[];
    marketRankData: number[];
    industryRankData: number[];
    chartHeight?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RankingLineChart({
    dates,
    marketRankData,
    industryRankData,
    chartHeight = '280px',
}: RankingLineChartProps) {
    const theme = useTheme();
    const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

    const colors = useMemo(() => [
        theme.palette.primary.main,
        theme.palette.warning.main,
    ], [theme]);

    const crosshairColor = (theme.palette as any).component?.chart?.crosshair || theme.palette.divider;

    const legendItems = useMemo(() => [
        { name: 'Xếp hạng thị trường', color: colors[0] },
        { name: 'Xếp hạng trong ngành', color: colors[1] },
    ], [colors]);

    const handleLegendClick = useCallback((name: string) => {
        setHiddenSeries(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    }, []);

    const seriesData = useMemo(() => [
        { name: 'Xếp hạng thị trường', data: marketRankData },
        { name: 'Xếp hạng trong ngành', data: industryRankData },
    ], [marketRankData, industryRankData]);

    // Stable key to force re-mount when legend toggles
    const seriesKey = useMemo(() => `${theme.palette.mode}-${Array.from(hiddenSeries).sort().join(',')}`, [theme.palette.mode, hiddenSeries]);

    const displaySeries = useMemo(() =>
        seriesData.map(s => ({
            ...s,
            data: hiddenSeries.has(s.name) ? [] : s.data,
        }))
    , [seriesData, hiddenSeries]);

    // Price tag annotations for each visible series' last value
    const displayAnnotations = useMemo(() =>
        seriesData
            .map((s, i) => ({ series: s, color: colors[i] }))
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
                        text: `${lastValue.toFixed(1)}%`,
                        position: 'right' as const,
                        textAnchor: 'start' as const,
                        offsetX: 15.5,
                        offsetY: 8,
                    },
                };
            }).filter(Boolean)
    , [seriesData, colors, hiddenSeries]);

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
        colors,
        stroke: {
            curve: 'straight',
            width: 2.5,
        },
        xaxis: {
            categories: dates,
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
                hideOverlappingLabels: true,
                offsetY: 5,
            },
        },
        yaxis: {
            opposite: true,
            min: 0,
            max: 100,
            tickAmount: 5,
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
            custom: function ({ series: s, dataPointIndex, w }) {
                const dateStr = dates[dataPointIndex] || '';
                let seriesHTML = '';
                s.forEach((sd: any, idx: number) => {
                    const name = w.globals.seriesNames[idx];
                    const value = sd[dataPointIndex];
                    if (value == null) return;
                    const color = w.globals.colors[idx];
                    seriesHTML += `
                        <div style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${color};"></span>
                            <span style="flex: 1; font-size: 12px;">${name}:</span>
                            <span style="font-weight: 600; font-size: 12px;">${value.toFixed(1)}%</span>
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
                        min-width: 180px;
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
        // Dot on market rank series (index 0), no dot on industry (index 1)
        markers: {
            size: [4, 4],
            colors: [theme.palette.mode === 'dark' ? '#000000' : '#ffffff'],
            strokeColors: colors,
            strokeWidth: 2,
            hover: { size: 6 },
        },
        states: {
            hover: { filter: { type: 'none' } },
            active: { filter: { type: 'none' } },
        },
        dataLabels: { enabled: false },
    }), [theme, colors, crosshairColor, displayAnnotations, dates]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {/* Custom legend — toggleable */}
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
                    key={seriesKey}
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
