'use client';

import { useMemo, useRef } from 'react';
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
            tickAmount: isMobile ? 4 : 6,
        },
        yaxis: {
            show: false,
            labels: { minWidth: 0, maxWidth: 0 },
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        grid: {
            padding: { left: 0, right: 0, bottom: 0, top: 0 },
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
                        min-width: 120px;
                        box-shadow: none !important;
                        filter: none !important;
                    ">
                        <div style="font-weight: 600; margin-bottom: 6px; font-size: 13px;">${dateStr}</div>
                        <div style="display: flex; align-items: center; gap: 8px; padding: 2px 0;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${peColor};"></span>
                            <span style="font-size: 12px;">P/E:</span>
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
    }), [theme, peColor, avgPE, dates, chartId, chartGroup, isMobile]);

    return (
        <Box sx={{
            width: '100%',
            height: chartHeight,
            position: 'relative',
            overflow: 'hidden',
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
            </Box>
        </Box>
    );
}
