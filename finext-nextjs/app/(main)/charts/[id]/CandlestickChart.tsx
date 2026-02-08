'use client';

import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import {
    createChart,
    IChartApi,
    ISeriesApi,
    CandlestickSeries,
    HistogramSeries,
    LineSeries,
    ColorType,
    CrosshairMode,
    LineStyle,
    LineType,
    UTCTimestamp,
    MouseEventParams,
} from 'lightweight-charts';
import {
    Box,
    Typography,
    useTheme,
    useMediaQuery,
    Drawer,
} from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import type { ChartRawData } from './PageContent';
import IndicatorsPanel from './IndicatorsPanel';
import WatchlistPanel from './WatchlistPanel';
import { INDICATOR_GROUPS, type AreaIndicator, type LineIndicator } from './indicatorConfig';

interface CandlestickChartProps {
    data: ChartRawData[];
    ticker: string;
    chartType: 'candlestick' | 'line';
    showIndicators: boolean;
    showVolume: boolean;
    showLegend: boolean;
    showIndicatorsPanel: boolean;
    showWatchlistPanel: boolean;
    enabledIndicators: Record<string, boolean>;
    onToggleIndicator: (key: string) => void;
    onClearAllIndicators: () => void;
    onCloseIndicatorsPanel?: () => void;
    onCloseWatchlistPanel?: () => void;
}

