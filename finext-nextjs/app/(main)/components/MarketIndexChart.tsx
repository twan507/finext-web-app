'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { zIndex } from 'theme/tokens';
import {
    createChart,
    IChartApi,
    ISeriesApi,
    AreaSeries,
    CandlestickSeries,
    HistogramSeries,
    ColorType,
    CrosshairMode,
    LineStyle,
    UTCTimestamp,
    OhlcData,
    SingleValueData,
    Time
} from 'lightweight-charts';
import {
    Box,
    Typography,
    ToggleButton,
    ToggleButtonGroup,
    IconButton,
    Stack,
    Chip,
    useTheme,
    CircularProgress
} from '@mui/material';
import TimeframeSelector from 'components/common/TimeframeSelector';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

// Types - export để page có thể sử dụng
export type TimeRange = '1D' | '1M' | '3M' | '1Y' | 'ALL';
type ChartType = 'area' | 'candlestick';

interface PriceData {
    time: UTCTimestamp;
    value: number;
}

interface CandlestickData {
    time: UTCTimestamp;
    open: number;
    high: number;
    low: number;
    close: number;
}

interface VolumeData {
    time: UTCTimestamp;
    value: number;
    color: string;
}

// Raw data từ API - export để page có thể sử dụng
export interface RawMarketData {
    ticker: string;
    ticker_name?: string; // Tên đầy đủ của ticker/index
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    diff?: number;        // Giá trị thay đổi
    pct_change?: number;  // Phần trăm thay đổi
    type?: string;        // Loại dữ liệu (industry, index, ...)
}

// Chart data format - export để page có thể sử dụng
export interface ChartData {
    areaData: PriceData[];
    candleData: CandlestickData[];
    volumeData: Omit<VolumeData, 'color'>[];
    lastDiff?: number;       // Giá trị thay đổi của record cuối
    lastPctChange?: number;  // Phần trăm thay đổi của record cuối
}

interface StockChartProps {
    symbol: string;
    title: string;
    height?: number;
    eodData: ChartData;
    intradayData: ChartData;
    isLoading?: boolean;
    error?: string | null;
    // Lifted state từ page
    timeRange: TimeRange;
    onTimeRangeChange: (newTimeRange: TimeRange) => void;
}

// Transform raw API data to chart format - export để page có thể sử dụng
// isIntraday: true = dữ liệu trong ngày (cần parse time theo phút), false = dữ liệu EOD (chỉ cần date)
export const transformToChartData = (rawData: RawMarketData[], isIntraday: boolean = false): ChartData => {
    const data: ChartData = {
        areaData: [],
        candleData: [],
        volumeData: [],
        lastDiff: undefined,
        lastPctChange: undefined
    };

    if (!rawData || rawData.length === 0) {
        return data;
    }

    // Filter out invalid data (null/undefined values)
    // ITD chỉ cần date và close, EOD cần đầy đủ OHLC
    const validData = rawData.filter(item => {
        if (!item.date || typeof item.close !== 'number' || isNaN(item.close)) {
            return false;
        }
        if (isIntraday) {
            // ITD chỉ cần close
            return true;
        }
        // EOD cần đầy đủ OHLC
        return typeof item.open === 'number' && !isNaN(item.open) &&
            typeof item.high === 'number' && !isNaN(item.high) &&
            typeof item.low === 'number' && !isNaN(item.low);
    });

    if (validData.length === 0) {
        return data;
    }

    // Sort by date ascending for chart display
    const sortedData = [...validData].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Lấy diff và pct_change từ record cuối cùng (dữ liệu mới nhất)
    const lastRecord = sortedData[sortedData.length - 1];
    data.lastDiff = lastRecord?.diff;
    data.lastPctChange = lastRecord?.pct_change;

    // Track seen timestamps to avoid duplicates (lightweight-charts requires unique ascending times)
    const seenTimestamps = new Set<number>();

    for (const item of sortedData) {
        let timestamp: UTCTimestamp;

        if (isIntraday) {
            // ITD data: parse full datetime including time (e.g., "2025-12-10T14:57:00")
            // MongoDB lưu UTC, cần thêm 7h cho Vietnam timezone (GMT+7)
            const dateObj = new Date(item.date);
            // Thêm 7 giờ (7 * 60 * 60 = 25200 giây) để chuyển từ UTC sang Vietnam time
            timestamp = (Math.floor(dateObj.getTime() / 1000) + 7 * 60 * 60) as UTCTimestamp;
        } else {
            // EOD data: only use date part, set to midnight UTC
            const dateObj = new Date(item.date);
            // Create date at midnight UTC for EOD
            const utcDate = Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
            timestamp = Math.floor(utcDate / 1000) as UTCTimestamp;
        }

        // Skip duplicate timestamps (lightweight-charts requires unique ascending times)
        if (seenTimestamps.has(timestamp)) {
            console.warn(`[MarketIndexChart] Skipping duplicate timestamp: ${timestamp} (date: ${item.date})`);
            continue;
        }
        seenTimestamps.add(timestamp);

        // Chỉ thêm candleData cho EOD (ITD không có OHLC, chỉ vẽ line chart)
        if (!isIntraday) {
            data.candleData.push({
                time: timestamp,
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close
            });
        }

        data.areaData.push({
            time: timestamp,
            value: item.close
        });

        data.volumeData.push({
            time: timestamp,
            value: item.volume || 0
        });
    }

    return data;
};

