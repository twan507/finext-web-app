'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
    createChart,
    IChartApi,
    ISeriesApi,
    AreaSeries,
    LineSeries,
    ColorType,
    CrosshairMode,
    LineStyle,
    UTCTimestamp,
    SingleValueData,
    Time,
} from 'lightweight-charts';
import {
    Box,
    Typography,
    Stack,
    Chip,
    useTheme,
    Skeleton,
} from '@mui/material';
import TimeframeSelector from 'components/common/TimeframeSelector';
import PanZoomToggle from 'components/common/PanZoomToggle';
import DotLoading from 'components/common/DotLoading';
import { getResponsiveFontSize, fontWeight, getGlassCard } from 'theme/tokens';
import { apiClient } from 'services/apiClient';

export type OtherChartTimeRange = '1W' | '1M' | '3M' | '1Y';

interface HistoricalPoint {
    date: string;
    name: string;
    close: number;
    pct_change?: number;
    w_pct?: number | null;
    m_pct?: number | null;
    q_pct?: number | null;
    y_pct?: number | null;
    cat_order?: number;
}

const getPctByTimeRange = (record: HistoricalPoint, timeRange: OtherChartTimeRange): number => {
    let raw: number | null | undefined;
    switch (timeRange) {
        case '1W': raw = record.w_pct; break;
        case '1M': raw = record.m_pct; break;
        case '3M': raw = record.q_pct; break;
        case '1Y': raw = record.y_pct; break;
    }
    if (raw != null && !isNaN(raw)) return parseFloat((raw * 100).toFixed(2));
    // fallback to pct_change
    if (record.pct_change != null && !isNaN(record.pct_change)) return parseFloat((record.pct_change * 100).toFixed(2));
    return 0;
};

interface PriceData { time: UTCTimestamp; value: number; }

// Multi-line: mỗi name là 1 series
interface MultiLineSeriesData {
    name: string;
    data: PriceData[];
    lastClose: number;
    pctChange: number;
    priceChange: number;
    catOrder: number;
}

export interface OtherTickerChartProps {
    ticker: string;
    name?: string;
    chartMode?: string; // "line" | "candle" etc. from DB's `chart` field
    unit?: string;
    height?: number;
    defaultTimeRange?: OtherChartTimeRange;
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
        case '1W': pointsToShow = 5; break;
        case '1M': pointsToShow = 22; break;
        case '3M': pointsToShow = 66; break;
        case '1Y': pointsToShow = 252; break;
        default: pointsToShow = dataLength; break;
    }
    const visible = Math.min(pointsToShow, dataLength);
    return { from: dataLength - visible - 0.5, to: dataLength - 0.5 };
};

