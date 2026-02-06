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
    IconButton,
    Tooltip
} from '@mui/material';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import TimeframeSelector from 'components/common/TimeframeSelector';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

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
// LINE CONFIG
// ============================================================================

interface TrendLineConfig {
    key: keyof TrendChartData;
    label: string;
}

const TREND_LINE_KEYS: TrendLineConfig[] = [
    { key: 'wTrend', label: 'Tuần' },
    { key: 'mTrend', label: 'Tháng' },
    { key: 'qTrend', label: 'Quý' },
    { key: 'yTrend', label: 'Năm' },
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
    const prevTimeRangeRef = useRef<TrendTimeRange>(timeRange);
    const savedLogicalRangeRef = useRef<{ from: number; to: number } | null>(null);

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

    // Update series data
    const updateSeries = useCallback(() => {
        if (!chartRef.current) return;

        const chart = chartRef.current;
        const hasData = TREND_LINES.some((line) => chartData[line.key].length > 0);

        if (!hasData) return;

        // Save current visible range before removing series
        let savedLogicalRange = null;
        try {
            savedLogicalRange = chart.timeScale().getVisibleLogicalRange();
        } catch {
            // Chart may not have data yet
        }

        // Remove existing series
        seriesRefs.current.forEach((series) => {
            chart.removeSeries(series);
        });
        seriesRefs.current.clear();

        // Add 4 line series
        for (const line of TREND_LINES) {
            const data = chartData[line.key];
            if (data.length === 0) continue;

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

            try {
                series.setData(data);
            } catch (err) {
                console.warn(`[MarketTrendChart] Error setting ${line.key} data:`, err);
            }

            seriesRefs.current.set(line.key, series);
        }

        // Determine if we should reset range or preserve user's pan position
        const isTimeRangeChanged = prevTimeRangeRef.current !== timeRange;
        // First render: no saved range in ref AND no range captured from chart
        const isFirstRender = savedLogicalRangeRef.current === null && !savedLogicalRange;
        const shouldResetRange = isTimeRangeChanged || isFirstRender;

        // Update refs
        prevTimeRangeRef.current = timeRange;

        const maxDataLength = Math.max(
            ...TREND_LINES.map((l) => chartData[l.key].length)
        );

        if (shouldResetRange) {
            // TimeRange changed or first render -> set range based on timeRange
            if (maxDataLength > 0) {
                const visibleRange = getVisibleRange(timeRange, maxDataLength);
                chart.timeScale().setVisibleLogicalRange(visibleRange);
            }
            // Clear saved range when reset
            savedLogicalRangeRef.current = null;
        } else if (savedLogicalRange) {
            // Data update only -> restore saved range to avoid visual jump
            try {
                chart.timeScale().setVisibleLogicalRange(savedLogicalRange);
            } catch {
                if (maxDataLength > 0) {
                    const visibleRange = getVisibleRange(timeRange, maxDataLength);
                    chart.timeScale().setVisibleLogicalRange(visibleRange);
                }
            }
        }

        // Save range after render for next update
        setTimeout(() => {
            try {
                if (chartRef.current) {
                    savedLogicalRangeRef.current = chartRef.current.timeScale().getVisibleLogicalRange();
                }
            } catch {
                // Ignore
            }
        }, 0);
    }, [chartData, timeRange, isDarkMode, TREND_LINES]);

    // Initialize and update
    useEffect(() => {
        if (!chartRef.current && chartContainerRef.current) {
            initChart();
        }

        const hasData = TREND_LINES.some((line) => chartData[line.key].length > 0);
        if (!hasData) return;

        if (chartRef.current) {
            updateSeries();
        }
    }, [initChart, updateSeries, chartData, timeRange]);

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

    // Pan/Zoom toggle
    const [panZoomEnabled, setPanZoomEnabled] = useState(false);

    // Reset pan/zoom when timeRange changes — timeRange is always authoritative
    useEffect(() => {
        if (panZoomEnabled) {
            setPanZoomEnabled(false);
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
            {/* Timeframe selector + Pan/Zoom toggle */}
            <Stack
                direction="row"
                justifyContent="flex-end"
                alignItems="center"
                spacing={1}
                sx={{ mb: 1.5 }}
            >
                <Tooltip title={panZoomEnabled ? 'Tắt kéo/thu phóng' : 'Bật kéo/thu phóng'} arrow>
                    <IconButton
                        onClick={handleTogglePanZoom}
                        size="small"
                        sx={{
                            color: panZoomEnabled ? colors.buttonBackgroundActive : colors.buttonText,
                            backgroundColor: colors.buttonBackground,
                            border: 'none',
                            borderRadius: 2,
                            height: 34,
                            width: 34,
                            '&:hover': { backgroundColor: colors.buttonBackground },
                        }}
                    >
                        <OpenWithIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Tooltip>
                <TimeframeSelector
                    value={timeRange}
                    onChange={handleTimeRangeChange}
                    options={['1M', '3M', '6M', '1Y'] as TrendTimeRange[]}
                />
            </Stack>

            {/* Legend - centered */}
            <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                justifyContent="center"
                flexWrap="wrap"
                sx={{ mb: 1.5 }}
            >
                {latestValues.map((item) => (
                    <Stack
                        key={item.key}
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                    >
                        <Box
                            sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                backgroundColor: item.color,
                                flexShrink: 0,
                            }}
                        />
                        <Typography
                            sx={{
                                fontSize: getResponsiveFontSize('sm'),
                                color: colors.textSecondary,
                            }}
                        >
                            {item.label}:
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: getResponsiveFontSize('sm'),
                                fontWeight: fontWeight.bold,
                                color: item.value !== null
                                    ? item.color
                                    : colors.textSecondary,
                            }}
                        >
                            {item.value !== null
                                ? `${(item.value * 100).toFixed(1)}%`
                                : '—'}
                        </Typography>
                    </Stack>
                ))}
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
