'use client';

import { useMemo, useRef, useState, useCallback } from 'react';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import { getResponsiveFontSize } from 'theme/tokens';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface PELineChartProps {
    dates: string[];
    values: number[];
    chartGroup?: string;
    chartId?: string;
    chartHeight?: string;
    onDataPointHover?: (index: number | null) => void;
}

export default function PELineChart({
    dates,
    values,
    chartGroup = 'dinh-gia-sync',
    chartId = 'pe-market',
    chartHeight = '120px',
    onDataPointHover,
}: PELineChartProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const hoverRef = useRef(onDataPointHover);
    hoverRef.current = onDataPointHover;

    const peColor = theme.palette.warning.main;
    const lastValue = values.length > 0 ? values[values.length - 1] : null;

    // Track the pixel position of the last data point from the rendered SVG
    const [endpointPos, setEndpointPos] = useState<{ x: number; y: number } | null>(null);
    const [showEndpoint, setShowEndpoint] = useState(false);

    // Hide endpoint while values change to prevent tracking mid-animation
    useMemo(() => {
        // useMemo runs before render, useEffect runs after. We want it hidden instantly.
        setShowEndpoint(false);
    }, [values]);

    const updateEndpointPosition = useCallback((chartContext: any) => {
        window.setTimeout(() => {
            try {
                const el = chartContext?.el;
                if (!el) return;

                const path = el.querySelector('.apexcharts-line-series .apexcharts-series path');
                const inner = el.querySelector('.apexcharts-inner');
                if (!path || !inner) return;

                const pathLength = path.getTotalLength();
                if (pathLength === 0) return; // avoid errors if not rendered

                const lastPoint = path.getPointAtLength(pathLength);

                // Get the translation offset of the chart's inner group area
                const transformAttr = inner.getAttribute('transform') || '';
                const transformMatch = transformAttr.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
                let translateX = 0;
                let translateY = 0;
                if (transformMatch) {
                    translateX = parseFloat(transformMatch[1]) || 0;
                    translateY = parseFloat(transformMatch[2]) || 0;
                }

                setEndpointPos({
                    x: lastPoint.x + 2 + translateX,
                    y: lastPoint.y + translateY
                });
            } catch {
                // ignore
            }
        }, 50);
    }, []);

    // Calculate average P/E for the reference line
    const avgPE = useMemo(() => {
        if (values.length === 0) return 0;
        return values.reduce((sum, v) => sum + v, 0) / values.length;
    }, [values]);

    const series = useMemo(() => [{
        name: 'P/E thị trường Việt Nam',
        data: values,
    }], [values]);

    const chartOptions: ApexOptions = useMemo(() => ({
        chart: {
            id: chartId,
            group: chartGroup,
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
                opacity: 0.6,
                color: peColor,
            },
            events: {
                mouseMove: function (_event: any, _chartContext: any, config: any) {
                    if (config.dataPointIndex >= 0) {
                        hoverRef.current?.(config.dataPointIndex);
                    }
                },
                mouseLeave: function () {
                    hoverRef.current?.(null);
                },
                animationEnd: function (chartContext: any) {
                    updateEndpointPosition(chartContext);
                    setShowEndpoint(true);
                },
                mounted: function (chartContext: any) {
                    updateEndpointPosition(chartContext);
                    // Fallback to show endpoint if animationEnd doesn't fire
                    setTimeout(() => setShowEndpoint(true), 500);
                },
                updated: function (chartContext: any) {
                    updateEndpointPosition(chartContext);
                    setTimeout(() => setShowEndpoint(true), 500);
                },
            },
        },
        annotations: {
            yaxis: [{
                y: avgPE,
                borderColor: peColor,
                strokeDashArray: 4,
                opacity: 0.5,
                label: { text: '' },
            }],
        },
        colors: [peColor],
        stroke: {
            width: [2.5],
            curve: 'smooth',
        },
        // ===== SHARED AXIS/GRID CONFIG (must match FinancialsLineChart) =====
        xaxis: {
            categories: dates,
            tooltip: { enabled: false },
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: { show: false },
            crosshairs: {
                stroke: {
                    color: (theme.palette as any).component?.chart?.crosshair || theme.palette.divider,
                    width: 1,
                    dashArray: 3,
                },
            },
        },
        yaxis: {
            show: false,
            min: (min: number) => min,
            max: (max: number) => max,
            forceNiceScale: false,
            labels: { minWidth: 0, maxWidth: 0 },
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        grid: {
            padding: { left: 0, right: 0, bottom: -20, top: -20 },
            borderColor: 'transparent',
            strokeDashArray: 0,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: false } },
        },
        // ===== END SHARED CONFIG =====
        legend: { show: false },
        tooltip: {
            enabled: true,
            shared: true,
            intersect: false,
            custom: function ({ series: seriesData, dataPointIndex, w }) {
                const dateStr = dates[dataPointIndex] || '';
                const value = seriesData[0]?.[dataPointIndex];
                if (value == null) return '';

                const bgColor = theme.palette.mode === 'dark' ? 'rgba(26, 26, 26, 0.9)' : 'rgba(255, 255, 255, 0.9)';
                const textColor = theme.palette.mode === 'dark' ? '#e0e0e0' : '#333333';

                return `
                    <div style="
                        background: ${bgColor};
                        border: none;
                        border-radius: 6px;
                        padding: 10px 12px;
                        color: ${textColor};
                        min-width: 160px;
                        box-shadow: none !important;
                        filter: none !important;
                    ">
                        <div style="font-weight: 600; margin-bottom: 6px; font-size: 13px;">${dateStr}</div>
                        <div style="display: flex; align-items: center; gap: 8px; padding: 3px 0;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${peColor};"></span>
                            <span style="flex: 1; font-size: 12px;">P/E:</span>
                            <span style="font-weight: 600; font-size: 12px;">${value.toFixed(2)}</span>
                        </div>
                    </div>
                `;
            },
        },
        markers: {
            size: 0,
            hover: { size: 5 },
        },
        states: {
            hover: { filter: { type: 'none' } },
            active: { filter: { type: 'none' } },
        },
    }), [theme, peColor, avgPE, dates, chartId, chartGroup, updateEndpointPosition]);

    return (
        <Box sx={{
            width: '100%',
            height: chartHeight,
            position: 'relative',
            overflow: 'visible',
            borderRadius: 1,
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
            {/* Gradient background: red(top) → transparent(mid) → green(bottom) */}
            <Box
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: `linear-gradient(
                        to bottom,
                        rgba(183, 28, 28, 0.35) 0%,
                        rgba(183, 28, 28, 0.15) 25%,
                        rgba(0, 0, 0, 0) 50%,
                        rgba(27, 94, 32, 0.15) 75%,
                        rgba(27, 94, 32, 0.35) 100%
                    )`,
                    pointerEvents: 'none',
                    zIndex: 0,
                    borderRadius: '8px',
                }}
            />
            <Box sx={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
                <Chart
                    key={theme.palette.mode}
                    options={chartOptions}
                    series={series}
                    type="line"
                    height="100%"
                    width="100%"
                />
                {/* Dot + Price tag at the exact SVG endpoint */}
                {endpointPos && lastValue != null && (
                    <Box
                        sx={{
                            position: 'absolute',
                            left: endpointPos.x,
                            top: endpointPos.y,
                            transform: 'translate(-100%, -50%)',
                            zIndex: 2,
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            opacity: showEndpoint ? 1 : 0,
                            transition: 'opacity 0.2s ease-in',
                        }}
                    >
                        {/* Price tag */}
                        <Box
                            sx={{
                                background: `color-mix(in srgb, ${peColor} 80%, transparent)`,
                                color: '#fff',
                                fontSize: '13px',
                                fontWeight: 500,
                                borderRadius: '4px',
                                px: 0.75,
                                py: 0.25,
                                whiteSpace: 'nowrap',
                                lineHeight: 1.4,
                            }}
                        >
                            {lastValue.toFixed(2)}
                        </Box>
                        {/* Dot */}
                        <Box
                            sx={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: peColor,
                                flexShrink: 0,
                                boxShadow: `0 0 0 2.5px ${theme.palette.background.default}, 0 0 0 4px ${peColor}`,
                            }}
                        />
                    </Box>
                )}
            </Box>
        </Box>
    );
}
