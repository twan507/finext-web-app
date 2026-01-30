'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Box, Typography, useTheme, Grid, Checkbox, CircularProgress, alpha, ToggleButton, ToggleButtonGroup, Skeleton } from '@mui/material';
import { useRouter } from 'next/navigation';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { fontSize, spacing } from 'theme/tokens';
import { apiClient } from 'services/apiClient';
import type { RawMarketData } from './MarketIndexChart';

// Dynamic import for ApexCharts to avoid SSR issues
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

// Unified Time Range options
type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'YTD';

// Cache lưu history data theo ticker để tránh fetch lại nhiều lần
type HistoryCache = Record<string, RawMarketData[]>;

interface IndustryPerformance {
    ticker: string;
    tickerName: string;
    value: number;
}

// Type cho home_today_index response (grouped by ticker)
type IndexDataByTicker = Record<string, RawMarketData[]>;

interface IndustrySectionProps {
    todayAllData: IndexDataByTicker;
    itdAllData: IndexDataByTicker;
}

export default function IndustrySection({ todayAllData, itdAllData }: IndustrySectionProps) {
    const theme = useTheme();
    const router = useRouter();

    // ========== STATE ==========
    // Tất cả ngành từ SSE (Today data)
    const [allIndustries, setAllIndustries] = useState<RawMarketData[]>([]);

    // Ngành đang được chọn để vẽ chart bên trái
    const [selectedTickers, setSelectedTickers] = useState<string[]>([]);

    // Shared Time range cho cả chart và list - Mặc định là 1W
    const [timeRange, setTimeRange] = useState<TimeRange>('1W');

    // Dữ liệu hiển thị trên chart (Line Chart)
    const [chartSeries, setChartSeries] = useState<{ name: string; data: { x: number; y: number }[] }[]>([]);

    // Mapping từ index → timestamp cho 1D mode (để format label)
    const [indexToTimestamp, setIndexToTimestamp] = useState<Map<number, number>>(new Map());

    // Dữ liệu hiển thị trên danh sách (Performance List)
    const [listSeries, setListSeries] = useState<IndustryPerformance[]>([]);

    // Loading state cho history fetching (chung)
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Cache cho history data
    const historyCacheRef = useRef<HistoryCache>({});

    // Flag để track lần đầu load
    const isInitialLoadRef = useRef(true);

    // Track if all history has been fetched
    const [hasFetchedAllHistory, setHasFetchedAllHistory] = useState(false);

    // ========== PROCESS TODAY DATA FROM PROPS ==========
    useEffect(() => {
        if (!todayAllData) return;

        // Flatten grouped data and filter for industries
        const industries: RawMarketData[] = [];
        Object.values(todayAllData).forEach(items => {
            const indItem = items.find(i => i.type === 'industry');
            if (indItem) {
                industries.push(indItem);
            }
        });

        // Sort industries by pct_change desc
        const sorted = industries.sort((a, b) => (b.pct_change || 0) - (a.pct_change || 0));
        setAllIndustries(sorted);

        // Nếu chưa có selectedTickers (lần đầu load), chọn top 5
        if (isInitialLoadRef.current && sorted.length > 0) {
            const initialTickers = sorted.slice(0, 5).map(item => item.ticker);
            isInitialLoadRef.current = false;
            setSelectedTickers(initialTickers);
        }
    }, [todayAllData]);

    // ========== FETCH HISTORY FOR A TICKER ==========
    const fetchHistoryForTicker = useCallback(async (ticker: string): Promise<RawMarketData[]> => {
        // Check cache first
        if (historyCacheRef.current[ticker]) {
            return historyCacheRef.current[ticker];
        }

        try {
            const response = await apiClient<RawMarketData[]>({
                url: '/api/v1/sse/rest/home_hist_index',
                method: 'GET',
                queryParams: { ticker },
                requireAuth: false
            });

            const history = response.data || [];
            // Cache the result
            historyCacheRef.current[ticker] = history;
            return history;
        } catch (err) {
            console.error(`[Industry History] ❌ Error fetching history for ${ticker}:`, err);
            return [];
        }
    }, []);

    // ========== HELPER: GET CUTOFF DATE ==========
    const getCutoffDate = useCallback((range: TimeRange): Date => {
        const now = new Date();
        switch (range) {
            case '1D': return now;
            case '1W': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            case '1M': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            case '3M': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            case '6M': return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
            case '1Y': return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            case 'YTD': return new Date(now.getFullYear(), 0, 1);
            default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
    }, []);

    // ========== HELPER: FILTER HISTORY BY DATE ==========
    const filterDataByTimeRange = useCallback((data: RawMarketData[], range: TimeRange): RawMarketData[] => {
        if (range === '1D') return data; // 1D usually handled separately
        const cutoffDate = getCutoffDate(range);
        return data.filter(item => new Date(item.date) >= cutoffDate);
    }, [getCutoffDate]);


    // ========== EFFECT: FETCH ALL HISTORY WHEN NEEDED ==========
    useEffect(() => {
        const fetchAllHistory = async () => {
            if (timeRange === '1D') return;
            if (allIndustries.length === 0 || hasFetchedAllHistory) return;

            setIsLoadingHistory(true);
            try {
                const tickersToFetch = allIndustries.map(i => i.ticker).filter(t => !historyCacheRef.current[t]);
                if (tickersToFetch.length > 0) {
                    await Promise.all(tickersToFetch.map(t => fetchHistoryForTicker(t)));
                }
                setHasFetchedAllHistory(true);
            } catch (e) {
                console.error("Error fetching all histories", e);
            } finally {
                setIsLoadingHistory(false);
            }
        };

        fetchAllHistory();
    }, [timeRange, allIndustries, hasFetchedAllHistory, fetchHistoryForTicker]);


    // ========== BUILD LIST SERIES (Right Side) ==========
    useEffect(() => {
        if (allIndustries.length === 0) return;

        // CASE 1: 1D -> Use today data direct from allIndustries (which is derived from todayAllData)
        if (timeRange === '1D') {
            const listData = allIndustries.map(ind => ({
                ticker: ind.ticker,
                tickerName: ind.ticker_name || ind.ticker,
                value: (ind.pct_change || 0) * 100
            })).sort((a, b) => b.value - a.value);
            setListSeries(listData);
            return;
        }

        // CASE 2: History ranges - Đợi history được fetch xong
        // Nếu chưa fetch history, không tính toán (sẽ hiện loading)
        if (!hasFetchedAllHistory) {
            return;
        }

        const cutoffDate = getCutoffDate(timeRange);
        const listData: IndustryPerformance[] = [];

        for (const ind of allIndustries) {
            const history = historyCacheRef.current[ind.ticker] || [];
            if (history.length === 0) {
                // Fallback to today if no history? Or just 0
                listData.push({
                    ticker: ind.ticker,
                    tickerName: ind.ticker_name || ind.ticker,
                    value: 0
                });
                continue;
            }

            // Merge today
            let fullData = [...history];
            // ... merging logic ...
            // Simplified merge if dates match/don't match
            const lastHistDate = history[history.length - 1].date;
            if (ind.date !== lastHistDate) {
                fullData.push(ind);
            } else {
                fullData[fullData.length - 1] = ind;
            }
            fullData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            // Filter
            const filtered = fullData.filter(d => new Date(d.date) >= cutoffDate);

            // Calculate Sum of PctChange
            // NOTE: Simple summation of daily % is standard approximation for performance over period in this context
            let sumPct = 0;
            if (filtered.length >= 2) {
                filtered.forEach(item => {
                    const val = item.pct_change || 0;
                    sumPct += (Math.abs(val) < 1 ? val * 100 : val);
                });
            } else if (filtered.length === 1) {
                // If only 1 data point in range, just take its change? Or 0?
                // Usually 0 change if start == end, but let's take its daily change if it's today
                const val = filtered[0].pct_change || 0;
                sumPct = (Math.abs(val) < 1 ? val * 100 : val);
            }

            listData.push({
                ticker: ind.ticker,
                tickerName: ind.ticker_name || ind.ticker,
                value: parseFloat(sumPct.toFixed(2))
            });
        }

        setListSeries(listData.sort((a, b) => b.value - a.value));

    }, [timeRange, allIndustries, getCutoffDate, hasFetchedAllHistory]);


    // ========== BUILD CHART SERIES (Left Side) ==========
    useEffect(() => {
        const updateChart = async () => {
            if (selectedTickers.length === 0) {
                setChartSeries([]);
                return;
            }

            // CASE 1: 1D -> Use ITD Data prop với index mapping (loại bỏ gap nghỉ trưa)
            if (timeRange === '1D') {
                // Thu thập tất cả timestamps unique từ tất cả tickers
                const allTimestamps = new Set<number>();
                selectedTickers.forEach(ticker => {
                    const itdItems = itdAllData[ticker] || [];
                    itdItems.forEach(item => {
                        const d = new Date(item.date);
                        // Dữ liệu từ API là UTC, thêm 7h để chuyển sang VN time
                        const vnTimestamp = d.getTime() + 7 * 60 * 60 * 1000;
                        allTimestamps.add(vnTimestamp);
                    });
                });

                // Sort và tạo mapping: timestamp → index (liên tục, không gap)
                const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
                const timestampToIndex = new Map<number, number>();
                const idxToTs = new Map<number, number>();

                sortedTimestamps.forEach((ts, index) => {
                    timestampToIndex.set(ts, index);
                    idxToTs.set(index, ts);
                });

                // Lưu mapping để formatter sử dụng
                setIndexToTimestamp(idxToTs);

                // Build series với x là index (liên tục)
                const newSeries = selectedTickers.map(ticker => {
                    const itdItems = itdAllData[ticker] || [];
                    const todayItem = allIndustries.find(i => i.ticker === ticker);
                    const tickerName = todayItem?.ticker_name || ticker;

                    if (itdItems.length === 0) {
                        return { name: tickerName, data: [] };
                    }

                    const dataPoints = itdItems
                        .map(item => {
                            const d = new Date(item.date);
                            const vnTimestamp = d.getTime() + 7 * 60 * 60 * 1000;
                            const index = timestampToIndex.get(vnTimestamp) ?? 0;
                            return {
                                x: index,
                                y: (item.pct_change || 0) * 100
                            };
                        })
                        .sort((a, b) => a.x - b.x);

                    return { name: tickerName, data: dataPoints };
                });
                setChartSeries(newSeries);
                return;
            }

            // Clear mapping khi không phải 1D
            setIndexToTimestamp(new Map());

            // CASE 2: History -> Use cached data (fetched by separate effect)
            const results = selectedTickers.map((ticker) => {
                const history = historyCacheRef.current[ticker] || [];
                const todayItem = allIndustries.find(i => i.ticker === ticker);
                const tickerName = todayItem?.ticker_name || ticker;

                // Merge
                let fullData = [...history];
                if (todayItem) {
                    const lastHistDate = history.length > 0 ? history[history.length - 1].date : '';
                    if (todayItem.date !== lastHistDate) {
                        fullData.push(todayItem);
                    } else if (fullData.length > 0) {
                        fullData[fullData.length - 1] = todayItem;
                    }
                }
                fullData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                // Filter
                const filtered = filterDataByTimeRange(fullData, timeRange);

                // Cumulative
                let cumulative = 0;
                const dataPoints = filtered.map((item) => {
                    const pctRaw = item.pct_change || 0;
                    // For history, simple addition of %
                    const pct = Math.abs(pctRaw) < 1 ? pctRaw * 100 : pctRaw;
                    cumulative += pct;
                    return {
                        x: new Date(item.date).getTime(),
                        y: parseFloat(cumulative.toFixed(2))
                    };
                });

                // Normalize start to 0
                if (dataPoints.length > 0) {
                    const baseVal = dataPoints[0].y;
                    const normalized = dataPoints.map(p => ({
                        ...p,
                        y: parseFloat((p.y - baseVal).toFixed(2))
                    }));
                    return { name: tickerName, data: normalized };
                }

                return { name: tickerName, data: dataPoints };
            });

            setChartSeries(results);
        };

        updateChart();
    }, [timeRange, selectedTickers, itdAllData, allIndustries, filterDataByTimeRange, hasFetchedAllHistory]);


    // ========== HANDLERS ==========
    const handleToggleIndustry = (ticker: string) => {
        setSelectedTickers(prev => {
            if (prev.includes(ticker)) return prev.filter(t => t !== ticker);
            return [...prev, ticker];
        });
    };

    const handleTimeRangeChange = (_event: React.MouseEvent<HTMLElement>, newRange: TimeRange | null) => {
        if (newRange !== null) setTimeRange(newRange);
    };

    // ========== CHART OPTIONS ==========
    // Format date label cho trục x
    const formatDateLabel = useCallback((timestamp: number, range: TimeRange): string => {
        const date = new Date(timestamp);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear().toString().slice(-2);
        const monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
        const monthName = monthNames[date.getMonth()];

        switch (range) {
            case '1W':
            case '1M':
            case '3M':
                return `${day}/${month}`;
            case '6M':
            case '1Y':
            case 'YTD':
                return `${day} ${monthName}`;
            default:
                return `${day}/${month}/${year}`;
        }
    }, []);

    const getXAxisConfig = useCallback((): ApexXAxis => {
        const baseConfig: ApexXAxis = {
            tooltip: { enabled: false },
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: {
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: fontSize.sm.tablet
                },
                rotate: 0,
                hideOverlappingLabels: true,
                offsetX: 0,
                offsetY: 0
            }
        };

        if (timeRange === '1D') {
            // 1D: Sử dụng numeric axis với index, formatter convert index → timestamp → HH:mm
            return {
                ...baseConfig,
                type: 'numeric',
                tickAmount: 6,
                labels: {
                    ...baseConfig.labels,
                    formatter: (value: string) => {
                        const index = Math.round(parseFloat(value));
                        if (isNaN(index)) return '';
                        const ts = indexToTimestamp.get(index);
                        if (!ts) return '';
                        const d = new Date(ts);
                        // Sử dụng getUTCHours/getUTCMinutes vì timestamp đã được cộng 7h
                        const hours = d.getUTCHours().toString().padStart(2, '0');
                        const minutes = d.getUTCMinutes().toString().padStart(2, '0');
                        return `${hours}:${minutes}`;
                    }
                }
            };
        }

        // Các khung lớn hơn: Sử dụng numeric axis với custom formatter
        let tickAmount = 6;
        if (timeRange === '1W') tickAmount = 7;

        return {
            ...baseConfig,
            type: 'numeric',
            tickAmount,
            labels: {
                ...baseConfig.labels,
                formatter: (value: string) => {
                    const numValue = parseFloat(value);
                    if (isNaN(numValue)) return '';
                    return formatDateLabel(numValue, timeRange);
                }
            }
        };
    }, [timeRange, theme.palette.text.secondary, formatDateLabel, indexToTimestamp]);

    const chartOptions: ApexCharts.ApexOptions = useMemo(() => ({
        chart: {
            type: 'line',
            background: 'transparent',
            toolbar: { show: false },
            zoom: { enabled: false },
            fontFamily: 'inherit',
            animations: { enabled: true, speed: 300, dynamicAnimation: { enabled: true, speed: 150 } },
            redrawOnParentResize: true,
            dropShadow: {
                enabled: false
            }
        },
        grid: {
            padding: {
                left: 30,
                right: 20,
                bottom: 5
            },
            borderColor: theme.palette.divider,
            strokeDashArray: 0,
            xaxis: {
                lines: { show: false }
            },
            yaxis: {
                lines: { show: true }
            }
        },
        theme: { mode: theme.palette.mode },
        colors: [
            theme.palette.primary.main, theme.palette.secondary.main, theme.palette.success.main,
            theme.palette.warning.main, theme.palette.info.main,
            '#FF4560', '#775DD0', '#00E396', '#FEB019'
        ],
        stroke: {
            width: 2,
            curve: 'smooth'
        },
        xaxis: getXAxisConfig(),
        yaxis: {
            opposite: true, // Hiển thị bên trái
            labels: {
                formatter: (val) => `${val.toFixed(1)}%`,
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: fontSize.sm.tablet
                },
                offsetX: -10, // Thêm offset để text không bị cắt
            },
        },
        legend: { show: false },
        tooltip: {
            enabled: true,
            shared: true,
            intersect: false,
            custom: function ({ series, seriesIndex, dataPointIndex, w }) {
                const xValue = w.globals.seriesX[seriesIndex][dataPointIndex];

                // Format date/time based on timeRange
                let dateStr = '';
                if (timeRange === '1D') {
                    const index = Math.round(xValue);
                    const ts = indexToTimestamp.get(index);
                    if (ts) {
                        const d = new Date(ts);
                        const hours = d.getUTCHours().toString().padStart(2, '0');
                        const minutes = d.getUTCMinutes().toString().padStart(2, '0');
                        dateStr = `${hours}:${minutes}`;
                    }
                } else {
                    const date = new Date(xValue);
                    const day = date.getDate().toString().padStart(2, '0');
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const year = date.getFullYear();
                    dateStr = `${day}/${month}/${year}`;
                }

                // Build series HTML
                let seriesHTML = '';
                series.forEach((seriesData: any, idx: number) => {
                    const value = seriesData[dataPointIndex];
                    if (value !== null && value !== undefined) {
                        const seriesName = w.globals.seriesNames[idx];
                        const color = w.globals.colors[idx];
                        const formattedValue = `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

                        seriesHTML += `
                            <div style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
                                <span style="width: 10px; height: 10px; border-radius: 50%; background: ${color};"></span>
                                <span style="flex: 1; font-size: 12px;">${seriesName}:</span>
                                <span style="font-weight: 600; font-size: 12px;">${formattedValue}</span>
                            </div>
                        `;
                    }
                });

                const bgColor = theme.palette.mode === 'dark' ? 'rgba(26, 26, 26, 0.9)' : 'rgba(255, 255, 255, 0.9)';
                const textColor = theme.palette.mode === 'dark' ? '#e0e0e0' : '#333333';

                return `
                    <div style="
                        background: ${bgColor};
                        border: none;
                        border-radius: 6px;
                        padding: 12px;
                        color: ${textColor};
                        min-width: 200px;
                        box-shadow: none !important;
                        filter: none !important;
                        -webkit-box-shadow: none !important;
                        -moz-box-shadow: none !important;
                    ">
                        <div style="font-weight: 600; margin-bottom: 8px; font-size: 13px; color: ${textColor};">
                            ${dateStr}
                        </div>
                        ${seriesHTML}
                    </div>
                `;
            }
        },
        markers: {
            size: 0,
            hover: { size: 4 }
        }
    }), [theme, timeRange, getXAxisConfig, indexToTimestamp]);

    // Helper for Bar Width
    const maxListValue = useMemo(() => {
        if (listSeries.length === 0) return 0;
        return Math.max(...listSeries.map(i => Math.abs(i.value)));
    }, [listSeries]);

    return (
        <Box>
            {/* Header: Title Only */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box
                    onClick={() => router.push('/sectors')}
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        mb: spacing.xs,
                    }}
                >
                    <Typography variant="h1">Nhóm ngành</Typography>
                    <ChevronRightIcon sx={{ fontSize: fontSize.h2.tablet, mt: 1, color: theme.palette.text.secondary }} />
                </Box>
            </Box>

            {/* SEPARATE TOOLBAR SECTION for Time Toggles (Above Content) */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
                <ToggleButtonGroup
                    value={timeRange}
                    exclusive
                    onChange={handleTimeRangeChange}
                    size="small"
                    sx={{
                        borderRadius: 2,
                        overflow: 'hidden',
                        '& .MuiToggleButton-root': {
                            color: (theme.palette as any).component?.chart?.buttonText || theme.palette.text.secondary,
                            border: 'none',
                            px: 1.5,
                            py: 0.5,
                            fontSize: fontSize.base.tablet,
                            backgroundColor: (theme.palette as any).component?.chart?.buttonBackground || alpha(theme.palette.action.active, 0.05),
                            '&:hover': {
                                backgroundColor: (theme.palette as any).component?.chart?.buttonBackground || alpha(theme.palette.action.active, 0.1)
                            },
                            '&.Mui-selected': {
                                backgroundColor: (theme.palette as any).component?.chart?.buttonBackground || alpha(theme.palette.action.active, 0.05),
                                color: (theme.palette as any).component?.chart?.buttonBackgroundActive || theme.palette.primary.main
                            }
                        }
                    }}
                >
                    <ToggleButton value="1D">1D</ToggleButton>
                    <ToggleButton value="1W">1W</ToggleButton>
                    <ToggleButton value="1M">1M</ToggleButton>
                    <ToggleButton value="3M">3M</ToggleButton>
                    <ToggleButton value="6M">6M</ToggleButton>
                    <ToggleButton value="1Y">1Y</ToggleButton>
                    <ToggleButton value="YTD">YTD</ToggleButton>
                </ToggleButtonGroup>
            </Box>

            <Grid container spacing={3} sx={{ alignItems: 'stretch' }}>

                {/* LEFT: LIST (Checkbox List) */}
                <Grid size={{ xs: 12, md: 5, lg: 4 }} sx={{ display: 'flex' }}>
                    <Box sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 350,
                    }}>
                        {/* List Items */}
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5, overflowY: 'auto' }}>
                            {(listSeries.length === 0 || (timeRange !== '1D' && isLoadingHistory)) ? (
                                // Skeleton loading cho list
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    {[...Array(10)].map((_, i) => (
                                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 0.5 }}>
                                            <Skeleton variant="rectangular" width={20} height={20} sx={{ borderRadius: 0.5 }} />
                                            <Skeleton variant="text" width={140} />
                                            <Skeleton variant="text" width={50} />
                                            <Skeleton variant="rectangular" sx={{ flex: 1, height: 16, borderRadius: 1 }} />
                                        </Box>
                                    ))}
                                </Box>
                            ) : (
                                listSeries.map((item) => {
                                    const isSelected = selectedTickers.includes(item.ticker);
                                    const val = item.value;
                                    const isPositive = val >= 0;
                                    const barColor = isPositive ? theme.palette.success.main : theme.palette.error.main;
                                    const widthPct = maxListValue > 0 ? (Math.abs(val) / maxListValue) * 100 : 0;

                                    return (
                                        <Box
                                            key={item.ticker}
                                            onClick={() => handleToggleIndustry(item.ticker)}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1.5,
                                                cursor: 'pointer',
                                                '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.1) },
                                                p: 0, // Reduced padding
                                                borderRadius: 1
                                            }}
                                        >
                                            <Checkbox checked={isSelected} size="small" sx={{ p: 0.5 }} />
                                            <Typography variant="body2" sx={{ width: 140, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.tickerName}>
                                                {item.tickerName}
                                            </Typography>
                                            <Typography variant="body2" sx={{ width: 50, textAlign: 'right', fontWeight: 600 }}>
                                                {(val > 0 ? '+' : '') + val.toFixed(1)}%
                                            </Typography>
                                            <Box sx={{ flex: 1 }}>
                                                <Box sx={{ height: 16, width: `${Math.max(widthPct, 1)}%`, bgcolor: barColor, borderRadius: 1, opacity: 0.8 }} />
                                            </Box>
                                        </Box>
                                    );
                                })
                            )}
                        </Box>
                    </Box>
                </Grid>

                {/* RIGHT: CHART */}
                <Grid size={{ xs: 12, md: 7, lg: 8 }} sx={{ display: 'flex' }}>
                    <Box sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 350,
                        pr: 2, // Thêm padding bên phải để text không bị cắt
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
                        }
                    }}>
                        <Box sx={{ flex: 1, position: 'relative' }}>
                            {isLoadingHistory ? (
                                // Skeleton loading cho chart
                                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1, p: 2 }}>
                                    <Skeleton variant="rectangular" width="100%" height="85%" sx={{ borderRadius: 1 }} />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                                        {[...Array(6)].map((_, i) => (
                                            <Skeleton key={i} variant="text" width={50} />
                                        ))}
                                    </Box>
                                </Box>
                            ) : chartSeries.length > 0 ? (
                                <ReactApexChart
                                    key={`chart-${timeRange}`}
                                    options={chartOptions}
                                    series={chartSeries}
                                    type="line"
                                    height="100%"
                                />
                            ) : (
                                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Typography color="text.secondary">Chọn ngành để xem biểu đồ</Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </Grid>

            </Grid>
        </Box>
    );
}
