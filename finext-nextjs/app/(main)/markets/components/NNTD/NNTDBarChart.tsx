'use client';

import { useMemo, useRef, useCallback } from 'react';
import { Box, Typography, useTheme, useMediaQuery, Skeleton } from '@mui/material';
import { fontWeight, getResponsiveFontSize } from 'theme/tokens';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import type { NNTDRecord } from './NNTDSummaryPanel';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface NNTDBarChartProps {
    data: NNTDRecord[];
    chartHeight?: string;
    title?: string;
    loading?: boolean;
}

export default function NNTDBarChart({
    data,
    chartHeight = '100%',
    title = 'Giá trị Nước ngoài mua ròng (tỷ)',
    loading = false,
}: NNTDBarChartProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const barCount = isMobile ? 5 : 10;

    // Use ref to always have fresh seriesData in event callbacks (fixes stale closure)
    const seriesDataRef = useRef<number[]>([]);

    // Aggregate buy_value, sell_value, net_value by date
    const { categories, seriesData, buyData, sellData, colors } = useMemo(() => {
        if (!data || data.length === 0) return { categories: [], seriesData: [], buyData: [], sellData: [], colors: [] };

        // Group by date → sum net_value, buy_value, sell_value
        const dateMap = new Map<string, { net: number; buy: number; sell: number }>();
        for (const r of data) {
            const prev = dateMap.get(r.date) || { net: 0, buy: 0, sell: 0 };
            dateMap.set(r.date, {
                net: prev.net + (r.net_value || 0),
                buy: prev.buy + (r.buy_value || 0),
                sell: prev.sell + (r.sell_value || 0),
            });
        }

        // Sort by date ascending, take last N
        const entries = Array.from(dateMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-barCount);

        const cats = entries.map(([date]) => {
            const d = new Date(date);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            return `${day}/${month}`;
        });

        // Values are already in tỷ (billions VND)
        const values = entries.map(([, agg]) => parseFloat(agg.net.toFixed(2)));
        const buys = entries.map(([, agg]) => parseFloat(agg.buy.toFixed(2)));
        const sells = entries.map(([, agg]) => parseFloat(agg.sell.toFixed(2)));

        // Color per bar: up if positive, down if negative
        const barColors = values.map((v) =>
            v >= 0 ? theme.palette.trend.up : theme.palette.trend.down
        );

        return { categories: cats, seriesData: values, buyData: buys, sellData: sells, colors: barColors };
    }, [data, theme, barCount]);

    // Keep ref in sync
    seriesDataRef.current = seriesData;

    // Adjust negative labels using requestAnimationFrame (no flicker)
    const adjustNegativeLabels = useCallback((el: HTMLElement) => {
        requestAnimationFrame(() => {
            const currentData = seriesDataRef.current;
            const labels = el.querySelectorAll('.apexcharts-datalabels .apexcharts-datalabel');
            labels.forEach((label, index) => {
                if (currentData[index] != null && currentData[index] < 0) {
                    const currentY = parseFloat(label.getAttribute('y') || '0');
                    // Only adjust if not already adjusted (check data attribute)
                    if (!label.getAttribute('data-adjusted')) {
                        label.setAttribute('y', String(currentY + 8));
                        label.setAttribute('data-adjusted', 'true');
                    }
                }
            });
        });
    }, []);

    const chartOptions: ApexOptions = useMemo(() => ({
        chart: {
            type: 'bar',
            background: 'transparent',
            toolbar: { show: false },
            fontFamily: 'inherit',
            animations: { enabled: false },
            events: {
                mounted: function (chartContext: any) {
                    adjustNegativeLabels(chartContext.el);
                },
                updated: function (chartContext: any) {
                    // Reset adjusted flags before re-adjusting on update
                    const labels = chartContext.el.querySelectorAll('.apexcharts-datalabels .apexcharts-datalabel');
                    labels.forEach((label: Element) => label.removeAttribute('data-adjusted'));
                    adjustNegativeLabels(chartContext.el);
                },
            },
        },
        plotOptions: {
            bar: {
                columnWidth: '50%',
                distributed: true,
                borderRadius: 3,
                borderRadiusApplication: 'end',
                dataLabels: {
                    position: 'top',
                },
            },
        },
        colors: colors,
        dataLabels: {
            enabled: true,
            formatter: function (val: number) {
                return val.toFixed(1);
            },
            style: {
                fontSize: getResponsiveFontSize('sm').md,
                colors: [theme.palette.text.secondary],
            },
            offsetY: -10,
            dropShadow: { enabled: false },
            background: { enabled: false },
        },
        xaxis: {
            categories,
            labels: {
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: getResponsiveFontSize('sm').md,
                    fontWeight: 400,
                },
                offsetY: 8,
            },
            axisBorder: {
                show: true,
                color: theme.palette.divider,
            },
            axisTicks: { show: false },
            crosshairs: { show: false },
        },
        yaxis: {
            tickAmount: 4,
            forceNiceScale: true,
            labels: {
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: getResponsiveFontSize('sm').md,
                },
                formatter: (val: number) => `${val.toLocaleString('en-US')}`,
            },
        },
        grid: {
            borderColor: theme.palette.divider,
            strokeDashArray: 0,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
            padding: { top: 0, bottom: 0, left: 15, right: 15 },
        },
        legend: { show: false },
        tooltip: {
            enabled: true,
            shared: true,
            intersect: false,
            custom: function ({ series: s, dataPointIndex, w }: any) {
                const netVal = s[0]?.[dataPointIndex];
                if (netVal == null) return '';
                const cat = w.globals.labels[dataPointIndex] || '';
                const color = w.globals.colors[dataPointIndex];
                const buyVal = buyData[dataPointIndex] ?? 0;
                const sellVal = sellData[dataPointIndex] ?? 0;

                const bgColor = theme.palette.mode === 'dark' ? 'rgba(26,26,26,0.95)' : 'rgba(255,255,255,0.95)';
                const textColor = theme.palette.mode === 'dark' ? '#e0e0e0' : '#333';
                const upColor = theme.palette.trend.up;
                const downColor = theme.palette.trend.down;

                const fmtVal = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)} tỷ`;

                return `<div style="background:${bgColor};border:none;border-radius:6px;padding:12px 14px;color:${textColor};min-width:160px;box-shadow:none!important;">
                    <div style="font-weight:600;font-size:13px;margin-bottom:8px;">${cat}</div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                        <span style="width:10px;height:10px;border-radius:50%;background:${upColor};display:inline-block;"></span>
                        <span style="font-size:12px;">GT Mua:</span>
                        <span style="font-weight:600;font-size:12px;color:${upColor};">${buyVal.toFixed(2)} tỷ</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                        <span style="width:10px;height:10px;border-radius:50%;background:${downColor};display:inline-block;"></span>
                        <span style="font-size:12px;">GT Bán:</span>
                        <span style="font-weight:600;font-size:12px;color:${downColor};">${sellVal.toFixed(2)} tỷ</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;"></span>
                        <span style="font-size:12px;">GT Ròng:</span>
                        <span style="font-weight:600;font-size:12px;color:${color};">${fmtVal(netVal)}</span>
                    </div>
                </div>`;
            },
        },
        states: {
            hover: { filter: { type: 'none' } },
            active: { filter: { type: 'none' } },
        },
    }), [theme, categories, colors, buyData, sellData, adjustNegativeLabels]);

    const series = useMemo(() => [{ name: 'GT NN ròng', data: seriesData }], [seriesData]);

    const isLoading = loading || (!data || data.length === 0);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Title */}
            <Typography
                color="text.secondary"
                sx={{
                    fontSize: getResponsiveFontSize('lg'),
                    fontWeight: fontWeight.semibold,
                    textTransform: 'uppercase',
                    mb: 0.5,
                }}
            >
                {title}
            </Typography>

            {/* Chart or Skeleton */}
            <Box sx={{
                flex: 1,
                width: '100%',
                minHeight: 250,
                height: chartHeight,
                '& .apexcharts-tooltip': {
                    boxShadow: 'none !important',
                    filter: 'none !important',
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
                {isLoading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pt: 2 }}>
                        {/* Y-axis area + bars skeleton */}
                        <Box sx={{ display: 'flex', flex: 1, gap: 1 }}>
                            {/* Y-axis labels */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', py: 1 }}>
                                {[...Array(5)].map((_, i) => (
                                    <Skeleton key={i} variant="text" width={40} height={16} />
                                ))}
                            </Box>
                            {/* Bars */}
                            <Box sx={{ display: 'flex', flex: 1, alignItems: 'flex-end', gap: 1, pb: 1 }}>
                                {[35, 70, 50, 80, 40, 65, 55, 75, 45, 60].slice(0, barCount).map((h, i) => (
                                    <Skeleton
                                        key={i}
                                        variant="rectangular"
                                        sx={{
                                            flex: 1,
                                            height: `${h}%`,
                                            borderRadius: '3px 3px 0 0',
                                        }}
                                    />
                                ))}
                            </Box>
                        </Box>
                        {/* X-axis labels */}
                        <Box sx={{ display: 'flex', gap: 1, pl: 6 }}>
                            {[...Array(barCount)].map((_, i) => (
                                <Skeleton key={i} variant="text" sx={{ flex: 1, height: 16 }} />
                            ))}
                        </Box>
                    </Box>
                ) : (
                    <Chart
                        key={theme.palette.mode}
                        options={chartOptions}
                        series={series}
                        type="bar"
                        height="100%"
                        width="100%"
                    />
                )}
            </Box>
        </Box>
    );
}