// Format number with locale
function formatNum(val: number | null | undefined, decimals = 2): string {
    if (val == null || isNaN(val)) return '—';
    return val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatVolume(val: number | null | undefined): string {
    if (val == null || isNaN(val)) return '—';
    if (val >= 1_000_000) return (val / 1_000_000).toFixed(2) + 'M';
    if (val >= 1_000) return (val / 1_000).toFixed(1) + 'K';
    return val.toLocaleString();
}

// Extract indicator field data from raw chart data
function extractFieldData(
    data: ChartRawData[],
    field: string,
): Array<{ time: UTCTimestamp; value: number }> {
    const result: Array<{ time: UTCTimestamp; value: number }> = [];
    const seenTimestamps = new Set<number>();
    for (const item of data) {
        if (!item.date) continue;
        const dateObj = new Date(item.date);
        const utcDate = Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
        const timestamp = Math.floor(utcDate / 1000) as UTCTimestamp;
        if (seenTimestamps.has(timestamp)) continue;
        seenTimestamps.add(timestamp);
        const value = (item as any)[field];
        if (value != null && !isNaN(value)) {
            result.push({ time: timestamp, value });
        }
    }
    return result;
}

// Default number of candles to show on first render
const DEFAULT_VISIBLE_BARS = 120;

export default function CandlestickChart({ data, ticker, chartType, showIndicators, showVolume, showLegend, showIndicatorsPanel, showWatchlistPanel, enabledIndicators, onToggleIndicator, onClearAllIndicators, onCloseIndicatorsPanel, onCloseWatchlistPanel }: CandlestickChartProps) {
    const theme = useTheme();
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const indicatorSeriesRef = useRef<Map<string, ISeriesApi<'Line'>[]>>(new Map());

    // Pan/zoom state preservation
    const savedLogicalRangeRef = useRef<{ from: number; to: number } | null>(null);
    const hasSetInitialRangeRef = useRef(false);
    const prevDataLengthRef = useRef(0);

    // Ticker name (fixed, không thay đổi khi hover)
    const [tickerName, setTickerName] = useState<string>('');

    // Legend state (OHLC data, thay đổi khi hover)
    const [legendData, setLegendData] = useState<{
        open: number | null;
        high: number | null;
        low: number | null;
        close: number | null;
        volume: number | null;
        diff: number | null;
        pctChange: number | null;
    } | null>(null);

    const isDark = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const chartColors = (theme.palette as any).component?.chart;

    const primaryColor = theme.palette.primary.main;
    const upColor = chartColors?.upColor || (isDark ? '#26a69a' : '#089981');
    const downColor = chartColors?.downColor || (isDark ? '#ef5350' : '#f23645');
    const gridColor = chartColors?.gridLine || (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)');
    const crosshairColor = chartColors?.crosshair || (isDark ? '#555' : 'rgba(0,0,0,0.3)');
    const textColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
    const bgColor = theme.palette.background.default;
    const lineColor = chartColors?.line || primaryColor;

    // Build a lookup map: timestamp -> raw data for crosshair legend
    const dataByTimestamp = useMemo(() => {
        const map = new Map<number, ChartRawData>();
        for (const item of data) {
            if (!item.date) continue;
            const dateObj = new Date(item.date);
            const utcDate = Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
            const ts = Math.floor(utcDate / 1000);
            map.set(ts, item);
        }
        return map;
    }, [data]);

    // Transform data to lightweight-charts format
    const transformData = useCallback(() => {
        if (!data || data.length === 0) return { candles: [], volumes: [], lineData: [] };

        const seenTimestamps = new Set<number>();
        const candles: Array<{ time: UTCTimestamp; open: number; high: number; low: number; close: number }> = [];
        const volumes: Array<{ time: UTCTimestamp; value: number; color: string }> = [];
        const lineData: Array<{ time: UTCTimestamp; value: number }> = [];

        for (const item of data) {
            if (!item.date || typeof item.close !== 'number' || isNaN(item.close)) continue;
            if (typeof item.open !== 'number' || isNaN(item.open)) continue;
            if (typeof item.high !== 'number' || isNaN(item.high)) continue;
            if (typeof item.low !== 'number' || isNaN(item.low)) continue;

            const dateObj = new Date(item.date);
            const utcDate = Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
            const timestamp = Math.floor(utcDate / 1000) as UTCTimestamp;

            if (seenTimestamps.has(timestamp)) continue;
            seenTimestamps.add(timestamp);

            candles.push({
                time: timestamp,
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close,
            });

            lineData.push({
                time: timestamp,
                value: item.close,
            });

            const isUp = item.close >= item.open;
            const candleColor = isUp ? upColor : downColor;
            // Parse hex to rgba with 0.35 opacity for volume
            const r = parseInt(candleColor.slice(1, 3), 16);
            const g = parseInt(candleColor.slice(3, 5), 16);
            const b = parseInt(candleColor.slice(5, 7), 16);
            volumes.push({
                time: timestamp,
                value: item.volume || 0,
                color: `rgba(${r},${g},${b},0.35)`,
            });

        }

        return { candles, volumes, lineData };
    }, [data, upColor, downColor]);

    // Set default legend to last bar
    useEffect(() => {
        if (data.length > 0) {
            const last = data[data.length - 1];
            // Set ticker name (chỉ set 1 lần, không thay đổi khi hover)
            setTickerName(last.ticker_name || ticker);
            setLegendData({
                open: last.open,
                high: last.high,
                low: last.low,
                close: last.close,
                volume: last.volume,
                diff: last.diff,
                pctChange: last.pct_change,
            });
        }
    }, [data, ticker]);

    // Create chart - only once per theme change
    useEffect(() => {
        if (!chartContainerRef.current) return;
        if (data.length === 0) return;

        const containerEl = chartContainerRef.current;

        const chart = createChart(containerEl, {
            width: containerEl.clientWidth,
            height: containerEl.clientHeight,
            layout: {
                background: { type: ColorType.Solid, color: bgColor },
                textColor,
                fontFamily: "'Inter', 'Roboto', sans-serif",
                fontSize: 11,
            },
            localization: {
                locale: 'vi-VN',
            },
            grid: {
                vertLines: { color: gridColor, style: LineStyle.Dotted },
                horzLines: { color: gridColor, style: LineStyle.Dotted },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    color: crosshairColor,
                    width: 1,
                    style: LineStyle.Dashed,
                    labelBackgroundColor: isDark ? '#333' : '#f0f0f0',
                },
                horzLine: {
                    color: crosshairColor,
                    width: 1,
                    style: LineStyle.Dashed,
                    labelBackgroundColor: isDark ? '#333' : '#f0f0f0',
                },
            },
            rightPriceScale: {
                borderColor: gridColor,
                scaleMargins: { top: 0.05, bottom: 0.2 },
            },
            timeScale: {
                borderColor: gridColor,
                timeVisible: false,
                secondsVisible: false,
                rightOffset: 5,
                barSpacing: 8,
                minBarSpacing: 2,
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: false,
            },
            handleScale: {
                axisPressedMouseMove: { time: true, price: true },
                mouseWheel: true,
                pinch: true,
            },
        });

        // Candlestick series
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor,
            downColor,
            borderDownColor: downColor,
            borderUpColor: upColor,
            wickDownColor: downColor,
            wickUpColor: upColor,
            visible: true,
            title: ticker,
        });

        // Line series for line chart mode (smooth curve)
        const lineSeries = chart.addSeries(LineSeries, {
            color: lineColor,
            lineWidth: 3,
            lineType: LineType.Curved,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4,
            crosshairMarkerBorderColor: lineColor,
            crosshairMarkerBackgroundColor: bgColor,
            priceLineVisible: true,
            lastValueVisible: true,
            visible: false,
            title: ticker,
        });

        // Volume series
        const volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });

        chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.82, bottom: 0 },
        });

        // Create all indicator series (hidden by default)
        const newIndicatorSeries = new Map<string, ISeriesApi<'Line'>[]>();
        for (const group of INDICATOR_GROUPS) {
            for (const ind of group.indicators) {
                if (ind.type === 'line') {
                    const isStep = (ind as LineIndicator).step;
                    const series = chart.addSeries(LineSeries, {
                        color: ind.color,
                        lineWidth: 1,
                        lineType: isStep ? LineType.WithSteps : LineType.Simple,
                        priceLineVisible: false,
                        lastValueVisible: true,
                        crosshairMarkerVisible: true,
                        crosshairMarkerRadius: 3,
                        visible: false,
                    });
                    newIndicatorSeries.set(ind.key, [series]);
                } else if (ind.type === 'area') {
                    // Band: upper line + middle dashed + lower line
                    const upperSeries = chart.addSeries(LineSeries, {
                        color: ind.color,
                        lineWidth: 1,
                        lineType: LineType.Simple,
                        priceLineVisible: false,
                        lastValueVisible: true,
                        crosshairMarkerVisible: false,
                        visible: false,
                    });
                    const middleSeries = chart.addSeries(LineSeries, {
                        color: ind.color,
                        lineWidth: 1,
                        lineStyle: LineStyle.Dashed,
                        lineType: LineType.Simple,
                        priceLineVisible: false,
                        lastValueVisible: true,
                        crosshairMarkerVisible: true,
                        crosshairMarkerRadius: 3,
                        visible: false,
                    });
                    const lowerSeries = chart.addSeries(LineSeries, {
                        color: ind.color,
                        lineWidth: 1,
                        lineType: LineType.Simple,
                        priceLineVisible: false,
                        lastValueVisible: true,
                        crosshairMarkerVisible: false,
                        visible: false,
                    });
                    newIndicatorSeries.set(ind.key, [upperSeries, middleSeries, lowerSeries]);
                } else if (ind.type === 'volume-line') {
                    const series = chart.addSeries(LineSeries, {
                        color: ind.color,
                        lineWidth: 1,
                        lineType: LineType.Curved,
                        priceLineVisible: false,
                        lastValueVisible: true,
                        crosshairMarkerVisible: true,
                        crosshairMarkerRadius: 3,
                        priceScaleId: 'volume',
                        visible: false,
                    });
                    newIndicatorSeries.set(ind.key, [series]);
                }
            }
        }
        indicatorSeriesRef.current = newIndicatorSeries;

        // Crosshair move -> update legend (không update tickerName)
        chart.subscribeCrosshairMove((param: MouseEventParams) => {
            if (!param.time) {
                if (data.length > 0) {
                    const last = data[data.length - 1];
                    setLegendData({
                        open: last.open,
                        high: last.high,
                        low: last.low,
                        close: last.close,
                        volume: last.volume,
                        diff: last.diff,
                        pctChange: last.pct_change,
                    });
                }
                return;
            }

            const ts = param.time as number;
            const rawItem = dataByTimestamp.get(ts);
            if (rawItem) {
                setLegendData({
                    open: rawItem.open,
                    high: rawItem.high,
                    low: rawItem.low,
                    close: rawItem.close,
                    volume: rawItem.volume,
                    diff: rawItem.diff,
                    pctChange: rawItem.pct_change,
                });
            }
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        lineSeriesRef.current = lineSeries;
        volumeSeriesRef.current = volumeSeries;

        // Resize handler
        const resizeObserver = new ResizeObserver((entries) => {
            if (entries.length > 0) {
                const { width, height } = entries[0].contentRect;
                chart.applyOptions({ width, height });
            }
        });
        resizeObserver.observe(containerEl);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
            chartRef.current = null;
            candleSeriesRef.current = null;
            lineSeriesRef.current = null;
            volumeSeriesRef.current = null;
            indicatorSeriesRef.current = new Map();
            hasSetInitialRangeRef.current = false;
            prevDataLengthRef.current = 0;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bgColor, textColor, gridColor, crosshairColor, upColor, downColor, isDark, primaryColor, lineColor]);

    // Update data when it changes - preserve pan/zoom state
    useEffect(() => {
        if (!candleSeriesRef.current || !lineSeriesRef.current || !volumeSeriesRef.current || !chartRef.current) return;

        const { candles, volumes, lineData } = transformData();
        if (candles.length === 0) return;

        // Save current visible range before updating data
        let currentRange: { from: number; to: number } | null = null;
        try {
            currentRange = chartRef.current.timeScale().getVisibleLogicalRange();
        } catch {
            // Chart may not have data yet
        }

        // Set data for all series
        candleSeriesRef.current.setData(candles);
        lineSeriesRef.current.setData(lineData);
        volumeSeriesRef.current.setData(volumes);

        // Determine visible range
        const dataLength = candles.length;
        const isDataGrowth = dataLength > prevDataLengthRef.current && prevDataLengthRef.current > 0;
        prevDataLengthRef.current = dataLength;

        if (!hasSetInitialRangeRef.current) {
            // First time: show last DEFAULT_VISIBLE_BARS candles
            const visibleBars = Math.min(DEFAULT_VISIBLE_BARS, dataLength);
            chartRef.current.timeScale().setVisibleLogicalRange({
                from: dataLength - visibleBars - 0.5,
                to: dataLength - 0.5,
            });
            hasSetInitialRangeRef.current = true;
            setTimeout(() => {
                try {
                    if (chartRef.current) {
                        savedLogicalRangeRef.current = chartRef.current.timeScale().getVisibleLogicalRange();
                    }
                } catch { /* ignore */ }
            }, 0);
        } else if (savedLogicalRangeRef.current) {
            try {
                if (isDataGrowth && currentRange) {
                    chartRef.current.timeScale().setVisibleLogicalRange(currentRange);
                } else {
                    chartRef.current.timeScale().setVisibleLogicalRange(savedLogicalRangeRef.current);
                }
            } catch {
                const visibleBars = Math.min(DEFAULT_VISIBLE_BARS, dataLength);
                chartRef.current.timeScale().setVisibleLogicalRange({
                    from: dataLength - visibleBars - 0.5,
                    to: dataLength - 0.5,
                });
            }
        } else if (currentRange) {
            chartRef.current.timeScale().setVisibleLogicalRange(currentRange);
        }

        setTimeout(() => {
            try {
                if (chartRef.current) {
                    savedLogicalRangeRef.current = chartRef.current.timeScale().getVisibleLogicalRange();
                }
            } catch { /* ignore */ }
        }, 50);
    }, [transformData]);

    // Subscribe to visible range changes to save pan/zoom state
    useEffect(() => {
        if (!chartRef.current) return;
        const chart = chartRef.current;

        const handler = () => {
            try {
                savedLogicalRangeRef.current = chart.timeScale().getVisibleLogicalRange();
            } catch { /* ignore */ }
        };

        chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
        return () => {
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
        };
    }, [bgColor]);

    // Toggle chart type visibility - EXCLUSIVE: only one visible at a time
    useEffect(() => {
        if (!chartRef.current || !candleSeriesRef.current || !lineSeriesRef.current) return;

        if (chartType === 'candlestick') {
            lineSeriesRef.current.applyOptions({ visible: false });
            candleSeriesRef.current.applyOptions({ visible: true });
        } else {
            candleSeriesRef.current.applyOptions({ visible: false });
            lineSeriesRef.current.applyOptions({ visible: true });
        }
    }, [chartType]);

    // Toggle volume visibility
    useEffect(() => {
        if (!volumeSeriesRef.current) return;
        volumeSeriesRef.current.applyOptions({ visible: showVolume });
    }, [showVolume]);

    // Sync indicator series visibility and data
    useEffect(() => {
        if (!chartRef.current || indicatorSeriesRef.current.size === 0) return;
        const seriesMap = indicatorSeriesRef.current;

        for (const group of INDICATOR_GROUPS) {
            for (const ind of group.indicators) {
                const seriesArr = seriesMap.get(ind.key);
                if (!seriesArr) continue;

                const isVisible = showIndicators && (enabledIndicators[ind.key] ?? false);

                if (isVisible) {
                    if (ind.type === 'line' || ind.type === 'volume-line') {
                        const fieldData = extractFieldData(data, (ind as any).field);
                        seriesArr[0].setData(fieldData);
                        seriesArr[0].applyOptions({ visible: true });
                    } else if (ind.type === 'area') {
                        const areaInd = ind as AreaIndicator;
                        // [0]=upper, [1]=middle(dashed), [2]=lower
                        seriesArr[0].setData(extractFieldData(data, areaInd.fields[0]));
                        seriesArr[1].setData(extractFieldData(data, areaInd.fields[1]));
                        seriesArr[2].setData(extractFieldData(data, areaInd.fields[2]));
                        seriesArr[0].applyOptions({ visible: true });
                        seriesArr[1].applyOptions({ visible: true });
                        seriesArr[2].applyOptions({ visible: true });
                    }
                } else {
                    for (const s of seriesArr) {
                        s.applyOptions({ visible: false });
                    }
                }
            }
        }
    }, [showIndicators, enabledIndicators, data]);

    // Determine color for OHLC values based on close vs open
    const isUp = legendData ? (legendData.close ?? 0) >= (legendData.open ?? 0) : true;
    const valueColor = isUp ? upColor : downColor;

    return (
        <Box
            sx={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Main Content Area with Chart and Panels */}
            <Box
                sx={{
                    display: 'flex',
                    flexGrow: 1,
                    overflow: 'hidden',
                }}
            >
                {/* Chart Area */}
                <Box
                    sx={{
                        position: 'relative',
                        flexGrow: 1,
                        overflow: 'hidden',
                    }}
                >
                    {/* TradingView-style OHLC Legend Overlay */}
                    {showLegend && legendData && tickerName && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 8,
                                left: 8,
                                right: 60,
                                zIndex: 10,
                                pointerEvents: 'none',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 0.25,
                            }}
                        >
                            {/* Row 1: Ticker name + OHLC — wraps as groups */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                {/* Group 1: Ticker name */}
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('sm'),
                                        color: 'text.primary',
                                        lineHeight: 1.4,
                                        textTransform: 'uppercase',
                                        wordBreak: 'break-word',
                                        flexBasis: '100%',
                                    }}
                                >
                                    {tickerName}
                                </Typography>
                                {/* Group 2: Timeframe + OHLC values — each pair wraps as a unit */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                    <Typography
                                        sx={{
                                            fontSize: getResponsiveFontSize('xs'),
                                            color: 'text.secondary',
                                            lineHeight: 1.2,
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        1D
                                    </Typography>
                                    <Typography
                                        sx={{
                                            fontSize: getResponsiveFontSize('xs'),
                                            color: 'text.secondary',
                                            lineHeight: 1.2,
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        O
                                        <Box component="span" sx={{ color: valueColor, ml: 0.25 }}>
                                            {formatNum(legendData.open)}
                                        </Box>
                                    </Typography>
                                    <Typography
                                        sx={{
                                            fontSize: getResponsiveFontSize('xs'),
                                            color: 'text.secondary',
                                            lineHeight: 1.2,
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        H
                                        <Box component="span" sx={{ color: valueColor, ml: 0.25 }}>
                                            {formatNum(legendData.high)}
                                        </Box>
                                    </Typography>
                                    <Typography
                                        sx={{
                                            fontSize: getResponsiveFontSize('xs'),
                                            color: 'text.secondary',
                                            lineHeight: 1.2,
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        L
                                        <Box component="span" sx={{ color: valueColor, ml: 0.25 }}>
                                            {formatNum(legendData.low)}
                                        </Box>
                                    </Typography>
                                    <Typography
                                        sx={{
                                            fontSize: getResponsiveFontSize('xs'),
                                            color: 'text.secondary',
                                            lineHeight: 1.2,
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        C
                                        <Box component="span" sx={{ color: valueColor, ml: 0.25 }}>
                                            {formatNum(legendData.close)}
                                        </Box>
                                    </Typography>
                                    <Typography
                                        sx={{
                                            fontSize: getResponsiveFontSize('xs'),
                                            color: valueColor,
                                            fontWeight: fontWeight.semibold,
                                            lineHeight: 1.2,
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {legendData.diff != null ? (legendData.diff >= 0 ? '+' : '') + formatNum(legendData.diff) : ''}
                                        {legendData.pctChange != null
                                            ? ` (${legendData.pctChange >= 0 ? '+' : ''}${formatNum(legendData.pctChange)}%)`
                                            : ''}
                                    </Typography>
                                </Box>
                            </Box>

                            {/* Row 2: Volume */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('xs'),
                                        color: 'text.secondary',
                                        lineHeight: 1.2,
                                    }}
                                >
                                    Volume
                                    <Box component="span" sx={{ color: valueColor, ml: 0.5 }}>
                                        {formatVolume(legendData.volume)}
                                    </Box>
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {/* Chart container */}
                    <Box
                        ref={chartContainerRef}
                        sx={{
                            width: '100%',
                            height: '100%',
                        }}
                    />
                </Box>

                {/* Indicators Panel - Drawer on mobile, inline on desktop */}
                {isMobile ? (
                    <Drawer
                        anchor="right"
                        open={showIndicatorsPanel}
                        onClose={onCloseIndicatorsPanel}
                        variant="temporary"
                        elevation={0}
                        ModalProps={{ keepMounted: true }}
                        sx={{
                            '& .MuiDrawer-paper': {
                                width: 280,
                                backdropFilter: 'blur(12px)',
                            },
                        }}
                    >
                        <IndicatorsPanel enabledIndicators={enabledIndicators} onToggleIndicator={onToggleIndicator} onClearAll={onClearAllIndicators} />
                    </Drawer>
                ) : (
                    showIndicatorsPanel && <IndicatorsPanel enabledIndicators={enabledIndicators} onToggleIndicator={onToggleIndicator} onClearAll={onClearAllIndicators} />
                )}

                {/* Watchlist Panel - Drawer on mobile, inline on desktop */}
                {isMobile ? (
                    <Drawer
                        anchor="right"
                        open={showWatchlistPanel}
                        onClose={onCloseWatchlistPanel}
                        variant="temporary"
                        elevation={0}
                        ModalProps={{ keepMounted: true }}
                        sx={{
                            '& .MuiDrawer-paper': {
                                width: 300,
                                backdropFilter: 'blur(12px)',
                            },
                        }}
                    >
                        <WatchlistPanel />
                    </Drawer>
                ) : (
                    showWatchlistPanel && <WatchlistPanel />
                )}
            </Box>
        </Box>
    );
}
