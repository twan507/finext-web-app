'use client';

import { useMemo, useState, useCallback } from 'react';
import { Typography } from '@mui/material';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

interface VsiITDStockLineChartProps {
    /** Pre-processed series data: x = sequential index, y = vsi% value */
    seriesData: { x: number; y: number }[];
    /** Pre-processed t0_score series data: x = sequential index, y = t0_score value */
    t0ScoreSeriesData: { x: number; y: number }[];
    /** Map from sequential index → UTC timestamp (ms) for label formatting */
    indexToTimestamp: Map<number, number>;
    /** Max index for fixed x-axis width (full trading day) */
    xAxisMax?: number;
    chartHeight?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VsiITDStockLineChart({
    seriesData,
    t0ScoreSeriesData,
    indexToTimestamp,
    xAxisMax,
    chartHeight = '280px',
}: VsiITDStockLineChartProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const crosshairColor = (theme.palette as any).component?.chart?.crosshair || theme.palette.divider;

    const chartColors = useMemo(() => [theme.palette.primary.main, theme.palette.warning.main], [theme]);

    const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

    const handleLegendClick = useCallback((name: string) => {
        setHiddenSeries(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    }, []);

    const allSeries = useMemo(() => [
        {
            name: 'Chỉ số thanh khoản',
            type: 'area',
            data: seriesData,
        },
        {
            name: 'Dòng tiền trong phiên',
            type: 'line',
            data: t0ScoreSeriesData,
        },
    ], [seriesData, t0ScoreSeriesData]);

    const displaySeries = useMemo(() =>
        allSeries.map(s => ({
            ...s,
            data: hiddenSeries.has(s.name) ? [] : s.data,
        }))
    , [allSeries, hiddenSeries]);

    const displayAnnotations = useMemo(() => {
        const annotationDefs = [
            {
                seriesName: 'Chỉ số thanh khoản',
                data: seriesData,
                color: chartColors[0],
                yAxisIndex: 0,
                format: (val: number) => `${val.toFixed(0)}%`,
            },
            {
                seriesName: 'Dòng tiền trong phiên',
                data: t0ScoreSeriesData,
                color: chartColors[1],
                yAxisIndex: 1,
                format: (val: number) => `${val.toFixed(1)}`,
            },
        ];
        return annotationDefs
            .filter(def => !hiddenSeries.has(def.seriesName) && def.data.length > 0)
            .map(def => ({
                y: def.data[def.data.length - 1].y,
                yAxisIndex: def.yAxisIndex,
                borderColor: 'transparent',
                strokeDashArray: 0,
                label: {
                    borderColor: 'transparent',
                    style: {
                        color: '#fff',
                        background: def.color,
                        fontSize: getResponsiveFontSize('sm').md,
                        fontWeight: fontWeight.medium,
                        padding: { left: 6, right: 6, top: 2, bottom: 2 },
                    },
                    text: def.format(def.data[def.data.length - 1].y),
                    position: 'right' as const,
                    textAnchor: 'start',
                    offsetX: 15.5,
                    offsetY: 8,
                },
            }));
    }, [seriesData, t0ScoreSeriesData, chartColors, hiddenSeries]);

    const seriesKey = useMemo(() => `${theme.palette.mode}-${Array.from(hiddenSeries).sort().join(',')}`, [theme.palette.mode, hiddenSeries]);

    const legendItems = useMemo(() => [
        { name: 'Chỉ số thanh khoản', color: chartColors[0] },
        { name: 'Dòng tiền trong phiên', color: chartColors[1] },
    ], [chartColors]);

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
            width: [2.5, 2.5],
        },
        colors: chartColors,
        fill: {
            type: ['gradient', 'none'],
            gradient: {
                shade: 'dark',
                type: 'vertical',
                shadeIntensity: 0.4,
                inverseColors: false,
                opacityFrom: 0.4,
                opacityTo: 0,
                stops: [0, 100],
            },
        },
        xaxis: {
            type: 'numeric',
            min: 0,
            max: xAxisMax,
            tickAmount: isMobile ? 6 : 10,
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
        yaxis: [
            {
                seriesName: 'Chỉ số thanh khoản',
                opposite: true,
                min: 0,
                max: (max) => Math.max(100, max),
                labels: {
                    style: {
                        colors: theme.palette.text.secondary,
                        fontSize: getResponsiveFontSize('sm').md,
                    },
                    formatter: (val: number) => `${val.toFixed(0)}%\u00A0\u00A0\u00A0`,
                    offsetX: -10,
                },
            },
            {
                seriesName: 'Dòng tiền trong phiên',
                opposite: false,
                show: false,
            },
        ],
        grid: {
            borderColor: theme.palette.divider,
            strokeDashArray: 0,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
            padding: { top: 0, bottom: 0, left: 50, right: 5 },
        },
        annotations: {
            yaxis: displayAnnotations as any[],
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

                const vsiValue = series[0]?.[dataPointIndex];
                const t0Value = series[1]?.[dataPointIndex];
                const formattedVsi = vsiValue != null ? `${vsiValue.toFixed(2)}%` : '—';
                const formattedT0 = t0Value != null ? `${t0Value.toFixed(2)}` : '—';
                const vsiColor = w.globals.colors[0];
                const t0Color = w.globals.colors[1];

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
                            ${timeStr}
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${vsiColor};"></span>
                            <span style="flex: 1; font-size: 12px;">Chỉ số thanh khoản:</span>
                            <span style="font-weight: 600; font-size: 12px;">${formattedVsi}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${t0Color};"></span>
                            <span style="flex: 1; font-size: 12px;">Dòng tiền trong phiên:</span>
                            <span style="font-weight: 600; font-size: 12px;">${formattedT0}</span>
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
    }), [theme, chartColors, indexToTimestamp, isMobile, crosshairColor, displayAnnotations]);


    return (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {/* Custom legend — matches project pattern */}
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
                '& .apexcharts-yaxis-annotations line': {
                    filter: `drop-shadow(0 0 4px ${theme.palette.text.secondary})`,
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
