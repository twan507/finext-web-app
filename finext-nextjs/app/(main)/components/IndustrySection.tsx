'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Box, Typography, useTheme, Grid, Checkbox, CircularProgress, alpha, Skeleton, useMediaQuery } from '@mui/material';
import { useRouter } from 'next/navigation';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { getResponsiveFontSize, borderRadius, transitions, fontWeight } from 'theme/tokens';
import { apiClient } from 'services/apiClient';
import type { RawMarketData } from './MarketIndexChart';

// Dynamic import for ApexCharts to avoid SSR issues
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

// Unified Time Range options
// Unified Time Range options
type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'YTD';
import TimeframeSelector from 'components/common/TimeframeSelector';

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
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // ========== STATE ==========
    // Tất cả ngành từ SSE (Today data)
    const [allIndustries, setAllIndustries] = useState<RawMarketData[]>([]);

    // Ngành đang được chọn để vẽ chart bên trái
    const [selectedTickers, setSelectedTickers] = useState<string[]>([]);

    // Shared Time range cho cả chart và list - Mặc định là 1M
    const [timeRange, setTimeRange] = useState<TimeRange>('1M');

    // Dữ liệu hiển thị trên chart (Line Chart)
    const [chartSeries, setChartSeries] = useState<{ name: string; data: { x: number; y: number }[] }[]>([]);

    // Mapping từ index → timestamp cho 1D mode (để format label)
    const indexToTimestampRef = useRef<Map<number, number>>(new Map());

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

            // 1. Collect all raw data points first
            const allRawData: { ticker: string; tickerName: string; data: { date: string | number; value: number }[] }[] = [];

            if (timeRange === '1D') {
                // 1D Mode: Use ITD Data
                selectedTickers.forEach(ticker => {
                    const itdItems = itdAllData[ticker] || [];
                    const todayItem = allIndustries.find(i => i.ticker === ticker);
                    const tickerName = todayItem?.ticker_name || ticker;

                    if (itdItems.length > 0) {
                        const points = itdItems.map(item => ({
                            date: new Date(item.date).getTime() + 7 * 60 * 60 * 1000, // Shift to VN Time
                            value: (item.pct_change || 0) * 100
                        }));
                        allRawData.push({ ticker, tickerName, data: points });
                    } else {
                        allRawData.push({ ticker, tickerName, data: [] });
                    }
                });
            } else {
                // History Mode: Use Cached Data
                selectedTickers.forEach(ticker => {
                    const history = historyCacheRef.current[ticker] || [];
                    const todayItem = allIndustries.find(i => i.ticker === ticker);
                    const tickerName = todayItem?.ticker_name || ticker;

                    // Merge history + today
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

                    // Filter by range
                    const filtered = filterDataByTimeRange(fullData, timeRange);

                    // Calculate cumulative
                    let cumulative = 0;
                    const points = filtered.map(item => {
                        const pctRaw = item.pct_change || 0;
                        const pct = Math.abs(pctRaw) < 1 ? pctRaw * 100 : pctRaw;
                        cumulative += pct;
                        return {
                            date: new Date(item.date).getTime(),
                            value: parseFloat(cumulative.toFixed(2))
                        };
                    });

                    // Normalize start to 0
                    if (points.length > 0) {
                        const baseVal = points[0].value;
                        const normalizedPoints = points.map(p => ({
                            ...p,
                            value: parseFloat((p.value - baseVal).toFixed(2))
                        }));
                        allRawData.push({ ticker, tickerName, data: normalizedPoints });
                    } else {
                        allRawData.push({ ticker, tickerName, data: points });
                    }
                });
            }

            // 2. Build Global Index Map (Category Axis Logic)
            // Collect all unique timestamps from all series
            const allTimestamps = new Set<number>();
            allRawData.forEach(series => {
                series.data.forEach(p => allTimestamps.add(typeof p.date === 'number' ? p.date : new Date(p.date).getTime()));
            });

            // Sort timestamps
            const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

            // Map timestamp -> continuous index
            const timestampToIndex = new Map<number, number>();
            const idxToTs = new Map<number, number>();
            sortedTimestamps.forEach((ts, index) => {
                timestampToIndex.set(ts, index);
                idxToTs.set(index, ts);
            });

            // Update ref for formatter (using ref instead of state to avoid stale closure issues)
            indexToTimestampRef.current = idxToTs;

            // 3. Transform Data to use Index as X
            const finalizedSeries = allRawData.map(series => {
                const dataPoints = series.data.map(p => {
                    const ts = typeof p.date === 'number' ? p.date : new Date(p.date).getTime();
                    const index = timestampToIndex.get(ts) ?? 0;
                    return {
                        x: index,
                        y: p.value
                    };
                }).sort((a, b) => a.x - b.x);

                return { name: series.tickerName, data: dataPoints };
            });

            setChartSeries(finalizedSeries);
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
    const formatDateLabel = useCallback((timestamp: number): string => {
        const date = new Date(timestamp);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${day}/${month}`;
    }, []);

    const chartColors = useMemo(() => [
        theme.palette.primary.main,
        theme.palette.secondary.main,
        theme.palette.trend.up,
        theme.palette.trend.down,
        theme.palette.info.main,
        theme.palette.trend.ref,
        theme.palette.trend.ceil,
        theme.palette.trend.floor,
        '#FF9F40', '#4BC0C0', '#9966FF', '#C9CBCF' // Added more colors just in case
    ], [theme]);

    const getXAxisConfig = useCallback((): ApexXAxis => {
        const baseConfig: ApexXAxis = {
            tooltip: { enabled: false },
            axisBorder: { show: false },
            axisTicks: { show: false },
            crosshairs: {
                stroke: {
                    color: (theme.palette as any).component.chart.crosshair,
                    width: 1,
                    dashArray: 3,
                },
            },
            labels: {
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: getResponsiveFontSize('sm').md
                },
                rotate: 0,
                hideOverlappingLabels: true,
                offsetX: 0,
                offsetY: 0
            }
        };

        // Unified logic: X is always index, so we always look up timestamp
        let tickAmount = isMobile ? 6 : 10;
        if (timeRange === '1W') tickAmount = isMobile ? 6 : 7;

        return {
            ...baseConfig,
            type: 'numeric',
            tickAmount,
            labels: {
                ...baseConfig.labels,
                formatter: (value: string) => {
                    const index = Math.round(parseFloat(value));
                    if (isNaN(index)) return '';
                    const ts = indexToTimestampRef.current.get(index);
                    if (!ts) return '';

                    if (timeRange === '1D') {
                        const d = new Date(ts);
                        const hours = d.getUTCHours().toString().padStart(2, '0');
                        const minutes = d.getUTCMinutes().toString().padStart(2, '0');
                        return `${hours}:${minutes}`;
                    }

                    return formatDateLabel(ts);
                }
            }
        };
    }, [timeRange, theme.palette.text.secondary, formatDateLabel, isMobile]);

    const chartOptions: ApexCharts.ApexOptions = useMemo(() => {
        // Generate annotations for the last data point of each series (Price Tags)
        const yAxisAnnotations = chartSeries.map((series, index) => {
            const data = series.data;
            if (!data || data.length === 0) return null;
            const lastPoint = data[data.length - 1];
            const color = chartColors[index % chartColors.length];

            return {
                y: lastPoint.y,
                borderColor: 'transparent', // Hide the line, keep only the tag
                strokeDashArray: 0,
                label: {
                    borderColor: 'transparent',
                    style: {
                        color: '#fff',
                        background: color,
                        fontSize: getResponsiveFontSize('sm').md, // Sync with chart font size
                        fontWeight: fontWeight.medium,
                        padding: {
                            left: 6,
                            right: 6,
                            top: 2,
                            bottom: 2,
                        }
                    },
                    text: `${lastPoint.y.toFixed(1)}%`,
                    position: 'right',
                    textAnchor: 'start',
                    offsetX: 15.5,
                    offsetY: 0,
                    borderRadius: 2,
                }
            };
        }).filter(Boolean) as any[];

        return {
            chart: {
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
                    opacity: 1,
                    color: chartColors as unknown as string,
                }
            },
            annotations: {
                yaxis: yAxisAnnotations
            },
            grid: {
                padding: {
                    left: 20,
                    right: 5,
                    bottom: 0,
                    top: 0
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
            colors: chartColors,
            stroke: {
                width: 2.5,
                curve: 'smooth'
            },
            xaxis: getXAxisConfig(),
            yaxis: {
                opposite: true, // Hiển thị bên trái
                labels: {
                    formatter: (val) => `${val.toFixed(1)}%\u00A0\u00A0\u00A0`,
                    style: {
                        colors: theme.palette.text.secondary,
                        fontSize: getResponsiveFontSize('sm').md
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

                    // Unified lookup: xValue is always index
                    const index = Math.round(xValue);
                    const ts = indexToTimestampRef.current.get(index);

                    let dateStr = '';
                    if (ts) {
                        if (timeRange === '1D') {
                            const d = new Date(ts);
                            const hours = d.getUTCHours().toString().padStart(2, '0');
                            const minutes = d.getUTCMinutes().toString().padStart(2, '0');
                            dateStr = `${hours}:${minutes}`;
                        } else {
                            const date = new Date(ts);
                            const day = date.getDate().toString().padStart(2, '0');
                            const month = (date.getMonth() + 1).toString().padStart(2, '0');
                            const year = date.getFullYear();
                            dateStr = `${day}/${month}/${year}`;
                        }
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
                colors: [theme.palette.mode === 'dark' ? '#000000' : '#ffffff'], // Match background
                strokeColors: chartColors,
                strokeWidth: 2,
                hover: { size: 6 }
            }
            // Depend on chartColors in the memo
        };
    }, [theme, timeRange, getXAxisConfig, chartColors, chartSeries]);

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
                    onClick={() => router.push('/groups')}
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                    }}
                >
                    <Typography variant="h1" sx={{ fontSize: getResponsiveFontSize('h1') }}>Nhóm ngành</Typography>
                    <ChevronRightIcon sx={{ fontSize: getResponsiveFontSize('h2').md, mt: 1, color: theme.palette.text.secondary }} />
                </Box>
            </Box>

            {/* SEPARATE TOOLBAR SECTION for Time Toggles (Above Content) */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
                flexWrap: 'wrap',
                gap: 1
            }}>
                {/* Left: Deselect All */}
                <Typography
                    variant="body2"
                    onClick={() => setSelectedTickers([])}
                    sx={{
                        cursor: 'pointer',
                        color: theme.palette.text.secondary,
                        '&:hover': { color: theme.palette.text.primary, textDecoration: 'underline' }
                    }}
                >
                    Bỏ chọn tất cả
                </Typography>

                <TimeframeSelector
                    value={timeRange}
                    onChange={handleTimeRangeChange}
                    options={['1D', '1W', '1M', '3M', '6M', '1Y', 'YTD']}
                />
            </Box>

            <Grid container spacing={3} sx={{ alignItems: 'stretch' }}>

                {/* LEFT: LIST (Checkbox List) */}
                <Grid size={{ xs: 12, md: 6, lg: 5 }} sx={{ display: 'flex' }}>
                    <Box sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 350,
                    }}>
                        {/* List Items */}
                        {/* List Items */}
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25, overflowY: 'auto' }}>
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
                                    // Calculate selection and color
                                    const selectionIndex = selectedTickers.indexOf(item.ticker);
                                    const isSelected = selectionIndex !== -1;
                                    // Use the same color logic as chartSeries: color based on index in selectedTickers
                                    const dotColor = isSelected
                                        ? chartColors[selectionIndex % chartColors.length]
                                        : 'transparent';

                                    const val = item.value;
                                    const isPositive = val >= 0;
                                    const barColor = isPositive ? theme.palette.trend.up : theme.palette.trend.down;
                                    const widthPct = maxListValue > 0 ? (Math.abs(val) / maxListValue) * 100 : 0;

                                    return (
                                        <Box
                                            key={item.ticker}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1.5,
                                                p: 0.25, // Reduced padding (was 0.5)
                                                borderRadius: 2
                                            }}
                                        >
                                            {/* Custom Round "Checkbox" */}
                                            <Box
                                                onClick={() => handleToggleIndustry(item.ticker)}
                                                sx={{
                                                    width: 14,
                                                    height: 14,
                                                    borderRadius: '50%',
                                                    border: `2px solid ${isSelected ? dotColor : theme.palette.divider}`,
                                                    bgcolor: isSelected ? dotColor : 'transparent',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    flexShrink: 0
                                                }}
                                            />

                                            {/* Name with HREF placeholder handling */}
                                            <Typography
                                                component="a"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    // Placeholder for href
                                                    // console.log("Navigate to", item.ticker);
                                                }}
                                                href={`#${item.ticker}`}
                                                sx={{
                                                    fontSize: getResponsiveFontSize('md'),
                                                    flex: 1, // Allow text to take available space
                                                    fontWeight: fontWeight.medium,
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    textDecoration: 'none',
                                                    color: isSelected ? dotColor : 'inherit',
                                                    cursor: 'pointer',
                                                    '&:hover': {
                                                        textDecoration: 'underline'
                                                    }
                                                }}
                                                title={item.tickerName}
                                            >
                                                {item.tickerName}
                                            </Typography>

                                            <Typography variant="body2" sx={{ width: 50, textAlign: 'right', fontWeight: fontWeight.medium, fontSize: getResponsiveFontSize('md') }}>
                                                {(val > 0 ? '+' : '') + val.toFixed(1)}%
                                            </Typography>

                                            {/* Bar Chart Part - Increased width and height */}
                                            <Box sx={{ width: '45%', display: 'flex', alignItems: 'center' }}>
                                                <Box sx={{ height: 16, width: `${Math.max(widthPct, 1)}%`, bgcolor: barColor, borderRadius: 1 }} />
                                            </Box>
                                        </Box>
                                    );
                                })
                            )}
                        </Box>
                    </Box>
                </Grid>

                {/* RIGHT: CHART */}
                <Grid size={{ xs: 12, md: 6, lg: 7 }} sx={{ display: 'flex' }}>
                    <Box sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 350,
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
