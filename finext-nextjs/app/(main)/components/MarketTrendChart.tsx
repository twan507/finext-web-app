'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
    createChart,
    IChartApi,
    ISeriesApi,
    LineSeries,
    ColorType,
    CrosshairMode,
    LineStyle,
    LineType,
    UTCTimestamp,
    SingleValueData,
    Time
} from 'lightweight-charts';
import {
    Box,
    Typography,
    Stack,
    useTheme,
    CircularProgress,
    alpha,
    keyframes
} from '@mui/material';
import PanZoomToggle from 'components/common/PanZoomToggle';
import TimeframeSelector from 'components/common/TimeframeSelector';
import { getResponsiveFontSize, fontWeight, getGlassCard } from 'theme/tokens';

// ============================================================================
// TYPES
// ============================================================================

export interface RawTrendData {
    ticker: string;
    ticker_name?: string;
    date: string;
    w_trend: number;
    m_trend: number;
    q_trend: number;
    y_trend: number;
}

interface TrendLineData {
    time: UTCTimestamp;
    value: number;
}

export interface TrendChartData {
    wTrend: TrendLineData[];
    mTrend: TrendLineData[];
    qTrend: TrendLineData[];
    yTrend: TrendLineData[];
}

export type TrendTimeRange = '1M' | '3M' | '6M' | '1Y';

interface MarketTrendChartProps {
    height?: number;
    chartData: TrendChartData;
    isLoading?: boolean;
    error?: string | null;
    timeRange: TrendTimeRange;
    onTimeRangeChange: (newTimeRange: TrendTimeRange) => void;
}

// ============================================================================
// TRANSFORM FUNCTION
// ============================================================================

export const transformTrendData = (rawData: RawTrendData[]): TrendChartData => {
    const result: TrendChartData = {
        wTrend: [],
        mTrend: [],
        qTrend: [],
        yTrend: [],
    };

    if (!rawData || rawData.length === 0) return result;

    // Filter invalid data
    const validData = rawData.filter(
        (item) =>
            item.date &&
            typeof item.w_trend === 'number' &&
            typeof item.m_trend === 'number' &&
            typeof item.q_trend === 'number' &&
            typeof item.y_trend === 'number'
    );

    if (validData.length === 0) return result;

    // Sort ascending by date
    const sorted = [...validData].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const seenTimestamps = new Set<number>();

    for (const item of sorted) {
        const dateObj = new Date(item.date);
        const utcDate = Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
        const timestamp = Math.floor(utcDate / 1000) as UTCTimestamp;

        // Skip duplicates
        if (seenTimestamps.has(timestamp)) continue;
        seenTimestamps.add(timestamp);

        result.wTrend.push({ time: timestamp, value: item.w_trend });
        result.mTrend.push({ time: timestamp, value: item.m_trend });
        result.qTrend.push({ time: timestamp, value: item.q_trend });
        result.yTrend.push({ time: timestamp, value: item.y_trend });
    }

    return result;
};

// Calculate visible range
const getVisibleRange = (
    timeRange: TrendTimeRange,
    dataLength: number
): { from: number; to: number } => {
    let daysToShow = dataLength;

    switch (timeRange) {
        case '1M':
            daysToShow = 22;
            break;
        case '3M':
            daysToShow = 66;
            break;
        case '6M':
            daysToShow = 132;
            break;
        case '1Y':
            daysToShow = 252;
            break;
        default:
            daysToShow = dataLength;
            break;
    }

    const visibleBars = Math.min(daysToShow, dataLength);
    return {
        from: dataLength - visibleBars - 0.5,
        to: dataLength - 0.5,
    };
};

// Empty chart data
const emptyChartData: TrendChartData = {
    wTrend: [],
    mTrend: [],
    qTrend: [],
    yTrend: [],
};

// ============================================================================
// KEYFRAME ANIMATIONS
// ============================================================================

const pulseRing = keyframes`
    0% {
        transform: scale(0.8);
        opacity: 1;
    }
    50% {
        transform: scale(1.5);
        opacity: 0.4;
    }
    100% {
        transform: scale(2);
        opacity: 0;
    }
`;

const pulseCore = keyframes`
    0%, 100% {
        transform: scale(1);
        box-shadow: 0 0 0 0 currentColor;
    }
    50% {
        transform: scale(1.1);
        box-shadow: 0 0 8px 2px currentColor;
    }
`;

// ============================================================================
// TREND INDICATOR COMPONENT
// ============================================================================

