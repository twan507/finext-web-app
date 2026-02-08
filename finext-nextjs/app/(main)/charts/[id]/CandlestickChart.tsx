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

interface CandlestickChartProps {
    data: ChartRawData[];
    ticker: string;
    chartType: 'candlestick' | 'line';
    showIndicators: boolean;
    showVolume: boolean;
    showLegend: boolean;
    showIndicatorsPanel: boolean;
    showWatchlistPanel: boolean;
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

// Default number of candles to show on first render
const DEFAULT_VISIBLE_BARS = 120;

export default function CandlestickChart({ data, ticker, chartType, showIndicators, showVolume, showLegend, showIndicatorsPanel, showWatchlistPanel, onCloseIndicatorsPanel, onCloseWatchlistPanel }: CandlestickChartProps) {
    const theme = useTheme();
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const ma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

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
        ma20: number | null;
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
    const ma20Color = '#2962FF';

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
        if (!data || data.length === 0) return { candles: [], volumes: [], ma20: [], lineData: [] };

        const seenTimestamps = new Set<number>();
        const candles: Array<{ time: UTCTimestamp; open: number; high: number; low: number; close: number }> = [];
        const volumes: Array<{ time: UTCTimestamp; value: number; color: string }> = [];
        const ma20: Array<{ time: UTCTimestamp; value: number }> = [];
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
            volumes.push({
                time: timestamp,
                value: item.volume || 0,
                color: isUp
                    ? (isDark ? 'rgba(38,166,154,0.35)' : 'rgba(8,153,129,0.35)')
                    : (isDark ? 'rgba(239,83,80,0.35)' : 'rgba(242,54,69,0.35)'),
            });

            if (item.ma20 != null && !isNaN(item.ma20)) {
                ma20.push({ time: timestamp, value: item.ma20 });
            }
        }

        return { candles, volumes, ma20, lineData };
    }, [data, isDark]);

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
                ma20: last.ma20,
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
        });

        // MA20 line series
        const ma20Series = chart.addSeries(LineSeries, {
            color: ma20Color,
            lineWidth: 1,
            lineType: LineType.Curved,
            priceLineVisible: false,
            lastValueVisible: true,
            crosshairMarkerVisible: false,
        });

        // Volume series
        const volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });

        chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.82, bottom: 0 },
        });

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
                        ma20: last.ma20,
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
                    ma20: rawItem.ma20,
                });
            }
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        lineSeriesRef.current = lineSeries;
        volumeSeriesRef.current = volumeSeries;
        ma20SeriesRef.current = ma20Series;

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
            ma20SeriesRef.current = null;
            hasSetInitialRangeRef.current = false;
            prevDataLengthRef.current = 0;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bgColor, textColor, gridColor, crosshairColor, upColor, downColor, isDark, ma20Color, primaryColor, lineColor]);

    // Update data when it changes - preserve pan/zoom state
    useEffect(() => {
        if (!candleSeriesRef.current || !lineSeriesRef.current || !volumeSeriesRef.current || !ma20SeriesRef.current || !chartRef.current) return;

        const { candles, volumes, ma20, lineData } = transformData();
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
        ma20SeriesRef.current.setData(ma20);

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

    // Toggle indicators (MA20) visibility
    useEffect(() => {
        if (!ma20SeriesRef.current) return;
        ma20SeriesRef.current.applyOptions({ visible: showIndicators });
    }, [showIndicators]);

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

                            {/* Row 2: Volume + MA20 */}
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('xs'),
                                        color: ma20Color,
                                        lineHeight: 1.2,
                                    }}
                                >
                                    MA 20 close 0
                                    <Box component="span" sx={{ ml: 0.5 }}>
                                        {formatNum(legendData.ma20)}
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
                                width: 300,
                                backdropFilter: 'blur(12px)',
                            },
                        }}
                    >
                        <IndicatorsPanel />
                    </Drawer>
                ) : (
                    showIndicatorsPanel && <IndicatorsPanel />
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
