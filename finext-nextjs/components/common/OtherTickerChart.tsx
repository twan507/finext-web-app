'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
    createChart,
    IChartApi,
    ISeriesApi,
    AreaSeries,
    CandlestickSeries,
    LineSeries,
    ColorType,
    CrosshairMode,
    LineStyle,
    UTCTimestamp,
    OhlcData,
    SingleValueData,
    Time,
} from 'lightweight-charts';
import {
    Box,
    Typography,
    ToggleButton,
    ToggleButtonGroup,
    Stack,
    Chip,
    useTheme,
    Skeleton,
} from '@mui/material';
import TimeframeSelector from 'components/common/TimeframeSelector';
import PanZoomToggle from 'components/common/PanZoomToggle';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart';
import { getResponsiveFontSize, fontWeight, getGlassCard } from 'theme/tokens';
import { apiClient } from 'services/apiClient';

export type OtherChartTimeRange = '1M' | '3M' | '1Y' | 'ALL';
type ChartType = 'area' | 'candlestick';

interface HistoricalPoint {
    date: string;
    name: string;
    open: number;
    high: number;
    low: number;
    close: number;
    pct_change?: number;
}

interface PriceData { time: UTCTimestamp; value: number; }
interface CandleData { time: UTCTimestamp; open: number; high: number; low: number; close: number; }

// Multi-line: mỗi name là 1 series
interface MultiLineSeriesData {
    name: string;
    data: PriceData[];
    lastClose: number;
    pctChange: number;
    priceChange: number;
}

export interface OtherTickerChartProps {
    ticker: string;
    name?: string;
    chartMode?: string; // "line" | "candle" etc. from DB's `chart` field
    height?: number;
}

// Palette for multi-line series
const LINE_COLORS = [
    '#2196F3', '#FF9800', '#4CAF50', '#E91E63', '#9C27B0',
    '#00BCD4', '#FF5722', '#795548', '#607D8B', '#3F51B5',
];

const dateToTimestamp = (dateStr: string): UTCTimestamp => {
    const d = new Date(dateStr);
    const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.floor(utc / 1000) as UTCTimestamp;
};

const getChangeColor = (pctChange: number, theme: any): string => {
    if (Math.abs(pctChange) <= 0.005) return theme.palette.trend.ref;
    return pctChange > 0 ? theme.palette.trend.up : theme.palette.trend.down;
};

const getArrow = (pctChange: number): string => {
    if (Math.abs(pctChange) <= 0.005) return '';
    return pctChange > 0 ? '▲' : '▼';
};

const getVisibleRange = (timeRange: OtherChartTimeRange, dataLength: number) => {
    let pointsToShow: number;
    switch (timeRange) {
        case '1M': pointsToShow = 22; break;
        case '3M': pointsToShow = 66; break;
        case '1Y': pointsToShow = 252; break;
        default: pointsToShow = dataLength; break;
    }
    const visible = Math.min(pointsToShow, dataLength);
    return { from: dataLength - visible - 0.5, to: dataLength - 0.5 };
};