// Calculate visible range based on timeRange selection
const getVisibleRange = (
    timeRange: TimeRange,
    dataLength: number
): { from: number; to: number } => {
    let daysToShow = dataLength;

    switch (timeRange) {
        case '1M':
            daysToShow = 22; // ~1 month of trading days
            break;
        case '3M':
            daysToShow = 66; // ~3 months of trading days
            break;
        case '1Y':
            daysToShow = 252; // ~1 year of trading days
            break;
        case 'ALL':
        default:
            daysToShow = dataLength;
            break;
    }

    const visibleBars = Math.min(daysToShow, dataLength);
    return {
        from: dataLength - visibleBars - 0.5,
        to: dataLength - 0.5
    };
};

// Empty chart data for initial state
const emptyChartData: ChartData = {
    areaData: [],
    candleData: [],
    volumeData: [],
    lastDiff: undefined,
    lastPctChange: undefined
};

export default function MarketIndexChart({
    symbol,
    title,
    height = 345,
    eodData = emptyChartData,
    intradayData = emptyChartData,
    isLoading = false,
    error = null,
    timeRange,
    onTimeRangeChange
}: StockChartProps) {
    const theme = useTheme();
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<
        ISeriesApi<'Area'> | ISeriesApi<'Candlestick'> | null
    >(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Tooltip state
    const [tooltipData, setTooltipData] = useState<{
        visible: boolean;
        x: number;
        y: number;
        time: string;
        price: number;
        open?: number;
        high?: number;
        low?: number;
        close?: number;
        volume?: number;
    } | null>(null);

    // Refs để lưu trữ visible range và track thay đổi
    const savedLogicalRangeRef = useRef<{ from: number; to: number } | null>(null);
    const prevTimeRangeRef = useRef<TimeRange>(timeRange);
    const prevSymbolRef = useRef<string>(symbol);

    // timeRange is now controlled by parent via props
    const [chartType, setChartType] = useState<ChartType>('candlestick');
    const [currentPrice, setCurrentPrice] = useState<number>(0);
    const [priceChange, setPriceChange] = useState<number>(0);
    const [percentChange, setPercentChange] = useState<number>(0);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

    // Theme-based colors
    const isDarkMode = theme.palette.mode === 'dark';

    const colors = useMemo(
        () => ({
            // Background colors
            chartBackground: theme.palette.background.paper,
            containerBackground: theme.palette.background.default,

            // Text colors
            textPrimary: theme.palette.text.primary,
            textSecondary: theme.palette.text.secondary,

            // Chart specific colors from palette
            line: theme.palette.component.chart.line,
            areaTop: theme.palette.component.chart.areaTop,
            areaBottom: theme.palette.component.chart.areaBottom,
            upColor: theme.palette.component.chart.upColor,
            downColor: theme.palette.component.chart.downColor,
            gridColor: theme.palette.component.chart.gridLine,
            crosshairColor: theme.palette.component.chart.crosshair,

            // Button colors
            buttonBackground: theme.palette.component.chart.buttonBackground,
            buttonBackgroundHover: theme.palette.component.chart.buttonBackgroundHover,
            buttonBackgroundActive: theme.palette.component.chart.buttonBackgroundActive,
            buttonText: theme.palette.component.chart.buttonText,
            buttonTextActive: theme.palette.component.chart.buttonTextActive,

            // Border color
            borderColor: theme.palette.divider
        }),
        [theme]
    );

    // Initialize chart (only once or when timeRange changes data source)
    const initChart = useCallback(() => {
        if (!chartContainerRef.current) return;

        // Clear existing chart
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
            seriesRef.current = null;
        }

        // Select data based on timeRange (1D uses ITD, others use EOD)
        const isIntraday = timeRange === '1D';

        // Create chart
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: colors.textSecondary
            },
            grid: {
                vertLines: { color: colors.gridColor, style: LineStyle.Solid },
                horzLines: { color: colors.gridColor, style: LineStyle.Solid }
            },
            width: chartContainerRef.current.clientWidth,
            height: height,
            crosshair: {
                mode: CrosshairMode.Normal, // Crosshair di chuyển tự do theo chuột
                vertLine: {
                    color: colors.crosshairColor,
                    width: 1,
                    style: LineStyle.Dashed
                },
                horzLine: {
                    color: colors.crosshairColor,
                    width: 1,
                    style: LineStyle.Dashed
                }
            },
            rightPriceScale: {
                borderColor: colors.borderColor,
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.1
                }
            },
            localization: {
                locale: 'vi-VN',
            },
            timeScale: {
                borderColor: colors.borderColor,
                timeVisible: isIntraday,
                secondsVisible: false,
                tickMarkFormatter: isIntraday
                    ? (time: UTCTimestamp) => {
                        const date = new Date(time * 1000);
                        // Sử dụng local time để hiển thị giờ:phút
                        const hours = date.getHours().toString().padStart(2, '0');
                        const minutes = date.getMinutes().toString().padStart(2, '0');
                        return `${hours}:${minutes}`;
                    }
                    : undefined
            },
            handleScroll: {
                mouseWheel: false,
                pressedMouseMove: false,
                horzTouchDrag: false,
                vertTouchDrag: false
            },
            handleScale: {
                axisPressedMouseMove: false,
                mouseWheel: false,
                pinch: false
            }
        });

        chartRef.current = chart;

        // Handle resize
        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth
                });
            }
        };

        // Subscribe to crosshair move for tooltip
        chart.subscribeCrosshairMove((param) => {
            if (!param.time || !param.point || !seriesRef.current || !chartContainerRef.current) {
                setTooltipData(null);
                return;
            }

            const seriesData = param.seriesData.get(seriesRef.current);
            if (!seriesData) {
                setTooltipData(null);
                return;
            }

            // Check if it's area data (SingleValueData) or candlestick data (OhlcData)
            const isAreaData = 'value' in seriesData;

            // Get coordinate of the price point
            let price: number;
            if (isAreaData) {
                price = (seriesData as SingleValueData<Time>).value;
            } else {
                price = (seriesData as OhlcData<Time>).close;
            }
            const coordinate = seriesRef.current.priceToCoordinate(price);

            if (coordinate === null) {
                setTooltipData(null);
                return;
            }

            // Format time for display
            const timestamp = param.time as number;
            const date = new Date(timestamp * 1000);
            let timeStr: string;

            if (isIntraday) {
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                timeStr = `${day}/${month} ${hours}:${minutes}`;
            } else {
                const day = date.getUTCDate().toString().padStart(2, '0');
                const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
                const year = date.getUTCFullYear();
                timeStr = `${day}/${month}/${year}`;
            }

            // Get volume data if available
            let volumeValue: number | undefined;
            if (volumeSeriesRef.current) {
                const volumeData = param.seriesData.get(volumeSeriesRef.current);
                if (volumeData && 'value' in volumeData) {
                    volumeValue = (volumeData as SingleValueData<Time>).value;
                }
            }

            // Set tooltip data at intersection point
            if (isAreaData) {
                // Area chart
                const areaData = seriesData as SingleValueData<Time>;
                setTooltipData({
                    visible: true,
                    x: param.point.x,
                    y: coordinate,
                    time: timeStr,
                    price: areaData.value,
                    volume: volumeValue
                });
            } else {
                // Candlestick chart
                const ohlcData = seriesData as OhlcData<Time>;
                setTooltipData({
                    visible: true,
                    x: param.point.x,
                    y: coordinate,
                    time: timeStr,
                    price: ohlcData.close,
                    open: ohlcData.open,
                    high: ohlcData.high,
                    low: ohlcData.low,
                    close: ohlcData.close,
                    volume: volumeValue
                });
            }
        });

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [timeRange, height, colors]);

    // Update series when chartType changes (preserve view state)
    const updateSeries = useCallback(() => {
        if (!chartRef.current) return;

        const chart = chartRef.current;
        const isIntraday = timeRange === '1D';
        const { areaData, candleData, volumeData, lastDiff, lastPctChange } = isIntraday ? intradayData : eodData;

        // Check if we have data to display
        if (areaData.length === 0 && candleData.length === 0) {
            return;
        }

        // Save current visible range before removing series
        let savedLogicalRange = null;
        try {
            savedLogicalRange = chart.timeScale().getVisibleLogicalRange();
        } catch {
            // Chart may not have data yet
        }

        // Remove existing series if any
        if (seriesRef.current) {
            chart.removeSeries(seriesRef.current);
            seriesRef.current = null;
        }

        // Remove volume series if exists
        if (volumeSeriesRef.current) {
            chart.removeSeries(volumeSeriesRef.current);
            volumeSeriesRef.current = null;
        }

        // For intraday data, only allow area chart (no candlestick)
        // For EOD data, allow both area and candlestick
        const effectiveChartType = isIntraday ? 'area' : chartType;

        // Add new series based on chart type
        if (effectiveChartType === 'area') {
            const areaSeries = chart.addSeries(AreaSeries, {
                lineColor: colors.line,
                topColor: colors.areaTop,
                bottomColor: colors.areaBottom,
                lineWidth: 2,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 4,
                crosshairMarkerBorderColor: colors.line,
                crosshairMarkerBackgroundColor: colors.chartBackground
            });

            try {
                areaSeries.setData(areaData);
            } catch (err) {
                console.warn('[MarketIndexChart] Error setting area data:', err);
            }
            seriesRef.current = areaSeries;

            // Add volume histogram series for area chart (same color as line, with opacity)
            const volumeSeries = chart.addSeries(HistogramSeries, {
                priceFormat: {
                    type: 'volume'
                },
                priceScaleId: 'volume',
                color: colors.line + '40' // 25% opacity - mờ mờ
            });

            // Apply volume data with same color for all bars
            const volumeWithColors: VolumeData[] = volumeData.map((vol) => ({
                ...vol,
                color: colors.line + '40' // 25% opacity
            }));

            try {
                volumeSeries.setData(volumeWithColors);
            } catch (err) {
                console.warn('[MarketIndexChart] Error setting volume data:', err);
            }
            volumeSeriesRef.current = volumeSeries;

            // Configure volume price scale (bottom 20% of chart)
            chart.priceScale('volume').applyOptions({
                scaleMargins: {
                    top: 0.8,
                    bottom: 0
                }
            });

            // Update price info from data
            if (areaData.length > 0) {
                const lastPrice = areaData[areaData.length - 1].value;
                // Sử dụng lastDiff và lastPctChange từ API thay vì tự tính
                const change = lastDiff ?? 0;
                const percent = (lastPctChange ?? 0) * 100; // Nhân 100 vì API trả về số thập phân

                setCurrentPrice(lastPrice);
                setPriceChange(parseFloat(change.toFixed(2)));
                setPercentChange(parseFloat(percent.toFixed(2)));
            }
        } else {
            const candlestickSeries = chart.addSeries(CandlestickSeries, {
                upColor: colors.upColor,
                downColor: colors.downColor,
                borderVisible: false,
                wickUpColor: colors.upColor,
                wickDownColor: colors.downColor
            });

            try {
                candlestickSeries.setData(candleData);
            } catch (err) {
                console.warn('[MarketIndexChart] Error setting candlestick data:', err);
            }
            seriesRef.current = candlestickSeries;

            // Add volume histogram series
            const volumeSeries = chart.addSeries(HistogramSeries, {
                priceFormat: {
                    type: 'volume'
                },
                priceScaleId: 'volume'
            });

            // Apply volume data with colors based on candle direction
            const volumeWithColors: VolumeData[] = volumeData.map((vol, index) => ({
                ...vol,
                color: candleData[index].close >= candleData[index].open
                    ? colors.upColor + '80'  // 50% opacity for up
                    : colors.downColor + '80' // 50% opacity for down
            }));

            try {
                volumeSeries.setData(volumeWithColors);
            } catch (err) {
                console.warn('[MarketIndexChart] Error setting volume data:', err);
            }
            volumeSeriesRef.current = volumeSeries;

            // Configure volume price scale (bottom 20% of chart)
            chart.priceScale('volume').applyOptions({
                scaleMargins: {
                    top: 0.8,
                    bottom: 0
                }
            });

            // Update price info from data
            if (candleData.length > 0) {
                const lastCandle = candleData[candleData.length - 1];
                // Sử dụng lastDiff và lastPctChange từ API thay vì tự tính
                const change = lastDiff ?? 0;
                const percent = (lastPctChange ?? 0) * 100; // Nhân 100 vì API trả về số thập phân

                setCurrentPrice(lastCandle.close);
                setPriceChange(parseFloat(change.toFixed(2)));
                setPercentChange(parseFloat(percent.toFixed(2)));
            }
        }

        // Kiểm tra xem timeRange hoặc symbol có thay đổi không
        // Nếu có, cần reset range theo timeRange đang chọn
        const isTimeRangeChanged = prevTimeRangeRef.current !== timeRange;
        const isSymbolChanged = prevSymbolRef.current !== symbol;
        // Cũng cần reset nếu chưa có saved range (lần đầu render)
        const isFirstRender = savedLogicalRangeRef.current === null && !savedLogicalRange;
        const shouldResetRange = isTimeRangeChanged || isSymbolChanged || isFirstRender;

        // Cập nhật refs
        prevTimeRangeRef.current = timeRange;
        prevSymbolRef.current = symbol;

        if (shouldResetRange) {
            // Reset range theo timeRange đang chọn (mặc định là 1Y)
            if (!isIntraday) {
                // EOD: Set visible range based on timeRange selection
                const dataLength =
                    effectiveChartType === 'area' ? areaData.length : candleData.length;
                const visibleRange = getVisibleRange(timeRange, dataLength);
                chart.timeScale().setVisibleLogicalRange(visibleRange);
            } else {
                // ITD: Always fit content to show all intraday data
                chart.timeScale().fitContent();
            }
            // Clear saved range khi reset
            savedLogicalRangeRef.current = null;
        } else if (savedLogicalRange) {
            // Chỉ data thay đổi (từ API update) -> restore saved range
            try {
                chart.timeScale().setVisibleLogicalRange(savedLogicalRange);
            } catch {
                // Fallback nếu range không hợp lệ
                if (!isIntraday) {
                    const dataLength =
                        effectiveChartType === 'area' ? areaData.length : candleData.length;
                    const visibleRange = getVisibleRange(timeRange, dataLength);
                    chart.timeScale().setVisibleLogicalRange(visibleRange);
                } else {
                    chart.timeScale().fitContent();
                }
            }
        }

        // Lưu range hiện tại vào ref để sử dụng cho lần update tiếp theo
        // Dùng setTimeout để đảm bảo chart đã render xong
        setTimeout(() => {
            try {
                if (chartRef.current) {
                    savedLogicalRangeRef.current = chartRef.current.timeScale().getVisibleLogicalRange();
                }
            } catch {
                // Ignore
            }
        }, 0);
    }, [chartType, timeRange, symbol, colors, isDarkMode, eodData, intradayData]);

    // Combined effect: Initialize chart AND update series when data arrives
    useEffect(() => {
        // Initialize chart if not exists
        if (!chartRef.current && chartContainerRef.current) {
            initChart();
        }

        // Check if we have data to display
        const isIntraday = timeRange === '1D';
        const { areaData, candleData } = isIntraday ? intradayData : eodData;

        if (areaData.length === 0 && candleData.length === 0) {
            return;
        }

        // Update series if chart is ready
        if (chartRef.current) {
            updateSeries();
        }

        return () => {
            // Cleanup only on unmount or when timeRange changes
        };
    }, [initChart, updateSeries, timeRange, eodData, intradayData]);

    // Update chart colors when theme changes (without recreating chart)
    useEffect(() => {
        if (!chartRef.current) return;

        const chart = chartRef.current;
        const isIntraday = timeRange === '1D';

        // Update chart layout and grid colors
        chart.applyOptions({
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: colors.textSecondary
            },
            grid: {
                vertLines: { color: colors.gridColor, style: LineStyle.Solid },
                horzLines: { color: colors.gridColor, style: LineStyle.Solid }
            },
            crosshair: {
                vertLine: {
                    color: colors.crosshairColor,
                    width: 1,
                    style: LineStyle.Dashed
                },
                horzLine: {
                    color: colors.crosshairColor,
                    width: 1,
                    style: LineStyle.Dashed
                }
            },
            rightPriceScale: {
                borderColor: colors.borderColor
            },
            timeScale: {
                borderColor: colors.borderColor,
                timeVisible: isIntraday // Cập nhật timeVisible khi đổi timeRange
            }
        });

        // Update series colors
        if (seriesRef.current) {
            const effectiveChartType = isIntraday ? 'area' : chartType;

            if (effectiveChartType === 'area') {
                (seriesRef.current as ISeriesApi<'Area'>).applyOptions({
                    lineColor: colors.line,
                    topColor: colors.areaTop,
                    bottomColor: colors.areaBottom,
                    crosshairMarkerBorderColor: colors.line,
                    crosshairMarkerBackgroundColor: colors.chartBackground
                });
            } else {
                (seriesRef.current as ISeriesApi<'Candlestick'>).applyOptions({
                    upColor: colors.upColor,
                    downColor: colors.downColor,
                    wickUpColor: colors.upColor,
                    wickDownColor: colors.downColor
                });
            }
        }

        // Update volume series colors
        if (volumeSeriesRef.current) {
            const { candleData, volumeData } = isIntraday ? intradayData : eodData;
            const effectiveChartType = isIntraday ? 'area' : chartType;

            try {
                if (effectiveChartType === 'area') {
                    // Area chart: single color with opacity
                    const volumeWithColors: VolumeData[] = volumeData.map((vol) => ({
                        ...vol,
                        color: colors.line + '40'
                    }));
                    volumeSeriesRef.current.setData(volumeWithColors);
                } else {
                    // Candlestick chart: colors based on direction
                    const volumeWithColors: VolumeData[] = volumeData.map((vol, index) => ({
                        ...vol,
                        color: candleData[index].close >= candleData[index].open
                            ? colors.upColor + '80'
                            : colors.downColor + '80'
                    }));
                    volumeSeriesRef.current.setData(volumeWithColors);
                }
            } catch (err) {
                console.warn('[MarketIndexChart] Error updating volume colors:', err);
            }
        }
    }, [colors, isDarkMode, chartType, timeRange, eodData, intradayData]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
                seriesRef.current = null;
                volumeSeriesRef.current = null;
            }
        };
    }, []);

    const handleTimeRangeChange = (
        _event: React.MouseEvent<HTMLElement>,
        newRange: TimeRange | null
    ) => {
        if (newRange !== null) {
            onTimeRangeChange(newRange);
        }
    };

    const handleChartTypeChange = (type: ChartType) => {
        setChartType(type);
    };

    const handleFullscreen = () => {
        setIsFullscreen((prev) => !prev);
    };

    // Resize chart when fullscreen changes
    useEffect(() => {
        if (chartRef.current && chartContainerRef.current) {
            setTimeout(() => {
                chartRef.current?.applyOptions({
                    width: chartContainerRef.current!.clientWidth,
                    height: isFullscreen ? window.innerHeight : height
                });
            }, 50);
        }
    }, [isFullscreen, height]);

    // Handle ESC key to exit fullscreen
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullscreen]);

    const isPositive = priceChange >= 0;

    // Calculate total component height (header + controls + chart)
    const headerHeight = 78; // ~78px for header (price info + title)
    const controlsHeight = 48; // ~48px for controls
    const totalHeight = headerHeight + controlsHeight + height;

    return (
        <Box
            sx={{
                width: '100%',
                minHeight: totalHeight, // Fixed minimum height to prevent layout shift
            }}
        >
            {/* Header with price info */}
            <Box sx={{ mb: 2, height: headerHeight }}>
                {isLoading ? (
                    // Loading skeleton for header
                    <>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Box sx={{ width: 120, height: 32, bgcolor: colors.buttonBackground, borderRadius: 1 }} />
                            <Box sx={{ width: 60, height: 24, bgcolor: colors.buttonBackground, borderRadius: 1 }} />
                            <Box sx={{ width: 80, height: 24, bgcolor: colors.buttonBackground, borderRadius: 2 }} />
                        </Stack>
                        <Box sx={{ width: 150, height: 20, bgcolor: colors.buttonBackground, borderRadius: 1, mt: 0.5 }} />
                    </>
                ) : (
                    <>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Typography
                                variant="h4"
                                sx={{
                                    fontWeight: fontWeight.bold,
                                    color: colors.textPrimary,
                                    fontSize: getResponsiveFontSize('h3')
                                }}
                            >
                                {currentPrice.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })}
                            </Typography>
                            <Typography
                                sx={{
                                    color: isPositive ? colors.upColor : colors.downColor,
                                    fontWeight: fontWeight.bold,
                                    fontSize: getResponsiveFontSize('lg')
                                }}
                            >
                                {isPositive ? '+' : ''}
                                {priceChange.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })}
                            </Typography>
                            <Chip
                                label={`${isPositive ? '▲' : '▼'} ${Math.abs(percentChange).toFixed(2)}%`}
                                size="small"
                                sx={{
                                    backgroundColor: isPositive ? colors.upColor : colors.downColor,
                                    color: '#ffffff',
                                    fontWeight: fontWeight.bold,
                                    fontSize: getResponsiveFontSize('md'),
                                    height: 24
                                }}
                            />
                        </Stack>
                        <Typography
                            sx={{
                                color: colors.textSecondary,
                                fontSize: getResponsiveFontSize('md'),
                                mt: 0.5
                            }}
                        >
                            {title}
                        </Typography>
                    </>
                )}
            </Box>

            {/* Controls */}
            {/* Controls */}
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
                    options={['1D', '1M', '3M', '1Y', 'ALL']}
                    // getLabel={(option) => option === 'ALL' ? 'Tất cả' : option}
                    sx={{
                        '& .MuiToggleButton-root': {
                            color: colors.buttonText,
                            border: 'none',
                            height: 32,
                            px: 1.5,
                            fontSize: getResponsiveFontSize('md'),
                            backgroundColor: colors.buttonBackground,
                            '&:hover': {
                                backgroundColor: colors.buttonBackground
                            },
                            '&.Mui-selected': {
                                backgroundColor: colors.buttonBackground,
                                color: colors.buttonBackgroundActive
                            }
                        }
                    }}
                />

                {/* Chart type and fullscreen buttons */}
                <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent="flex-end"
                    sx={{
                        flexGrow: { xs: 1, sm: 0 } // Fill remaining space on mobile if needed
                    }}
                >
                    {/* Chart type toggle group */}
                    <ToggleButtonGroup
                        value={timeRange === '1D' ? 'area' : chartType}
                        exclusive
                        onChange={(_event, newType) => {
                            if (newType !== null && timeRange !== '1D') {
                                handleChartTypeChange(newType);
                            }
                        }}
                        size="small"
                        sx={{
                            borderRadius: 2,
                            overflow: 'hidden',
                            '& .MuiToggleButton-root': {
                                color: colors.buttonText,
                                border: 'none',
                                height: 32,
                                px: 1,
                                minWidth: 40,
                                backgroundColor: colors.buttonBackground,
                                '&:hover': {
                                    backgroundColor: colors.buttonBackground
                                },
                                '&.Mui-selected': {
                                    backgroundColor: colors.buttonBackground,
                                    color: colors.buttonBackgroundActive
                                },
                                '&.Mui-disabled': {
                                    color: colors.buttonText,
                                    opacity: 0.4
                                }
                            }
                        }}
                    >
                        <ToggleButton value="area">
                            <ShowChartIcon fontSize="small" />
                        </ToggleButton>
                        <ToggleButton value="candlestick" disabled={timeRange === '1D'}>
                            <CandlestickChartIcon fontSize="small" />
                        </ToggleButton>
                    </ToggleButtonGroup>

                    {/* Fullscreen button */}
                    <IconButton
                        onClick={handleFullscreen}
                        sx={{
                            color: isFullscreen ? colors.buttonBackgroundActive : colors.buttonText,
                            backgroundColor: colors.buttonBackground,
                            border: 'none',
                            borderRadius: 2,
                            height: 32,
                            width: 32,
                            padding: 0,
                        }}
                    >
                        {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
                    </IconButton>
                </Stack>
            </Stack>

            {/* Chart container */}
            <Box
                onClick={() => {
                    if (chartRef.current) {
                        chartRef.current.applyOptions({
                            handleScroll: {
                                mouseWheel: true,
                                pressedMouseMove: true,
                                horzTouchDrag: true,
                                vertTouchDrag: false
                            },
                            handleScale: {
                                axisPressedMouseMove: true,
                                mouseWheel: true,
                                pinch: true
                            }
                        });
                    }
                }}
                onMouseLeave={() => {
                    setTooltipData(null);
                    if (chartRef.current) {
                        chartRef.current.applyOptions({
                            handleScroll: {
                                mouseWheel: false,
                                pressedMouseMove: false,
                                horzTouchDrag: false,
                                vertTouchDrag: false
                            },
                            handleScale: {
                                axisPressedMouseMove: false,
                                mouseWheel: false,
                                pinch: false
                            }
                        });
                    }
                }}
                sx={{
                    width: '100%',
                    height: isFullscreen ? '100vh' : height,
                    borderRadius: isFullscreen ? 0 : 1,
                    overflow: 'hidden',
                    position: 'relative',
                    ...(isFullscreen && {
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        zIndex: zIndex.max,
                        backgroundColor: colors.containerBackground
                    })
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
                        <Typography color="text.secondary">Đang tải dữ liệu biểu đồ...</Typography>
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

                {/* Actual chart container */}
                <Box
                    ref={chartContainerRef}
                    sx={{
                        width: '100%',
                        height: '100%',
                    }}
                />

                {/* Tooltip at intersection point */}
                {tooltipData && tooltipData.visible && (
                    <Box
                        ref={tooltipRef}
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
                            boxShadow: 'none',
                            transform: tooltipData.x > (chartContainerRef.current?.clientWidth || 0) - 150
                                ? 'translateX(-100%) translateX(-30px)'
                                : 'none',
                        }}
                    >
                        <Typography
                            sx={{
                                fontSize: getResponsiveFontSize('sm'),
                                color: colors.textSecondary,
                                mb: 0.5,
                                fontWeight: fontWeight.medium
                            }}
                        >
                            {tooltipData.time}
                        </Typography>

                        {tooltipData.open !== undefined ? (
                            // Candlestick tooltip
                            <Box>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.textSecondary, minWidth: 20 }}>
                                        O:
                                    </Typography>
                                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.textPrimary, fontWeight: fontWeight.medium }}>
                                        {tooltipData.open?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.textSecondary, minWidth: 20 }}>
                                        H:
                                    </Typography>
                                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.upColor, fontWeight: fontWeight.medium }}>
                                        {tooltipData.high?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.textSecondary, minWidth: 20 }}>
                                        L:
                                    </Typography>
                                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.downColor, fontWeight: fontWeight.medium }}>
                                        {tooltipData.low?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.textSecondary, minWidth: 20 }}>
                                        C:
                                    </Typography>
                                    <Typography
                                        sx={{
                                            fontSize: getResponsiveFontSize('sm'),
                                            color: (tooltipData.close ?? 0) >= (tooltipData.open ?? 0) ? colors.upColor : colors.downColor,
                                            fontWeight: fontWeight.medium
                                        }}
                                    >
                                        {tooltipData.close?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Typography>
                                </Stack>
                                {tooltipData.volume !== undefined && (
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5, pt: 0.5, borderTop: `1px solid ${colors.borderColor}` }}>
                                        <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.textSecondary }}>
                                            KL:
                                        </Typography>
                                        <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: colors.textPrimary, fontWeight: fontWeight.medium }}>
                                            {tooltipData.volume >= 1000000
                                                ? `${(tooltipData.volume / 1000000).toFixed(2)}M`
                                                : tooltipData.volume >= 1000
                                                    ? `${(tooltipData.volume / 1000).toFixed(2)}K`
                                                    : tooltipData.volume.toLocaleString('en-US')}
                                        </Typography>
                                    </Stack>
                                )}
                            </Box>
                        ) : (
                            // Area chart tooltip
                            <Box>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography sx={{ fontSize: getResponsiveFontSize('sm').md, color: colors.textSecondary }}>
                                        Giá:
                                    </Typography>
                                    <Typography sx={{ fontSize: getResponsiveFontSize('md'), color: colors.line, fontWeight: fontWeight.medium }}>
                                        {tooltipData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Typography>
                                </Stack>
                                {tooltipData.volume !== undefined && (
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                        <Typography sx={{ fontSize: getResponsiveFontSize('sm').md, color: colors.textSecondary }}>
                                            KL:
                                        </Typography>
                                        <Typography sx={{ fontSize: getResponsiveFontSize('sm').md, color: colors.textPrimary, fontWeight: fontWeight.medium }}>
                                            {tooltipData.volume >= 1000000
                                                ? `${(tooltipData.volume / 1000000).toFixed(2)}M`
                                                : tooltipData.volume >= 1000
                                                    ? `${(tooltipData.volume / 1000).toFixed(2)}K`
                                                    : tooltipData.volume.toLocaleString('en-US')}
                                        </Typography>
                                    </Stack>
                                )}
                            </Box>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
}
