'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material';
import { fontWeight, getResponsiveFontSize } from 'theme/tokens';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface FinancialsLineChartProps {
    dates: string[];
    vonHoa: number[];
    loiNhuan: number[];
    doanhThu: number[];
    chartGroup?: string;
    chartId?: string;
    chartHeight?: string;
    onDataPointHover?: (index: number | null) => void;
}

export default function FinancialsLineChart({
    dates,
    vonHoa,
    loiNhuan,
    doanhThu,
    chartGroup = 'dinh-gia-sync',
    chartId = 'financials-line',
    chartHeight = '220px',
    onDataPointHover,
}: FinancialsLineChartProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
    const hoverRef = useRef(onDataPointHover);
    hoverRef.current = onDataPointHover;

    const colors = useMemo(() => [
        theme.palette.trend.down,    // Vốn hóa - đỏ
        theme.palette.trend.up,      // Lợi nhuận - xanh lá
        theme.palette.info.main,     // Doanh thu - xanh dương
    ], [theme]);

    const legendLabels = ['Vốn hóa', 'Lợi nhuận', 'Doanh thu'];

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

    // Transform raw values to cumulative % change (starting from 0)
    const toCumsumPctChange = useCallback((arr: number[]): number[] => {
        if (arr.length === 0) return [];
        const result: number[] = [0];
        for (let i = 1; i < arr.length; i++) {
            const pctChange = arr[i - 1] !== 0 ? ((arr[i] - arr[i - 1]) / arr[i - 1]) * 100 : 0;
            result.push(+(result[i - 1] + pctChange).toFixed(2));
        }
        return result;
    }, []);

    const displaySeries = useMemo(() => {
        const allSeries = [
            { name: legendLabels[0], data: toCumsumPctChange(vonHoa) },
            { name: legendLabels[1], data: toCumsumPctChange(loiNhuan) },
            { name: legendLabels[2], data: toCumsumPctChange(doanhThu) },
        ];
        return allSeries.map(s => ({
            ...s,
            data: hiddenSeries.has(s.name) ? [] : s.data,
        }));
    }, [vonHoa, loiNhuan, doanhThu, hiddenSeries, toCumsumPctChange]);

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
                color: colors as unknown as string,
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
        colors,
        stroke: {
            width: [2.5, 2.5, 2.5],
            curve: 'stepline',
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
            labels: { show: false },
            tickAmount: isMobile ? 4 : 6,
        },
        yaxis: {
            show: false,
            labels: {
                minWidth: 0,
                maxWidth: 0,
            },
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
        legend: { show: false },
        tooltip: {
            enabled: true,
            shared: true,
            intersect: false,
            custom: function ({ series: seriesData, dataPointIndex, w }) {
                const dateStr = dates[dataPointIndex] || '';
                let seriesHTML = '';
                seriesData.forEach((sd: any, idx: number) => {
                    const value = sd[dataPointIndex];
                    if (value == null) return;
                    const color = w.globals.colors[idx];
                    const name = w.globals.seriesNames[idx];
                    const sign = value > 0 ? '+' : '';
                    const formatted = `${sign}${value.toFixed(2)}%`;

                    seriesHTML += `
                        <div style="display: flex; align-items: center; gap: 8px; padding: 3px 0;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${color};"></span>
                            <span style="flex: 1; font-size: 12px;">${name}:</span>
                            <span style="font-weight: 600; font-size: 12px;">${formatted}</span>
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
                        padding: 10px 12px;
                        color: ${textColor};
                        min-width: 160px;
                        box-shadow: none !important;
                        filter: none !important;
                    ">
                        <div style="font-weight: 600; margin-bottom: 6px; font-size: 13px;">${dateStr}</div>
                        ${seriesHTML}
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
    }), [theme, colors, dates, chartId, chartGroup, isMobile]);

    return (
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
    );
}