export default function OtherTickerChart({ ticker, name, chartMode, height = 345 }: OtherTickerChartProps) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';

    const isMultiLine = chartMode === 'line';

    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Area'> | ISeriesApi<'Candlestick'> | null>(null);
    const multiSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);

    const [timeRange, setTimeRange] = useState<OtherChartTimeRange>('3M');
    const [chartType, setChartType] = useState<ChartType>('area');
    const [isLoading, setIsLoading] = useState(true);

    // Single mode data
    const [areaData, setAreaData] = useState<PriceData[]>([]);
    const [candleData, setCandleData] = useState<CandleData[]>([]);

    // Multi-line mode data
    const [multiLineData, setMultiLineData] = useState<MultiLineSeriesData[]>([]);

    const [currentPrice, setCurrentPrice] = useState(0);
    const [priceChange, setPriceChange] = useState(0);
    const [percentChange, setPercentChange] = useState(0);

    const [panZoomEnabled, setPanZoomEnabled] = useState(false);
    const savedLogicalRangeRef = useRef<{ from: number; to: number } | null>(null);
    const hasSetInitialRangeRef = useRef(false);

    const [tooltipData, setTooltipData] = useState<{
        visible: boolean; x: number; y: number;
        time: string; price: number;
        open?: number; high?: number; low?: number; close?: number;
        lines?: { name: string; value: number; color: string }[];
    } | null>(null);

    const prevTimeRangeRef = useRef<OtherChartTimeRange>(timeRange);
    const prevChartTypeRef = useRef<ChartType>(chartType);

    const colors = useMemo(() => ({
        chartBackground: theme.palette.background.paper,
        containerBackground: theme.palette.background.default,
        textPrimary: theme.palette.text.primary,
        textSecondary: theme.palette.text.secondary,
        line: theme.palette.component.chart.line,
        areaTop: theme.palette.component.chart.areaTop,
        areaBottom: theme.palette.component.chart.areaBottom,
        upColor: theme.palette.component.chart.upColor,
        downColor: theme.palette.component.chart.downColor,
        gridColor: theme.palette.component.chart.gridLine,
        crosshairColor: theme.palette.component.chart.crosshair,
        buttonBackground: theme.palette.component.chart.buttonBackground,
        buttonBackgroundActive: theme.palette.component.chart.buttonBackgroundActive,
        buttonText: theme.palette.component.chart.buttonText,
        borderColor: theme.palette.divider,
    }), [theme]);

    // ========== Fetch ALL data once per ticker ==========
    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        hasSetInitialRangeRef.current = false;

        apiClient<HistoricalPoint[]>({
            url: '/api/v1/sse/rest/other_ticker',
            method: 'GET',
            queryParams: { ticker, limit: 2000, sort_by: 'date', sort_order: 'desc' },
            requireAuth: false,
        })
            .then((res) => {
                if (cancelled) return;
                const raw = res.data ?? [];
                const sorted = [...raw].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                if (isMultiLine) {
                    // ========== Multi-line: group by name ==========
                    const groups = new Map<string, HistoricalPoint[]>();
                    for (const item of sorted) {
                        if (typeof item.close !== 'number' || isNaN(item.close)) continue;
                        const key = item.name || ticker;
                        if (!groups.has(key)) groups.set(key, []);
                        groups.get(key)!.push(item);
                    }

                    const seriesDataArr: MultiLineSeriesData[] = [];
                    Array.from(groups.entries()).forEach(([seriesName, points]) => {
                        const seen = new Set<number>();
                        const lineData: PriceData[] = [];
                        for (const p of points) {
                            const ts = dateToTimestamp(p.date);
                            if (seen.has(ts)) continue;
                            seen.add(ts);
                            lineData.push({ time: ts, value: p.close });
                        }
                        if (lineData.length === 0) return;

                        const lastClose = lineData[lineData.length - 1].value;
                        const lastRaw = points[points.length - 1];
                        let pctChange = 0;
                        let priceDiff = 0;

                        if (lastRaw?.pct_change != null && lastRaw.pct_change !== 0) {
                            pctChange = parseFloat((lastRaw.pct_change * 100).toFixed(2));
                            const prevClose = lastClose / (1 + lastRaw.pct_change);
                            priceDiff = parseFloat((lastClose - prevClose).toFixed(2));
                        } else if (lineData.length >= 2) {
                            const prevClose = lineData[lineData.length - 2].value;
                            priceDiff = parseFloat((lastClose - prevClose).toFixed(2));
                            pctChange = prevClose !== 0 ? parseFloat(((priceDiff / prevClose) * 100).toFixed(2)) : 0;
                        }

                        seriesDataArr.push({
                            name: seriesName,
                            data: lineData,
                            lastClose,
                            pctChange,
                            priceChange: priceDiff,
                        });
                    });

                    setMultiLineData(seriesDataArr);

                    // Set header info from the selected name or first series
                    const target = seriesDataArr.find(s => s.name === name) || seriesDataArr[0];
                    if (target) {
                        setCurrentPrice(target.lastClose);
                        setPriceChange(target.priceChange);
                        setPercentChange(target.pctChange);
                    }
                } else {
                    // ========== Single mode: area/candlestick ==========
                    const seen = new Set<number>();
                    const area: PriceData[] = [];
                    const candle: CandleData[] = [];

                    for (const item of sorted) {
                        if (typeof item.close !== 'number' || isNaN(item.close)) continue;
                        const ts = dateToTimestamp(item.date);
                        if (seen.has(ts)) continue;
                        seen.add(ts);

                        area.push({ time: ts, value: item.close });
                        candle.push({
                            time: ts,
                            open: item.open ?? item.close,
                            high: item.high ?? item.close,
                            low: item.low ?? item.close,
                            close: item.close,
                        });
                    }

                    setAreaData(area);
                    setCandleData(candle);

                    if (area.length > 0) {
                        const lastClose = area[area.length - 1].value;
                        setCurrentPrice(lastClose);

                        const lastRaw = sorted[sorted.length - 1];
                        if (lastRaw?.pct_change != null && lastRaw.pct_change !== 0) {
                            const pct = lastRaw.pct_change * 100;
                            setPercentChange(parseFloat(pct.toFixed(2)));
                            const prevClose = lastClose / (1 + lastRaw.pct_change);
                            setPriceChange(parseFloat((lastClose - prevClose).toFixed(2)));
                        } else if (area.length >= 2) {
                            const prevClose = area[area.length - 2].value;
                            const diff = lastClose - prevClose;
                            const pct = prevClose !== 0 ? (diff / prevClose) * 100 : 0;
                            setPriceChange(parseFloat(diff.toFixed(2)));
                            setPercentChange(parseFloat(pct.toFixed(2)));
                        } else {
                            setPriceChange(0);
                            setPercentChange(0);
                        }
                    }
                }

                setIsLoading(false);
            })
            .catch(() => { if (!cancelled) setIsLoading(false); });

        return () => { cancelled = true; };
    }, [ticker, isMultiLine, name]);

    // ========== Init chart ==========
    const initChart = useCallback(() => {
        if (!chartContainerRef.current) return;
        if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; seriesRef.current = null; multiSeriesRef.current = []; }

        const chart = createChart(chartContainerRef.current, {
            layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: colors.textSecondary },
            grid: {
                vertLines: { color: colors.gridColor, style: LineStyle.Solid },
                horzLines: { color: colors.gridColor, style: LineStyle.Solid },
            },
            width: chartContainerRef.current.clientWidth,
            height,
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: { color: colors.crosshairColor, width: 1, style: LineStyle.Dashed },
                horzLine: { color: colors.crosshairColor, width: 1, style: LineStyle.Dashed },
            },
            rightPriceScale: {
                borderColor: colors.borderColor,
                scaleMargins: { top: 0.1, bottom: 0.1 },
            },
            localization: { locale: 'vi-VN' },
            timeScale: { borderColor: colors.borderColor, timeVisible: false, secondsVisible: false },
            handleScroll: { mouseWheel: false, pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
            handleScale: { axisPressedMouseMove: false, mouseWheel: false, pinch: false },
        });

        chartRef.current = chart;

        // Crosshair tooltip
        chart.subscribeCrosshairMove((param) => {
            if (!param.time || !param.point || !chartContainerRef.current) {
                setTooltipData(null); return;
            }

            const ts = param.time as number;
            const date = new Date(ts * 1000);
            const dd = date.getUTCDate().toString().padStart(2, '0');
            const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
            const yyyy = date.getUTCFullYear();
            const timeStr = `${dd}/${mm}/${yyyy}`;

            if (isMultiLine && multiSeriesRef.current.length > 0) {
                // Multi-line tooltip
                const lines: { name: string; value: number; color: string }[] = [];
                let y = param.point.y;
                multiSeriesRef.current.forEach((series, idx) => {
                    const seriesData = param.seriesData.get(series);
                    if (seriesData && 'value' in seriesData) {
                        const val = (seriesData as SingleValueData<Time>).value;
                        lines.push({
                            name: multiLineData[idx]?.name || `Series ${idx + 1}`,
                            value: val,
                            color: LINE_COLORS[idx % LINE_COLORS.length],
                        });
                        const coord = series.priceToCoordinate(val);
                        if (coord !== null) y = coord;
                    }
                });
                if (lines.length === 0) { setTooltipData(null); return; }
                setTooltipData({ visible: true, x: param.point.x, y, time: timeStr, price: lines[0].value, lines });
            } else if (seriesRef.current) {
                // Single series tooltip
                const seriesData = param.seriesData.get(seriesRef.current);
                if (!seriesData) { setTooltipData(null); return; }

                const isArea = 'value' in seriesData;
                let price: number;
                if (isArea) { price = (seriesData as SingleValueData<Time>).value; }
                else { price = (seriesData as OhlcData<Time>).close; }

                const coordinate = seriesRef.current.priceToCoordinate(price);
                if (coordinate === null) { setTooltipData(null); return; }

                if (isArea) {
                    setTooltipData({ visible: true, x: param.point.x, y: coordinate, time: timeStr, price });
                } else {
                    const ohlc = seriesData as OhlcData<Time>;
                    setTooltipData({
                        visible: true, x: param.point.x, y: coordinate, time: timeStr,
                        price: ohlc.close, open: ohlc.open, high: ohlc.high, low: ohlc.low, close: ohlc.close,
                    });
                }
            }
        });

        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);
        return () => { window.removeEventListener('resize', handleResize); };
    }, [height, colors, isMultiLine, multiLineData]);

    // ========== Render chart ==========
    useEffect(() => {
        if (isLoading) return;
        if (!chartRef.current && chartContainerRef.current) { initChart(); }
        if (!chartRef.current) return;

        const chart = chartRef.current;

        // Clean old series
        if (seriesRef.current) { chart.removeSeries(seriesRef.current); seriesRef.current = null; }
        multiSeriesRef.current.forEach(s => { try { chart.removeSeries(s); } catch {} });
        multiSeriesRef.current = [];

        if (isMultiLine) {
            // ========== Multi-line ==========
            let maxDataLen = 0;
            multiLineData.forEach((series, idx) => {
                const color = LINE_COLORS[idx % LINE_COLORS.length];
                const lineSeries = chart.addSeries(LineSeries, {
                    color,
                    lineWidth: 2,
                    crosshairMarkerVisible: true,
                    crosshairMarkerRadius: 4,
                    crosshairMarkerBorderColor: color,
                    crosshairMarkerBackgroundColor: colors.chartBackground,
                    title: series.name,
                    priceScaleId: idx === 0 ? 'right' : `line_${idx}`,
                });
                lineSeries.setData(series.data);
                multiSeriesRef.current.push(lineSeries);

                if (series.data.length > maxDataLen) maxDataLen = series.data.length;

                // Hide extra price scales (only show right = first series)
                if (idx > 0) {
                    chart.priceScale(`line_${idx}`).applyOptions({ visible: false });
                }
            });

            // Set visible range
            if (maxDataLen > 0) {
                const range = getVisibleRange(timeRange, maxDataLen);
                chart.timeScale().setVisibleLogicalRange(range);
                hasSetInitialRangeRef.current = true;
            }
        } else {
            // ========== Single series (area / candlestick) ==========
            const dataLength = chartType === 'area' ? areaData.length : candleData.length;
            if (dataLength === 0) return;

            if (chartType === 'area') {
                seriesRef.current = chart.addSeries(AreaSeries, {
                    lineColor: colors.line,
                    topColor: colors.areaTop,
                    bottomColor: colors.areaBottom,
                    lineWidth: 2,
                    crosshairMarkerVisible: true,
                    crosshairMarkerRadius: 4,
                    crosshairMarkerBorderColor: colors.line,
                    crosshairMarkerBackgroundColor: colors.chartBackground,
                });
                (seriesRef.current as ISeriesApi<'Area'>).setData(areaData);
            } else {
                seriesRef.current = chart.addSeries(CandlestickSeries, {
                    upColor: colors.upColor,
                    downColor: colors.downColor,
                    borderVisible: false,
                    wickUpColor: colors.upColor,
                    wickDownColor: colors.downColor,
                });
                (seriesRef.current as ISeriesApi<'Candlestick'>).setData(candleData);
            }

            const range = getVisibleRange(timeRange, dataLength);
            chart.timeScale().setVisibleLogicalRange(range);
            hasSetInitialRangeRef.current = true;
        }
    }, [isLoading, initChart, isMultiLine, multiLineData, chartType, areaData, candleData, timeRange, colors]);

    // Update visible range when timeRange changes
    useEffect(() => {
        if (!chartRef.current || !hasSetInitialRangeRef.current) return;
        if (prevTimeRangeRef.current === timeRange) return;
        prevTimeRangeRef.current = timeRange;

        let dataLength: number;
        if (isMultiLine) {
            dataLength = Math.max(...multiLineData.map(s => s.data.length), 0);
        } else {
            dataLength = chartType === 'area' ? areaData.length : candleData.length;
        }
        if (dataLength > 0 && !panZoomEnabled) {
            const range = getVisibleRange(timeRange, dataLength);
            chartRef.current.timeScale().setVisibleLogicalRange(range);
        }
    }, [timeRange, isMultiLine, multiLineData, chartType, areaData, candleData, panZoomEnabled]);

    // ========== Update colors on theme change ==========
    useEffect(() => {
        if (!chartRef.current) return;
        chartRef.current.applyOptions({
            layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: colors.textSecondary },
            grid: { vertLines: { color: colors.gridColor, style: LineStyle.Solid }, horzLines: { color: colors.gridColor, style: LineStyle.Solid } },
            crosshair: {
                vertLine: { color: colors.crosshairColor, width: 1, style: LineStyle.Dashed },
                horzLine: { color: colors.crosshairColor, width: 1, style: LineStyle.Dashed },
            },
            rightPriceScale: { borderColor: colors.borderColor },
            timeScale: { borderColor: colors.borderColor },
        });
        if (!isMultiLine && seriesRef.current) {
            if (chartType === 'area') {
                (seriesRef.current as ISeriesApi<'Area'>).applyOptions({
                    lineColor: colors.line, topColor: colors.areaTop, bottomColor: colors.areaBottom,
                    crosshairMarkerBorderColor: colors.line, crosshairMarkerBackgroundColor: colors.chartBackground,
                });
            } else {
                (seriesRef.current as ISeriesApi<'Candlestick'>).applyOptions({
                    upColor: colors.upColor, downColor: colors.downColor,
                    wickUpColor: colors.upColor, wickDownColor: colors.downColor,
                });
            }
        }
    }, [colors, chartType, isMultiLine]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; seriesRef.current = null; multiSeriesRef.current = []; hasSetInitialRangeRef.current = false; }
        };
    }, []);

    // Reset pan/zoom when timeRange changes
    useEffect(() => {
        if (panZoomEnabled) {
            setPanZoomEnabled(false);
            if (chartRef.current) {
                chartRef.current.applyOptions({
                    handleScroll: { mouseWheel: false, pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
                    handleScale: { axisPressedMouseMove: false, mouseWheel: false, pinch: false },
                });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeRange]);

    useEffect(() => { if (!panZoomEnabled) savedLogicalRangeRef.current = null; }, [panZoomEnabled]);

    const handleTogglePanZoom = useCallback(() => {
        setPanZoomEnabled(prev => {
            const next = !prev;
            if (chartRef.current) {
                chartRef.current.applyOptions({
                    handleScroll: { mouseWheel: next, pressedMouseMove: next, horzTouchDrag: next, vertTouchDrag: next },
                    handleScale: { axisPressedMouseMove: next, mouseWheel: next, pinch: next },
                });
                if (!next) {
                    let dataLength: number;
                    if (isMultiLine) {
                        dataLength = Math.max(...multiLineData.map(s => s.data.length), 0);
                    } else {
                        dataLength = chartType === 'area' ? areaData.length : candleData.length;
                    }
                    if (dataLength > 0) {
                        const range = getVisibleRange(timeRange, dataLength);
                        chartRef.current.timeScale().setVisibleLogicalRange(range);
                    }
                    chartRef.current.priceScale('right').applyOptions({ autoScale: true });
                }
            }
            return next;
        });
    }, [timeRange, chartType, areaData, candleData, isMultiLine, multiLineData]);

    const handleTimeRangeChange = (_e: React.MouseEvent<HTMLElement>, val: OtherChartTimeRange | null) => {
        if (val) setTimeRange(val);
    };

    const handleChartTypeChange = (type: ChartType) => { setChartType(type); };

    const changeColor = getChangeColor(percentChange, theme);
    const arrow = getArrow(percentChange);
    const isPositive = priceChange >= 0;

    const headerHeight = 78;
    const controlsHeight = 48;
    const totalHeight = headerHeight + controlsHeight + height;

    return (
        <Box sx={{ width: '100%', minHeight: totalHeight }}>
            {/* ========== Header ========== */}
            <Box sx={{ mb: 2, height: headerHeight }}>
                {isLoading ? (
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box sx={{ width: 120, height: 32, bgcolor: colors.buttonBackground, borderRadius: 1 }} />
                        <Box sx={{ width: 60, height: 24, bgcolor: colors.buttonBackground, borderRadius: 1 }} />
                        <Box sx={{ width: 80, height: 24, bgcolor: colors.buttonBackground, borderRadius: 2 }} />
                    </Stack>
                ) : (
                    <>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Typography variant="h4" sx={{ fontWeight: fontWeight.bold, color: colors.textPrimary, fontSize: getResponsiveFontSize('h3') }}>
                                {currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Typography>
                            <Typography sx={{ color: changeColor, fontWeight: fontWeight.bold, fontSize: getResponsiveFontSize('lg') }}>
                                {priceChange !== 0 && Math.abs(percentChange) > 0.005 ? (isPositive ? '+' : '-') : ''}
                                {Math.abs(priceChange).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Typography>
                            <Chip
                                label={`${arrow}${arrow ? ' ' : ''}${Math.abs(percentChange).toFixed(2)}%`}
                                size="small"
                                sx={{
                                    backgroundColor: changeColor,
                                    color: '#ffffff',
                                    fontWeight: fontWeight.bold,
                                    fontSize: getResponsiveFontSize('md'),
                                    height: 24,
                                }}
                            />
                        </Stack>
                        <Typography sx={{ color: colors.textSecondary, fontSize: getResponsiveFontSize('md'), mt: 0.5 }}>
                            {name || ticker}
                        </Typography>
                    </>
                )}
            </Box>

            {/* ========== Controls ========== */}
            <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                useFlexGap
                flexWrap="wrap"
                spacing={2}
                sx={{ mb: 2, minHeight: controlsHeight }}
            >
                <TimeframeSelector
                    value={timeRange}
                    onChange={handleTimeRangeChange}
                    options={['1M', '3M', '1Y', 'ALL']}
                />

                <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" sx={{ flexGrow: { xs: 1, sm: 0 } }}>
                    {/* Chart type toggle — chỉ hiện khi KHÔNG phải multi-line */}
                    {!isMultiLine && (
                        <ToggleButtonGroup
                            value={chartType}
                            exclusive
                            onChange={(_event, newType) => { if (newType !== null) handleChartTypeChange(newType); }}
                            size="small"
                            sx={{
                                borderRadius: 2,
                                overflow: 'hidden',
                                ...(() => {
                                    const g = getGlassCard(isDarkMode);
                                    return { background: g.background, backdropFilter: g.backdropFilter, WebkitBackdropFilter: g.WebkitBackdropFilter, border: g.border };
                                })(),
                                '& .MuiToggleButton-root': {
                                    color: colors.buttonText, border: 'none', height: 34,
                                    px: { xs: 1, sm: 1.5 }, backgroundColor: 'transparent',
                                    position: 'relative', borderRadius: '0 !important', transition: 'color 0.2s',
                                    '&::after': {
                                        content: '""', position: 'absolute', bottom: 4, left: '50%',
                                        transform: 'translateX(-50%)', width: '60%', height: '2px',
                                        backgroundColor: 'transparent', borderRadius: '1px', transition: 'background-color 0.2s',
                                    },
                                    '&:hover': { backgroundColor: 'transparent' },
                                    '&.Mui-selected': {
                                        backgroundColor: 'transparent', color: colors.buttonBackgroundActive,
                                        '&::after': { backgroundColor: colors.buttonBackgroundActive },
                                    },
                                },
                            }}
                        >
                            <ToggleButton value="area"><ShowChartIcon fontSize="small" /></ToggleButton>
                            <ToggleButton value="candlestick"><CandlestickChartIcon fontSize="small" /></ToggleButton>
                        </ToggleButtonGroup>
                    )}

                    <PanZoomToggle enabled={panZoomEnabled} onClick={handleTogglePanZoom} />
                </Stack>
            </Stack>

            {/* ========== Multi-line Legend ========== */}
            {isMultiLine && multiLineData.length > 1 && (
                <Stack direction="row" flexWrap="wrap" spacing={2} sx={{ mb: 1.5 }}>
                    {multiLineData.map((series, idx) => (
                        <Stack key={series.name} direction="row" alignItems="center" spacing={0.5}>
                            <Box sx={{ width: 12, height: 3, borderRadius: 1, bgcolor: LINE_COLORS[idx % LINE_COLORS.length] }} />
                            <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.textSecondary }}>
                                {series.name}
                            </Typography>
                        </Stack>
                    ))}
                </Stack>
            )}

            {/* ========== Chart container ========== */}
            <Box
                onMouseLeave={() => setTooltipData(null)}
                sx={{ width: '100%', height, borderRadius: 1, overflow: 'hidden', position: 'relative' }}
            >
                {isLoading && (
                    <Box sx={{
                        position: 'absolute', inset: 0, zIndex: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: 'background.default',
                    }}>
                        <Skeleton variant="rectangular" width="100%" height="100%" sx={{ borderRadius: 1 }} />
                    </Box>
                )}

                <Box ref={chartContainerRef} sx={{ width: '100%', height: '100%' }} />

                {/* Tooltip */}
                {tooltipData?.visible && (
                    <Box
                        sx={{
                            position: 'absolute',
                            left: tooltipData.x + 15,
                            top: tooltipData.y - 30,
                            backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                            border: 'none',
                            borderRadius: 1.5,
                            padding: '6px 10px',
                            pointerEvents: 'none',
                            zIndex: 10,
                            transform: tooltipData.x > (chartContainerRef.current?.clientWidth || 0) - 150
                                ? 'translateX(-100%) translateX(-30px)'
                                : 'none',
                        }}
                    >
                        <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.textSecondary, mb: 0.5, fontWeight: fontWeight.medium }}>
                            {tooltipData.time}
                        </Typography>

                        {tooltipData.lines ? (
                            // Multi-line tooltip
                            <Box>
                                {tooltipData.lines.map((line) => (
                                    <Stack key={line.name} direction="row" spacing={1} alignItems="center">
                                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: line.color, flexShrink: 0 }} />
                                        <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.textSecondary, minWidth: 40 }}>
                                            {line.name}:
                                        </Typography>
                                        <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.textPrimary, fontWeight: fontWeight.medium }}>
                                            {line.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </Typography>
                                    </Stack>
                                ))}
                            </Box>
                        ) : tooltipData.open !== undefined ? (
                            // Candlestick tooltip
                            <Box>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.textSecondary, minWidth: 20 }}>O:</Typography>
                                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.textPrimary, fontWeight: fontWeight.medium }}>
                                        {tooltipData.open?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.textSecondary, minWidth: 20 }}>H:</Typography>
                                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.upColor, fontWeight: fontWeight.medium }}>
                                        {tooltipData.high?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.textSecondary, minWidth: 20 }}>L:</Typography>
                                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.downColor, fontWeight: fontWeight.medium }}>
                                        {tooltipData.low?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.textSecondary, minWidth: 20 }}>C:</Typography>
                                    <Typography sx={{
                                        fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.medium,
                                        color: (tooltipData.close ?? 0) >= (tooltipData.open ?? 0) ? colors.upColor : colors.downColor,
                                    }}>
                                        {tooltipData.close?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Typography>
                                </Stack>
                            </Box>
                        ) : (
                            // Area tooltip
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.textSecondary }}>Giá:</Typography>
                                <Typography sx={{ fontSize: getResponsiveFontSize('md'), color: colors.line, fontWeight: fontWeight.medium }}>
                                    {tooltipData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Typography>
                            </Stack>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
}