function TrendIndicator({ color }: { color: string }) {
    return (
        <Box
            sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 12,
                height: 12,
                flexShrink: 0,
            }}
        >
            {/* Outer pulse ring */}
            <Box
                sx={{
                    position: 'absolute',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: color,
                    animation: `${pulseRing} 2s ease-out infinite`,
                }}
            />
            {/* Inner core dot */}
            <Box
                sx={{
                    position: 'relative',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: color,
                    color: color,
                    animation: `${pulseCore} 2s ease-in-out infinite`,
                    zIndex: 1,
                }}
            />
        </Box>
    );
}

// ============================================================================
// LINE CONFIG
// ============================================================================

interface TrendLineConfig {
    key: keyof TrendChartData;
    label: string;
    fullLabel: string;
}

const TREND_LINE_KEYS: TrendLineConfig[] = [
    { key: 'wTrend', label: 'Tuần', fullLabel: 'Xu hướng tuần' },
    { key: 'mTrend', label: 'Tháng', fullLabel: 'Xu hướng tháng' },
    { key: 'qTrend', label: 'Quý', fullLabel: 'Xu hướng quý' },
    { key: 'yTrend', label: 'Năm', fullLabel: 'Xu hướng năm' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function MarketTrendChart({
    height = 345,
    chartData = emptyChartData,
    isLoading = false,
    error = null,
    timeRange,
    onTimeRangeChange,
}: MarketTrendChartProps) {
    const theme = useTheme();
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

    // Pan/Zoom toggle
    const [panZoomEnabled, setPanZoomEnabled] = useState(false);

    // Tooltip state
    const [tooltipData, setTooltipData] = useState<{
        visible: boolean;
        x: number;
        y: number;
        time: string;
        values: { label: string; value: number; color: string }[];
    } | null>(null);

    const isDarkMode = theme.palette.mode === 'dark';

    const colors = useMemo(
        () => ({
            chartBackground: theme.palette.background.paper,
            containerBackground: theme.palette.background.default,
            textPrimary: theme.palette.text.primary,
            textSecondary: theme.palette.text.secondary,
            gridColor: theme.palette.component.chart.gridLine,
            crosshairColor: theme.palette.component.chart.crosshair,
            buttonBackground: theme.palette.component.chart.buttonBackground,
            buttonText: theme.palette.component.chart.buttonText,
            buttonBackgroundActive: theme.palette.component.chart.buttonBackgroundActive,
            borderColor: theme.palette.divider,
        }),
        [theme]
    );

    // Resolve trend line colors from theme
    const TREND_LINES = useMemo(
        () => TREND_LINE_KEYS.map((line) => ({
            ...line,
            color:
                line.key === 'wTrend' ? theme.palette.trend.ceil :
                    line.key === 'mTrend' ? theme.palette.trend.up :
                        line.key === 'qTrend' ? theme.palette.warning.main :
                            theme.palette.trend.down,
        })),
        [theme]
    );

    // Initialize chart
    const initChart = useCallback(() => {
        if (!chartContainerRef.current) return;

        // Clear existing
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
            seriesRefs.current.clear();
        }

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: colors.textSecondary,
            },
            grid: {
                vertLines: { color: colors.gridColor, style: LineStyle.Solid },
                horzLines: { color: colors.gridColor, style: LineStyle.Solid },
            },
            width: chartContainerRef.current.clientWidth,
            height: height,
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    color: colors.crosshairColor,
                    width: 1,
                    style: LineStyle.Dashed,
                },
                horzLine: {
                    color: colors.crosshairColor,
                    width: 1,
                    style: LineStyle.Dashed,
                },
            },
            rightPriceScale: {
                borderColor: colors.borderColor,
                scaleMargins: { top: 0.05, bottom: 0.05 },
            },
            localization: {
                locale: 'vi-VN',
                priceFormatter: (price: number) => (price * 100).toFixed(1) + '%',
            },
            timeScale: {
                borderColor: colors.borderColor,
                timeVisible: false,
                secondsVisible: false,
            },
            handleScroll: {
                mouseWheel: false,
                pressedMouseMove: false,
                horzTouchDrag: false,
                vertTouchDrag: false,
            },
            handleScale: {
                axisPressedMouseMove: false,
                mouseWheel: false,
                pinch: false,
            },
        });

        chartRef.current = chart;

        // Handle resize
        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                });
            }
        };

        // Tooltip on crosshair move
        chart.subscribeCrosshairMove((param) => {
            if (!param.time || !param.point || !chartContainerRef.current) {
                setTooltipData(null);
                return;
            }

            const timestamp = param.time as number;
            const date = new Date(timestamp * 1000);
            const day = date.getUTCDate().toString().padStart(2, '0');
            const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
            const year = date.getUTCFullYear();
            const timeStr = `${day}/${month}/${year}`;

            const values: { label: string; value: number; color: string }[] = [];

            for (const line of TREND_LINES) {
                const series = seriesRefs.current.get(line.key);
                if (series) {
                    const data = param.seriesData.get(series);
                    if (data && 'value' in data) {
                        values.push({
                            label: line.label,
                            value: (data as SingleValueData<Time>).value,
                            color: line.color,
                        });
                    }
                }
            }

            if (values.length === 0) {
                setTooltipData(null);
                return;
            }

            setTooltipData({
                visible: true,
                x: param.point.x,
                y: param.point.y,
                time: timeStr,
                values,
            });
        });

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [height, colors, TREND_LINES]);

    // Refs to track changes (matching MarketIndexChart pattern)
    const prevTimeRangeRef = useRef<TrendTimeRange>(timeRange);
    const hasSetInitialRangeRef = useRef<boolean>(false);
    const savedLogicalRangeRef = useRef<{ from: number; to: number } | null>(null);

    // Helper: Create 4 line series (called once, or when series need recreation)
    const createSeries = useCallback((chart: IChartApi) => {
        // Remove existing series if any
        seriesRefs.current.forEach((series) => {
            chart.removeSeries(series);
        });
        seriesRefs.current.clear();

        for (const line of TREND_LINES) {
            const series = chart.addSeries(LineSeries, {
                color: line.color,
                lineWidth: 2,
                lineType: LineType.Curved,
                pointMarkersVisible: true,
                pointMarkersRadius: 1.8,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 4,
                crosshairMarkerBorderColor: line.color,
                crosshairMarkerBackgroundColor: colors.chartBackground,
                lastValueVisible: true,
                priceLineVisible: false,
                title: '',
                priceFormat: {
                    type: 'custom',
                    formatter: (price: number) => (price * 100).toFixed(1) + '%',
                },
            });
            seriesRefs.current.set(line.key, series);
        }
    }, [TREND_LINES, colors.chartBackground]);

    // Update data on existing series — NO remove/recreate → no range jump
    const updateSeriesData = useCallback(() => {
        for (const line of TREND_LINES) {
            const series = seriesRefs.current.get(line.key);
            const data = chartData[line.key];
            if (series && data.length > 0) {
                try {
                    series.setData(data);
                } catch (err) {
                    console.warn(`[MarketTrendChart] Error setting ${line.key} data:`, err);
                }
            }
        }
    }, [chartData, TREND_LINES]);

    // Combined effect: Initialize chart, manage series, and update data
    useEffect(() => {
        // Initialize chart if not exists
        if (!chartRef.current && chartContainerRef.current) {
            initChart();
        }
        if (!chartRef.current) return;

        const chart = chartRef.current;
        const hasData = TREND_LINES.some((line) => chartData[line.key].length > 0);
        if (!hasData) return;

        // Create series if not yet created
        const needsNewSeries = seriesRefs.current.size === 0;
        if (needsNewSeries) {
            createSeries(chart);
        }

        // Update data on existing series (no remove/recreate)
        updateSeriesData();

        // Handle visible range
        const maxDataLength = Math.max(
            ...TREND_LINES.map((l) => chartData[l.key].length)
        );
        const isTimeRangeChanged = prevTimeRangeRef.current !== timeRange;
        const shouldResetRange = isTimeRangeChanged || !hasSetInitialRangeRef.current;

        // Update refs
        prevTimeRangeRef.current = timeRange;

        if (shouldResetRange) {
            // TimeRange changed or first render → set range based on timeRange
            if (maxDataLength > 0) {
                const visibleRange = getVisibleRange(timeRange, maxDataLength);
                chart.timeScale().setVisibleLogicalRange(visibleRange);
            }
            hasSetInitialRangeRef.current = true;
        } else if (panZoomEnabled) {
            // User is in Pan/Zoom mode → restore saved range if available
            if (savedLogicalRangeRef.current) {
                try {
                    chart.timeScale().setVisibleLogicalRange(savedLogicalRangeRef.current);
                } catch { /* ignore */ }
            }
        } else {
            // Standard mode → always enforce correct range
            if (maxDataLength > 0) {
                const visibleRange = getVisibleRange(timeRange, maxDataLength);
                chart.timeScale().setVisibleLogicalRange(visibleRange);
            }
        }
    }, [initChart, createSeries, updateSeriesData, chartData, timeRange, panZoomEnabled, TREND_LINES]);

    // Subscribe to visible range changes (only when Pan/Zoom is enabled)
    useEffect(() => {
        if (!chartRef.current) return;
        const chart = chartRef.current;

        const handler = () => {
            if (panZoomEnabled) {
                try {
                    savedLogicalRangeRef.current = chart.timeScale().getVisibleLogicalRange();
                } catch { /* ignore */ }
            }
        };

        chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
        return () => {
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
        };
    }, [colors, panZoomEnabled]);

    // Theme change
    useEffect(() => {
        if (!chartRef.current) return;

        chartRef.current.applyOptions({
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: colors.textSecondary,
            },
            grid: {
                vertLines: { color: colors.gridColor, style: LineStyle.Solid },
                horzLines: { color: colors.gridColor, style: LineStyle.Solid },
            },
            crosshair: {
                vertLine: { color: colors.crosshairColor, width: 1, style: LineStyle.Dashed },
                horzLine: { color: colors.crosshairColor, width: 1, style: LineStyle.Dashed },
            },
            rightPriceScale: { borderColor: colors.borderColor },
            timeScale: { borderColor: colors.borderColor },
        });

        // Update series colors (they stay the same since defined per-line, but update marker bg)
        seriesRefs.current.forEach((series, key) => {
            const lineConfig = TREND_LINES.find((l) => l.key === key);
            if (lineConfig) {
                series.applyOptions({
                    crosshairMarkerBackgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff',
                });
            }
        });
    }, [colors, isDarkMode]);


    // Reset pan/zoom when timeRange changes — timeRange is always authoritative
    useEffect(() => {
        if (panZoomEnabled) {
            setPanZoomEnabled(false);
            savedLogicalRangeRef.current = null;
            if (chartRef.current) {
                chartRef.current.applyOptions({
                    handleScroll: {
                        mouseWheel: false,
                        pressedMouseMove: false,
                        horzTouchDrag: false,
                        vertTouchDrag: false,
                    },
                    handleScale: {
                        axisPressedMouseMove: false,
                        mouseWheel: false,
                        pinch: false,
                    },
                });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeRange]);

    const handleTogglePanZoom = useCallback(() => {
        setPanZoomEnabled(prev => {
            const next = !prev;
            if (chartRef.current) {
                chartRef.current.applyOptions({
                    handleScroll: {
                        mouseWheel: next,
                        pressedMouseMove: next,
                        horzTouchDrag: next,
                        vertTouchDrag: false,
                    },
                    handleScale: {
                        axisPressedMouseMove: next,
                        mouseWheel: next,
                        pinch: next,
                    },
                });
                // Reset to selected timeRange view when turning off
                if (!next) {
                    const maxDataLength = Math.max(
                        ...TREND_LINES.map((l) => chartData[l.key].length)
                    );
                    if (maxDataLength > 0) {
                        const visibleRange = getVisibleRange(timeRange, maxDataLength);
                        chartRef.current.timeScale().setVisibleLogicalRange(visibleRange);
                    }
                    // Reset vertical (price) axis
                    chartRef.current.priceScale('right').applyOptions({ autoScale: true });
                }
            }
            return next;
        });
    }, [chartData, timeRange, TREND_LINES]);
    useEffect(() => {
        return () => {
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
                seriesRefs.current.clear();
            }
        };
    }, []);

    const handleTimeRangeChange = (
        _event: React.MouseEvent<HTMLElement>,
        newRange: TrendTimeRange | null
    ) => {
        if (newRange !== null) {
            onTimeRangeChange(newRange);
        }
    };

    // Latest values for header display
    const latestValues = useMemo(() => {
        return TREND_LINES.map((line) => {
            const data = chartData[line.key];
            const lastValue = data.length > 0 ? data[data.length - 1].value : null;
            return {
                ...line,
                value: lastValue,
            };
        });
    }, [chartData, TREND_LINES]);

    return (
        <Box sx={{ width: '100%' }}>
            {/* 2-Column Layout: Legend (left) + Controls (right) */}
            <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-end"
                spacing={2}
                sx={{ mb: 2 }}
            >
                {/* Left: Trend Info Panel - 2 columns side by side */}
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={{ xs: 0.75, md: 3 }}
                    sx={{ alignItems: { xs: 'flex-start', md: 'flex-end' } }}
                >
                    {/* First column: Tuần, Tháng */}
                    <Stack spacing={0.75} sx={{ minWidth: { xs: 160, md: 'auto' } }}>
                        {latestValues.slice(0, 2).map((item) => (
                            <Stack
                                key={item.key}
                                direction="row"
                                spacing={1}
                                alignItems="center"
                            >
                                <TrendIndicator color={item.color} />
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('sm'),
                                        color: 'text.secondary',
                                        fontWeight: fontWeight.medium,
                                    }}
                                >
                                    {item.fullLabel}:
                                </Typography>
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('sm'),
                                        fontWeight: fontWeight.bold,
                                        color: item.value !== null
                                            ? item.color
                                            : 'text.secondary',
                                    }}
                                >
                                    {item.value !== null
                                        ? `${(item.value * 100).toFixed(1)}%`
                                        : '—'}
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>

                    {/* Second column: Quý, Năm */}
                    <Stack spacing={0.75} sx={{ minWidth: { xs: 160, md: 'auto' } }}>
                        {latestValues.slice(2, 4).map((item) => (
                            <Stack
                                key={item.key}
                                direction="row"
                                spacing={1}
                                alignItems="center"
                            >
                                <TrendIndicator color={item.color} />
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('sm'),
                                        color: 'text.secondary',
                                        fontWeight: fontWeight.medium,
                                    }}
                                >
                                    {item.fullLabel}:
                                </Typography>
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('sm'),
                                        fontWeight: fontWeight.bold,
                                        color: item.value !== null
                                            ? item.color
                                            : 'text.secondary',
                                    }}
                                >
                                    {item.value !== null
                                        ? `${(item.value * 100).toFixed(1)}%`
                                        : '—'}
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                </Stack>

                {/* Right: Timeframe selector + Pan/Zoom toggle */}
                <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ flexShrink: 0 }}
                >
                    <PanZoomToggle enabled={panZoomEnabled} onClick={handleTogglePanZoom} />
                    <TimeframeSelector
                        value={timeRange}
                        onChange={handleTimeRangeChange}
                        options={['1M', '3M', '6M', '1Y'] as TrendTimeRange[]}
                    />
                </Stack>
            </Stack>

            {/* Chart container */}
            <Box
                onMouseLeave={() => {
                    setTooltipData(null);
                }}
                sx={{
                    width: '100%',
                    height: height,
                    borderRadius: 1,
                    overflow: 'hidden',
                    position: 'relative',
                }}
            >
                {/* Loading overlay */}
                {isLoading && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            gap: 2,
                            bgcolor: colors.containerBackground,
                            zIndex: 1,
                        }}
                    >
                        <CircularProgress />
                        <Typography color="text.secondary">
                            Đang tải dữ liệu xu hướng...
                        </Typography>
                    </Box>
                )}

                {/* Error overlay */}
                {error && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: colors.containerBackground,
                            zIndex: 1,
                        }}
                    >
                        <Typography color="error">{error}</Typography>
                    </Box>
                )}

                {/* Chart */}
                <Box
                    ref={chartContainerRef}
                    sx={{ width: '100%', height: '100%' }}
                />

                {/* Tooltip */}
                {tooltipData && tooltipData.visible && (
                    <Box
                        sx={{
                            position: 'absolute',
                            left: tooltipData.x + 15,
                            top: tooltipData.y - 30,
                            backgroundColor: isDarkMode
                                ? 'rgba(30, 30, 30, 0.9)'
                                : 'rgba(255, 255, 255, 0.9)',
                            border: 'none',
                            borderRadius: 1.5,
                            padding: '6px 10px',
                            pointerEvents: 'none',
                            zIndex: 10,
                            boxShadow: 'none',
                            transform:
                                tooltipData.x >
                                    (chartContainerRef.current?.clientWidth || 0) - 150
                                    ? 'translateX(-100%) translateX(-30px)'
                                    : 'none',
                        }}
                    >
                        <Typography
                            sx={{
                                fontSize: getResponsiveFontSize('sm'),
                                color: colors.textSecondary,
                                mb: 0.5,
                                fontWeight: fontWeight.medium,
                            }}
                        >
                            {tooltipData.time}
                        </Typography>
                        {tooltipData.values.map((v) => (
                            <Stack
                                key={v.label}
                                direction="row"
                                spacing={1}
                                alignItems="center"
                            >
                                <Box
                                    sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        backgroundColor: v.color,
                                        flexShrink: 0,
                                    }}
                                />
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('sm'),
                                        color: colors.textSecondary,
                                        minWidth: 36,
                                    }}
                                >
                                    {v.label}:
                                </Typography>
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('sm'),
                                        color: v.color,
                                        fontWeight: fontWeight.medium,
                                    }}
                                >
                                    {(v.value * 100).toFixed(1)}%
                                </Typography>
                            </Stack>
                        ))}
                    </Box>
                )}
            </Box>
        </Box>
    );
}