export default function OtherTickerChart({ ticker, name, chartMode, unit, height = 345, defaultTimeRange = '3M' }: OtherTickerChartProps) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';

    const isMultiLine = chartMode === 'line';
    const isPercentUnit = unit === '%';
    const unitMultiplier = isPercentUnit ? 100 : 1;

    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
    const multiSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);

    const [timeRange, setTimeRange] = useState<OtherChartTimeRange>(defaultTimeRange);
    const [isLoading, setIsLoading] = useState(true);

    // Single mode data
    const [areaData, setAreaData] = useState<PriceData[]>([]);

    // Multi-line mode data
    const [multiLineData, setMultiLineData] = useState<MultiLineSeriesData[]>([]);

    const [currentPrice, setCurrentPrice] = useState(0);
    const [priceChange, setPriceChange] = useState(0);
    const [percentChange, setPercentChange] = useState(0);

    // Store last raw record for dynamic pct lookup
    const lastRawRecordRef = useRef<HistoricalPoint | null>(null);
    // Multi-line: store last raw records per series
    const multiLastRawRef = useRef<Map<string, HistoricalPoint>>(new Map());

    const [panZoomEnabled, setPanZoomEnabled] = useState(false);
    const savedLogicalRangeRef = useRef<{ from: number; to: number } | null>(null);
    const hasSetInitialRangeRef = useRef(false);

    const [tooltipData, setTooltipData] = useState<{
        visible: boolean; x: number; y: number;
        time: string; price: number;
        lines?: { name: string; value: number; color: string }[];
    } | null>(null);

    const prevTimeRangeRef = useRef<OtherChartTimeRange>(timeRange);

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

                    const rawMap = new Map<string, HistoricalPoint>();
                    const seriesDataArr: MultiLineSeriesData[] = [];
                    Array.from(groups.entries()).forEach(([seriesName, points]) => {
                        const seen = new Set<number>();
                        const lineData: PriceData[] = [];
                        for (const p of points) {
                            const ts = dateToTimestamp(p.date);
                            if (seen.has(ts)) continue;
                            seen.add(ts);
                            lineData.push({ time: ts, value: p.close * unitMultiplier });
                        }
                        if (lineData.length === 0) return;

                        const lastClose = lineData[lineData.length - 1].value;
                        const lastRaw = points[points.length - 1];
                        rawMap.set(seriesName, lastRaw);
                        const pctChange = getPctByTimeRange(lastRaw, timeRange);
                        const priceDiff = pctChange !== 0 ? parseFloat((lastClose - lastClose / (1 + pctChange / 100)).toFixed(2)) : 0;

                        seriesDataArr.push({
                            name: seriesName,
                            data: lineData,
                            lastClose,
                            pctChange,
                            priceChange: priceDiff,
                            catOrder: lastRaw.cat_order ?? 999,
                        });
                    });

                    seriesDataArr.sort((a, b) => a.catOrder - b.catOrder);

                    multiLastRawRef.current = rawMap;
                    setMultiLineData(seriesDataArr);

                    // Set header info from the selected name or first series
                    const target = seriesDataArr.find(s => s.name === name) || seriesDataArr[0];
                    if (target) {
                        setCurrentPrice(target.lastClose);
                        setPriceChange(target.priceChange);
                        setPercentChange(target.pctChange);
                    }
                } else {
                    // ========== Single mode: area ==========
                    const seen = new Set<number>();
                    const area: PriceData[] = [];

                    for (const item of sorted) {
                        if (typeof item.close !== 'number' || isNaN(item.close)) continue;
                        const ts = dateToTimestamp(item.date);
                        if (seen.has(ts)) continue;
                        seen.add(ts);

                        area.push({ time: ts, value: item.close * unitMultiplier });
                    }

                    setAreaData(area);

                    if (area.length > 0) {
                        const lastClose = area[area.length - 1].value;
                        setCurrentPrice(lastClose);

                        const lastRaw = sorted[sorted.length - 1];
                        lastRawRecordRef.current = lastRaw;
                        const pct = getPctByTimeRange(lastRaw, timeRange);
                        setPercentChange(pct);
                        const priceDiff = pct !== 0 ? parseFloat((lastClose - lastClose / (1 + pct / 100)).toFixed(2)) : 0;
                        setPriceChange(priceDiff);
                    }
                }

                setIsLoading(false);
            })
            .catch(() => { if (!cancelled) setIsLoading(false); });

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticker, isMultiLine]);

    // ========== Sync header info when name/timeRange/data changes ==========
    useEffect(() => {
        if (isLoading) return;
        if (isMultiLine) {
            if (multiLineData.length === 0) return;
            const target = multiLineData.find(s => s.name === name) || multiLineData[0];
            setCurrentPrice(target.lastClose);
            const rawRecord = multiLastRawRef.current.get(target.name);
            if (rawRecord) {
                const pct = getPctByTimeRange(rawRecord, timeRange);
                const priceDiff = pct !== 0 ? parseFloat((target.lastClose - target.lastClose / (1 + pct / 100)).toFixed(2)) : 0;
                setPercentChange(pct);
                setPriceChange(priceDiff);
            } else {
                setPercentChange(target.pctChange);
                setPriceChange(target.priceChange);
            }
        } else {
            const rawRecord = lastRawRecordRef.current;
            if (rawRecord && currentPrice > 0) {
                const pct = getPctByTimeRange(rawRecord, timeRange);
                setPercentChange(pct);
                const priceDiff = pct !== 0 ? parseFloat((currentPrice - currentPrice / (1 + pct / 100)).toFixed(2)) : 0;
                setPriceChange(priceDiff);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeRange, name, isLoading, multiLineData]);

    const chartHeight = isMultiLine ? height : height + 32;

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
            height: chartHeight,
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
            timeScale: { borderColor: colors.borderColor, timeVisible: false, secondsVisible: false, rightOffset: 0 },
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
                let topCoord: number | null = null;
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
                        if (coord !== null && (topCoord === null || coord < topCoord)) topCoord = coord;
                    }
                });
                const y = topCoord ?? param.point.y;
                if (lines.length === 0) { setTooltipData(null); return; }
                setTooltipData({ visible: true, x: param.point.x, y, time: timeStr, price: lines[0].value, lines });
            } else if (seriesRef.current) {
                // Single series tooltip
                const seriesData = param.seriesData.get(seriesRef.current);
                if (!seriesData || !('value' in seriesData)) { setTooltipData(null); return; }

                const price = (seriesData as SingleValueData<Time>).value;
                const coordinate = seriesRef.current.priceToCoordinate(price);
                if (coordinate === null) { setTooltipData(null); return; }

                setTooltipData({ visible: true, x: param.point.x, y: coordinate, time: timeStr, price });
            }
        });

        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);
        return () => { window.removeEventListener('resize', handleResize); };
    }, [chartHeight, colors, isMultiLine, multiLineData]);

    // ========== Render chart ==========
    useEffect(() => {
        if (isLoading) return;
        if (!chartRef.current && chartContainerRef.current) { initChart(); }
        if (!chartRef.current) return;

        const chart = chartRef.current;

        // Clean old series
        if (seriesRef.current) { chart.removeSeries(seriesRef.current); seriesRef.current = null; }
        multiSeriesRef.current.forEach(s => { try { chart.removeSeries(s); } catch { } });
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
                    priceLineVisible: false,
                    priceScaleId: 'right',
                });
                lineSeries.setData(series.data);
                multiSeriesRef.current.push(lineSeries);

                if (series.data.length > maxDataLen) maxDataLen = series.data.length;
            });

            // Set visible range
            if (maxDataLen > 0) {
                const range = getVisibleRange(timeRange, maxDataLen);
                chart.timeScale().setVisibleLogicalRange(range);
                hasSetInitialRangeRef.current = true;
            }
        } else {
            // ========== Single series (area only) ==========
            const dataLength = areaData.length;
            if (dataLength === 0) return;

            seriesRef.current = chart.addSeries(AreaSeries, {
                lineColor: colors.line,
                topColor: colors.areaTop,
                bottomColor: colors.areaBottom,
                lineWidth: 2,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 4,
                crosshairMarkerBorderColor: colors.line,
                crosshairMarkerBackgroundColor: colors.chartBackground,
                lastValueVisible: true,
                priceLineVisible: true,
                priceLineStyle: LineStyle.Dashed,
                priceLineColor: colors.line,
            });
            (seriesRef.current as ISeriesApi<'Area'>).setData(areaData);

            const range = getVisibleRange(timeRange, dataLength);
            chart.timeScale().setVisibleLogicalRange(range);
            hasSetInitialRangeRef.current = true;
        }
    }, [isLoading, initChart, isMultiLine, multiLineData, areaData, timeRange, colors]);

    // Update visible range when timeRange changes
    useEffect(() => {
        if (!chartRef.current || !hasSetInitialRangeRef.current) return;
        if (prevTimeRangeRef.current === timeRange) return;
        prevTimeRangeRef.current = timeRange;

        let dataLength: number;
        if (isMultiLine) {
            dataLength = Math.max(...multiLineData.map(s => s.data.length), 0);
        } else {
            dataLength = areaData.length;
        }
        if (dataLength > 0 && !panZoomEnabled) {
            const range = getVisibleRange(timeRange, dataLength);
            chartRef.current.timeScale().setVisibleLogicalRange(range);
        }
    }, [timeRange, isMultiLine, multiLineData, areaData, panZoomEnabled]);

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
            timeScale: { borderColor: colors.borderColor, rightOffset: 0 },
        });
        if (!isMultiLine && seriesRef.current) {
            (seriesRef.current as ISeriesApi<'Area'>).applyOptions({
                lineColor: colors.line, topColor: colors.areaTop, bottomColor: colors.areaBottom,
                crosshairMarkerBorderColor: colors.line, crosshairMarkerBackgroundColor: colors.chartBackground,
            });
        }
    }, [colors, isMultiLine]);

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
                        dataLength = areaData.length;
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
    }, [timeRange, areaData, isMultiLine, multiLineData]);

    const handleTimeRangeChange = (_e: React.MouseEvent<HTMLElement>, val: OtherChartTimeRange | null) => {
        if (val) setTimeRange(val);
    };

    const changeColor = getChangeColor(percentChange, theme);
    const arrow = getArrow(percentChange);
    const isPositive = priceChange >= 0;

    const headerHeight = 78;
    const controlsHeight = 48;
    const showLegend = isMultiLine && multiLineData.length > 1;
    const legendHeight = showLegend ? 32 : 0;
    const totalHeight = headerHeight + controlsHeight + legendHeight + chartHeight;

    return (
        <Box sx={{ width: '100%', minHeight: totalHeight }}>
            {/* ========== Header ========== */}
            <Box sx={{ mb: 2, height: headerHeight }}>
                {isLoading ? (
                    <Box>
                        <Skeleton variant="text" width={140} height={28} sx={{ borderRadius: 1 }} />
                        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 0.5 }}>
                            <Skeleton variant="rectangular" width={112} height={32} sx={{ borderRadius: 1 }} />
                            <Skeleton variant="rectangular" width={68} height={24} sx={{ borderRadius: 1 }} />
                            <Skeleton variant="rectangular" width={84} height={24} sx={{ borderRadius: 3 }} />
                        </Stack>
                    </Box>
                ) : (
                    <>
                        <Typography sx={{ fontWeight: fontWeight.bold, color: colors.textPrimary, fontSize: getResponsiveFontSize('h3') }}>
                            {name || ticker}
                        </Typography>
                        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 0.5 }}>
                            <Typography variant="h4" sx={{ fontWeight: fontWeight.bold, color: colors.textPrimary, fontSize: getResponsiveFontSize('h3') }}>
                                {currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Typography>
                            {!isPercentUnit && (
                                <Typography sx={{ color: changeColor, fontWeight: fontWeight.bold, fontSize: getResponsiveFontSize('lg') }}>
                                    {priceChange !== 0 && Math.abs(percentChange) > 0.005 ? (isPositive ? '+' : '-') : ''}
                                    {Math.abs(priceChange).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Typography>
                            )}
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
                    </>
                )}
            </Box>

            {/* ========== Controls ========== */}
            <Stack
                direction="row"
                justifyContent="flex-start"
                alignItems="center"
                useFlexGap
                flexWrap="wrap"
                spacing={1}
                sx={{ mb: 2, minHeight: controlsHeight }}
            >
                <TimeframeSelector
                    value={timeRange}
                    onChange={handleTimeRangeChange}
                    options={['1W', '1M', '3M', '1Y']}
                />
                <PanZoomToggle enabled={panZoomEnabled} onClick={handleTogglePanZoom} />
            </Stack>

            {/* ========== Multi-line Legend ========== */}
            {showLegend && (
                <Stack direction="row" flexWrap="wrap" spacing={2} justifyContent="center" sx={{ mb: 1.5, minHeight: 20 }}>
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
                sx={{ width: '100%', height: chartHeight, borderRadius: 1, overflow: 'hidden', position: 'relative' }}
            >
                {isLoading && (
                    <Box sx={{
                        position: 'absolute', inset: 0, zIndex: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        bgcolor: colors.containerBackground,
                    }}>
                        <DotLoading />
                    </Box>
                )}

                <Box ref={chartContainerRef} sx={{ width: '100%', height: '100%' }} />

                {/* Tooltip */}
                {tooltipData?.visible && (() => {
                    const containerWidth = chartContainerRef.current?.clientWidth || 0;
                    const containerHeight = chartContainerRef.current?.clientHeight || 0;
                    const flipX = tooltipData.x > containerWidth - 180;
                    const flipY = tooltipData.y < 60;
                    return (
                        <Box
                            sx={{
                                position: 'absolute',
                                left: flipX ? tooltipData.x - 15 : tooltipData.x + 15,
                                top: flipY ? tooltipData.y + 10 : tooltipData.y - 30,
                                transform: flipX ? 'translateX(-100%)' : 'none',
                                backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                                border: 'none',
                                borderRadius: 1.5,
                                padding: '6px 10px',
                                pointerEvents: 'none',
                                zIndex: 10,
                                whiteSpace: 'nowrap',
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
                            ) : (
                                // Area tooltip
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.line, fontWeight: fontWeight.medium }}>
                                        {tooltipData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Typography>
                                </Stack>
                            )}
                        </Box>
                    );
                })()}
            </Box>
        </Box>
    );
}
