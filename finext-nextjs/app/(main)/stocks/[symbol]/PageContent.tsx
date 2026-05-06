'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Box, Typography, Skeleton, useTheme, alpha } from '@mui/material';

import type { RawMarketData, ChartData, TimeRange } from '../../home/components/marketSection/MarketIndexChart';
import { transformToChartData } from '../../home/components/marketSection/MarketIndexChart';
import IndexDetailPanel from '../../home/components/marketSection/IndexDetailPanel';

import { ISseRequest } from 'services/core/types';
import { sseClient } from 'services/sseClient';
import { apiClient } from 'services/apiClient';
import { getResponsiveFontSize, fontWeight, getGlassCard, borderRadius, durations, easings, transitions, layoutTokens } from 'theme/tokens';

import DongTienSection from './components/DongTienSection';
import PriceMapSection from './components/PriceMapSection';
import NewsSection from './components/NewsSection';
import StockInfoSection, { type StockInfoData } from './components/StockInfoSection';
import StockKeyMetricsPanel from './components/StockKeyMetricsPanel';
import StockFinancialsSection from './components/StockFinancialsSection';

import type { StockData } from '../../home/components/marketSection/MarketVolatility';
import { OptionalAuthWrapper } from '@/components/auth/OptionalAuthWrapper';
import { ADVANCED_AND_ABOVE, BASIC_AND_ABOVE } from '@/components/auth/features';

const MarketIndexChart = dynamic(
    () => import('../../home/components/marketSection/MarketIndexChart').then(mod => ({ default: mod.default })),
    {
        loading: () => <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />,
        ssr: false
    }
);

// Type for SSE data
type StockDataByTicker = Record<string, RawMarketData[]>;

const emptyChartData: ChartData = {
    areaData: [],
    candleData: [],
    volumeData: []
};

const LINE_SESSIONS = 20;

// ========== SUB-NAVBAR TABS CONFIG ==========
const STOCK_TABS = [
    { id: 'cashflow', label: 'Dòng tiền' },
    { id: 'pricemap', label: 'Kỹ thuật' },
    { id: 'financials', label: 'Tài Chính' },
    { id: 'news', label: 'Tin tức' },
] as const;

type StockTabId = typeof STOCK_TABS[number]['id'];

// ========== SUB-NAVBAR (full-width bleed) ==========
function SubNavbar({ activeTab, onTabChange }: {
    activeTab: StockTabId;
    onTabChange: (tab: StockTabId) => void;
}) {
    const theme = useTheme();

    return (
        <Box sx={{
            mx: { xs: 'calc(-50vw + 50%)', lg: `calc(-50vw + 50% + ${layoutTokens.compactDrawerWidth / 2}px)` },
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
            bgcolor: theme.palette.background.default,
        }}>
            <Box sx={{
                maxWidth: 1400,
                mx: 'auto',
                px: { xs: 1.5, md: 2, lg: 3 },
                display: 'flex',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
                msOverflowStyle: 'none',
            }}>
                {STOCK_TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <Box
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            sx={{
                                px: { xs: 2, md: 2.5 },
                                py: 1.5,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                position: 'relative',
                                borderBottom: isActive ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                                transition: transitions.colors,
                                '&:hover': {
                                    color: theme.palette.primary.main,
                                },
                            }}
                        >
                            <Typography sx={{
                                fontSize: getResponsiveFontSize('md'),
                                fontWeight: isActive ? fontWeight.semibold : fontWeight.medium,
                                color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                                transition: transitions.colors,
                            }}>
                                {tab.label}
                            </Typography>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}

// ========== HELPERS ==========
function mergeData(hist: RawMarketData[], today: RawMarketData[]): RawMarketData[] {
    const merged = [...hist];
    if (today.length > 0) {
        const todayItem = today[today.length - 1];
        const lastHistDate = hist.length > 0 ? hist[hist.length - 1].date : '';
        if (todayItem.date !== lastHistDate) {
            merged.push(todayItem);
        } else if (merged.length > 0) {
            merged[merged.length - 1] = todayItem;
        }
    }
    merged.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return merged;
}

function buildCumsum(data: RawMarketData[], fieldExtractor: (d: RawMarketData) => number): number[] {
    if (data.length === 0) return [];
    let cumulative = 0;
    const values = data.map(d => {
        const raw = fieldExtractor(d);
        const val = Math.abs(raw) < 1 ? raw * 100 : raw;
        cumulative += val;
        return parseFloat(cumulative.toFixed(2));
    });
    const base = values[0];
    return values.map(v => parseFloat((v - base).toFixed(2)));
}

export default function StockDetailContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const ticker = (params.symbol as string).toUpperCase();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    // Tab param from URL
    const tabParam = searchParams.get('tab') as StockTabId | null;

    // Active tab state - sync with URL
    const [activeTab, setActiveTab] = useState<StockTabId>(() => {
        const validTabs: StockTabId[] = ['cashflow', 'pricemap', 'financials', 'news'];
        if (tabParam && validTabs.includes(tabParam)) return tabParam;
        return 'cashflow';
    });

    // Sync activeTab when URL search param changes
    useEffect(() => {
        const validTabs: StockTabId[] = ['cashflow', 'pricemap', 'financials', 'news'];
        if (tabParam && validTabs.includes(tabParam) && tabParam !== activeTab) {
            setActiveTab(tabParam);
        }
    }, [tabParam]);

    const handleTabChange = (newTab: StockTabId) => {
        setActiveTab(newTab);
        router.push(`?tab=${newTab}`, { scroll: false });
    };

    // View mode toggle: 'chart' shows MarketIndexChart, 'info' shows StockFinRatiosSection
    const [viewMode, setViewMode] = useState<'chart' | 'info'>('info');

    // Dropdown state
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        if (!dropdownOpen) return;
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dropdownOpen]);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (dropdownOpen && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
        if (!dropdownOpen) {
            setSearchQuery('');
        }
    }, [dropdownOpen]);

    function handleSelectStock(selectedTicker: string) {
        setDropdownOpen(false);
        setSearchQuery('');
        if (selectedTicker !== ticker) {
            router.push(`/stocks/${selectedTicker.toUpperCase()}?tab=${activeTab}`);
        }
    }

    const isMountedRef = useRef<boolean>(true);
    const todaySseRef = useRef<{ unsubscribe: () => void } | null>(null);
    const itdSseRef = useRef<{ unsubscribe: () => void } | null>(null);

    // Lifted timeRange state for chart
    const [timeRange, setTimeRange] = useState<TimeRange>('3M');

    // ========== STATE ==========
    const [todayAllData, setTodayAllData] = useState<StockDataByTicker>({});

    // Combined EOD data
    const [eodData, setEodData] = useState<ChartData>(emptyChartData);

    // Intraday data (từ SSE home_itd_stock - cho 1D chart)
    const [intradayData, setIntradayData] = useState<ChartData>(emptyChartData);

    // Loading state
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error] = useState<string | null>(null);

    // ========== REST - History Data (lazy load) ==========
    const baseChunk = 90;
    const baseChunkRef = useRef(baseChunk);

    const [historyData, setHistoryData] = useState<RawMarketData[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [loadedBars, setLoadedBars] = useState(0);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);
    const isLoadingMoreRef = useRef(false);

    useEffect(() => {
        let cancelled = false;
        setHistoryLoading(true);
        setHistoryData([]);
        setLoadedBars(0);
        setHasMoreHistory(true);

        apiClient<RawMarketData[]>({
            url: '/api/v1/sse/rest/home_hist_stock',
            method: 'GET',
            queryParams: { ticker, limit: baseChunkRef.current },
            requireAuth: false,
        })
            .then((res) => {
                if (cancelled) return;
                const data = res.data ?? [];
                setHistoryData(data);
                setLoadedBars(data.length);
                setHasMoreHistory(data.length > 0);
                setHistoryLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                setHistoryLoading(false);
            });

        return () => { cancelled = true; };
    }, [ticker]);

    const loadMoreHistory = useCallback(() => {
        if (isLoadingMoreRef.current || !hasMoreHistory) return;
        isLoadingMoreRef.current = true;

        apiClient<RawMarketData[]>({
            url: '/api/v1/sse/rest/home_hist_stock',
            method: 'GET',
            queryParams: { ticker, limit: baseChunkRef.current, skip: loadedBars },
            requireAuth: false,
        })
            .then((res) => {
                const olderData = res.data ?? [];
                if (olderData.length > 0) {
                    setHistoryData((prev) => [...olderData, ...prev]);
                    setLoadedBars((prev) => prev + olderData.length);
                }
                if (olderData.length === 0) setHasMoreHistory(false);
                isLoadingMoreRef.current = false;
            })
            .catch(() => { isLoadingMoreRef.current = false; });
    }, [ticker, hasMoreHistory, loadedBars]);

    // Khi switch sang 1Y: tự động fetch thêm để đủ 260 bars
    useEffect(() => {
        if (timeRange !== '1Y') return;
        if (loadedBars >= 260 || !hasMoreHistory || isLoadingMoreRef.current) return;
        isLoadingMoreRef.current = true;
        const needed = 260 - loadedBars;
        apiClient<RawMarketData[]>({
            url: '/api/v1/sse/rest/home_hist_stock',
            method: 'GET',
            queryParams: { ticker, limit: needed, skip: loadedBars },
            requireAuth: false,
        })
            .then((res) => {
                const olderData = res.data ?? [];
                if (olderData.length > 0) {
                    setHistoryData((prev) => [...olderData, ...prev]);
                    setLoadedBars((prev) => prev + olderData.length);
                }
                if (olderData.length === 0) setHasMoreHistory(false);
                isLoadingMoreRef.current = false;
            })
            .catch(() => { isLoadingMoreRef.current = false; });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeRange, ticker]);

    // Derive last LINE_SESSIONS bars from already-loaded history (tránh call trùng endpoint)
    const histLineTicker = useMemo(() => historyData.slice(-LINE_SESSIONS), [historyData]);

    // ========== SSE - Today All Stocks ==========
    useEffect(() => {
        isMountedRef.current = true;
        if (todaySseRef.current) { todaySseRef.current.unsubscribe(); todaySseRef.current = null; }

        const requestProps: ISseRequest = { url: '/api/v1/sse/stream', queryParams: { keyword: 'home_today_stock' } };
        todaySseRef.current = sseClient<RawMarketData[]>(requestProps, {
            onOpen: () => { },
            onData: (receivedData) => {
                if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
                    const grouped: StockDataByTicker = {};
                    receivedData.forEach((item: RawMarketData) => {
                        const t = item.ticker;
                        if (t) { if (!grouped[t]) grouped[t] = []; grouped[t].push(item); }
                    });
                    setTodayAllData(grouped);
                }
            },
            onError: (sseError) => { if (isMountedRef.current) console.warn('[SSE Today Stock] Error:', sseError.message); },
            onClose: () => { }
        });

        return () => { isMountedRef.current = false; if (todaySseRef.current) todaySseRef.current.unsubscribe(); };
    }, []);

    // ========== SSE - ITD Stock Data (chỉ mở khi 1D) ==========
    useEffect(() => {
        if (timeRange !== '1D') {
            // Đóng SSE nếu đang mở và không ở khung 1D
            if (itdSseRef.current) { itdSseRef.current.unsubscribe(); itdSseRef.current = null; }
            setIntradayData(emptyChartData);
            return;
        }

        isMountedRef.current = true;
        if (itdSseRef.current) { itdSseRef.current.unsubscribe(); itdSseRef.current = null; }

        const requestProps: ISseRequest = {
            url: '/api/v1/sse/stream',
            queryParams: { keyword: 'home_itd_stock', ticker }
        };
        itdSseRef.current = sseClient<RawMarketData[]>(requestProps, {
            onOpen: () => { },
            onData: (receivedData) => {
                if (isMountedRef.current && receivedData && Array.isArray(receivedData) && receivedData.length > 0) {
                    setIntradayData(transformToChartData(receivedData, true));
                }
            },
            onError: (sseError) => { if (isMountedRef.current) console.warn('[SSE ITD Stock] Error:', sseError.message); },
            onClose: () => { }
        });

        return () => {
            isMountedRef.current = false;
            if (itdSseRef.current) { itdSseRef.current.unsubscribe(); itdSseRef.current = null; }
        };
    }, [ticker, timeRange]);

    // ========== REST - Finratios Stock Data (defer until chart ready) ==========
    const { data: finratiosData = [] } = useQuery({
        queryKey: ['stock', 'finratios_stock', ticker],
        queryFn: async () => {
            const response = await apiClient<any[]>({
                url: '/api/v1/sse/rest/finratios_stock',
                method: 'GET',
                queryParams: { ticker },
                requireAuth: false
            });
            return response.data || [];
        },
        enabled: !historyLoading,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // ========== REST - Stock Info (overview/business_area) ==========
    const { data: stockInfo = null } = useQuery<StockInfoData | null>({
        queryKey: ['stock', 'info_stock', ticker],
        queryFn: async () => {
            const response = await apiClient<StockInfoData[]>({
                url: '/api/v1/sse/rest/info_stock',
                method: 'GET',
                queryParams: { ticker },
                requireAuth: false,
            });
            const list = response.data || [];
            return list.length > 0 ? list[0] : null;
        },
        staleTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // ========== REST - Chart Indicator Data (for PriceMap, defer until chart ready) ==========
    const { data: chartIndicatorData = null } = useQuery({
        queryKey: ['stock', 'chart_history_data', ticker],
        queryFn: async () => {
            const response = await apiClient<any[]>({
                url: '/api/v1/sse/rest/chart_history_data',
                method: 'GET',
                queryParams: { ticker, limit: 1 },
                requireAuth: false
            });
            const data = response.data;
            if (data && Array.isArray(data) && data.length > 0) return data[data.length - 1];
            return null;
        },
        enabled: !historyLoading,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // ========== Combine History + Today -> EOD Data ==========
    useEffect(() => {
        const todayDataForTicker = todayAllData[ticker] || [];
        const hasHistoryData = !historyLoading && historyData.length > 0;

        if (!hasHistoryData) return;

        const combinedRawData = todayDataForTicker.length > 0
            ? [...historyData, ...todayDataForTicker]
            : [...historyData];
        const transformedData = transformToChartData(combinedRawData, false);
        setEodData(transformedData);
        setIsLoading(false);
    }, [historyData, todayAllData, ticker, historyLoading]);

    // Get display name for ticker
    const stockName = useMemo(() => {
        const firstRecord = historyData[0] || todayAllData[ticker]?.[0];
        return firstRecord?.ticker_name || ticker;
    }, [historyData, todayAllData, ticker]);

    // ========== CHART 1: Sức mạnh dòng tiền ==========
    const { dongTienDates, t5ScoreData, t0ScoreData } = useMemo(() => {
        const todayForTicker = todayAllData[ticker] || [];
        const todayArr: RawMarketData[] = todayForTicker.length > 0 ? [todayForTicker[todayForTicker.length - 1]] : [];
        const merged = mergeData(histLineTicker, todayArr);

        const dateLabels = merged.map(d => {
            const date = new Date(d.date);
            const dd = date.getDate().toString().padStart(2, '0');
            const mm = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${dd}-${mm}`;
        });

        return {
            dongTienDates: dateLabels,
            t5ScoreData: merged.map(d => parseFloat(((d as any)?.t5_score ?? 0).toFixed(2))),
            t0ScoreData: merged.map(d => parseFloat(((d as any)?.t0_score ?? 0).toFixed(2))),
        };
    }, [histLineTicker, todayAllData, ticker]);

    // ========== CHART 2: Tương quan ==========
    const { tuongQuanDates, tuongQuanSeries } = useMemo(() => {
        const todayForTicker = todayAllData[ticker] || [];
        const todayTickerArr: RawMarketData[] = todayForTicker.length > 0 ? [todayForTicker[todayForTicker.length - 1]] : [];
        const mergedTicker = mergeData(histLineTicker, todayTickerArr);

        const dateLabels = mergedTicker.map(d => {
            const date = new Date(d.date);
            const dd = date.getDate().toString().padStart(2, '0');
            const mm = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${dd}-${mm}`;
        });

        return {
            tuongQuanDates: dateLabels,
            tuongQuanSeries: [
                { name: `% Dòng tiền`, data: buildCumsum(mergedTicker, d => ((d as any)?.t0_score ?? 0) / 1000) },
                { name: `% Giá`, data: buildCumsum(mergedTicker, d => d.pct_change || 0) },
            ],
        };
    }, [histLineTicker, todayAllData, ticker]);

    // ========== CHART 3: Xếp hạng ==========
    const { rankingDates, marketRankData, industryRankData } = useMemo(() => {
        const todayForTicker = todayAllData[ticker] || [];
        const todayArr: RawMarketData[] = todayForTicker.length > 0 ? [todayForTicker[todayForTicker.length - 1]] : [];
        const merged = mergeData(histLineTicker, todayArr);

        const dateLabels = merged.map(d => {
            const date = new Date(d.date);
            const dd = date.getDate().toString().padStart(2, '0');
            const mm = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${dd}-${mm}`;
        });

        return {
            rankingDates: dateLabels,
            marketRankData: merged.map(d => parseFloat((((d as any)?.market_rank_pct ?? 0) * 100).toFixed(1))),
            industryRankData: merged.map(d => parseFloat((((d as any)?.industry_rank_pct ?? 0) * 100).toFixed(1))),
        };
    }, [histLineTicker, todayAllData, ticker]);

    // Derive stockData from todayAllData (reuse single SSE subscription)
    const stockData = useMemo<StockData[]>(() => {
        const allStocks: StockData[] = [];
        Object.values(todayAllData).forEach(records => {
            if (records.length > 0) {
                allStocks.push(records[records.length - 1] as unknown as StockData);
            }
        });
        return allStocks;
    }, [todayAllData]);

    // Stock list for dropdown
    const stockList = useMemo(() => {
        const list: { ticker: string; name: string }[] = [];
        Object.keys(todayAllData).forEach(t => {
            const item = todayAllData[t]?.[0] as any;
            list.push({ ticker: t, name: item?.ticker_name || t });
        });
        list.sort((a, b) => a.ticker.localeCompare(b.ticker));
        return list;
    }, [todayAllData]);

    const filteredStockList = useMemo(() => {
        if (!searchQuery.trim()) return stockList;
        const q = searchQuery.toLowerCase();
        return stockList.filter(item =>
            item.ticker.toLowerCase().includes(q)
        );
    }, [stockList, searchQuery]);

    return (
        <Box sx={{ py: 2 }}>
            {/* Title with dropdown stock selector + view mode toggle */}
            <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 2, gap: 2 }}>
                <Box ref={dropdownRef} sx={{ position: 'relative', display: 'inline-block' }}>
                <Box
                    component="button"
                    onClick={() => setDropdownOpen(prev => !prev)}
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 1,
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'text.primary',
                        '&:hover .stock-chevron': {
                            color: 'primary.main',
                        },
                    }}
                >
                    <Typography
                        variant="h1"
                        sx={{
                            fontSize: getResponsiveFontSize('h1'),
                            lineHeight: 1.2,
                            userSelect: 'none',
                        }}
                    >
                        {`Cổ phiếu ${ticker}`}
                    </Typography>
                    <Box
                        className="stock-chevron"
                        sx={{
                            fontSize: getResponsiveFontSize('h1'),
                            fontWeight: fontWeight.semibold,
                            color: 'text.secondary',
                            lineHeight: 1.2,
                            transform: dropdownOpen ? 'rotate(90deg) translateX(5px) translateY(-5px)' : 'rotate(0deg)',
                            transition: `transform ${durations.normal} ${easings.easeOut}`,
                            display: 'flex',
                            alignItems: 'center',
                        }}
                    >
                        ›
                    </Box>
                </Box>

                {/* Dropdown menu */}
                {dropdownOpen && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            left: 0,
                            zIndex: 1300,
                            minWidth: 240,
                            maxHeight: 400,
                            overflowY: 'auto',
                            borderRadius: `${borderRadius.lg}px`,
                            ...getGlassCard(isDark),
                            animation: `dropdownFadeIn ${durations.fast} ${easings.easeOut}`,
                            '@keyframes dropdownFadeIn': {
                                from: { opacity: 0, transform: 'translateY(-6px)' },
                                to: { opacity: 1, transform: 'translateY(0)' },
                            },
                        }}
                    >
                        {/* Search input */}
                        <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <Box
                                component="input"
                                ref={searchInputRef}
                                type="text"
                                placeholder="Tìm mã cổ phiếu..."
                                value={searchQuery}
                                onChange={(e: any) => setSearchQuery(e.target.value)}
                                onKeyDown={(e: any) => {
                                    if (e.key === 'Enter' && filteredStockList.length > 0) {
                                        handleSelectStock(filteredStockList[0].ticker);
                                    }
                                }}
                                autoFocus
                                sx={{
                                    width: '100%',
                                    bgcolor: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    color: 'text.primary',
                                    fontSize: getResponsiveFontSize('md'),
                                    fontFamily: 'inherit',
                                    '&::placeholder': {
                                        color: 'text.secondary',
                                        opacity: 0.7,
                                    },
                                }}
                            />
                        </Box>

                        {filteredStockList.map((item) => {
                            const isActive = item.ticker === ticker;
                            return (
                                <Box
                                    key={item.ticker}
                                    component="button"
                                    onClick={() => handleSelectStock(item.ticker)}
                                    sx={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        background: isActive
                                            ? isDark
                                                ? 'rgba(180, 126, 255, 0.15)'
                                                : 'rgba(139, 92, 246, 0.08)'
                                            : 'transparent',
                                        border: 'none',
                                        borderBottom: '1px solid',
                                        borderColor: 'divider',
                                        cursor: 'pointer',
                                        px: 2,
                                        py: 1.25,
                                        transition: `background ${durations.fastest} ${easings.easeOut}`,
                                        '&:last-child': { borderBottom: 'none' },
                                        '&:hover': {
                                            background: isDark
                                                ? 'rgba(255, 255, 255, 0.06)'
                                                : 'rgba(0, 0, 0, 0.04)',
                                        },
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            fontSize: getResponsiveFontSize('sm'),
                                            fontWeight: fontWeight.semibold,
                                            color: isActive ? 'primary.main' : 'text.secondary',
                                            lineHeight: 1.2,
                                        }}
                                    >
                                        {item.ticker}
                                    </Typography>
                                    <Typography
                                        sx={{
                                            fontSize: getResponsiveFontSize('xs'),
                                            fontWeight: isActive ? fontWeight.semibold : fontWeight.medium,
                                            color: isActive ? 'primary.main' : 'text.primary',
                                            lineHeight: 1.4,
                                            mt: 0.25,
                                        }}
                                    >
                                        {item.name}
                                    </Typography>
                                </Box>
                            );
                        })}
                    </Box>
                )}
                </Box>

                {/* View mode toggle: Thông tin / Biểu đồ — sliding pill */}
                <Box sx={{
                    position: 'relative',
                    display: 'inline-flex',
                    p: 0.5,
                    borderRadius: `${borderRadius.lg}px`,
                    ...getGlassCard(isDark),
                    flexShrink: 0,
                }}>
                    {/* Sliding active indicator */}
                    <Box
                        aria-hidden
                        sx={{
                            position: 'absolute',
                            top: 4,
                            bottom: 4,
                            left: 4,
                            width: 'calc(50% - 4px)',
                            bgcolor: theme.palette.primary.main,
                            borderRadius: `${borderRadius.md}px`,
                            transform: viewMode === 'chart' ? 'translateX(100%)' : 'translateX(0)',
                            transition: `transform ${durations.normal} ${easings.easeOut}`,
                            pointerEvents: 'none',
                            zIndex: 0,
                        }}
                    />
                    {([
                        { id: 'info', label: 'Thông tin' },
                        { id: 'chart', label: 'Biểu đồ' },
                    ] as const).map((opt) => {
                        const active = viewMode === opt.id;
                        return (
                            <Box
                                key={opt.id}
                                component="button"
                                onClick={() => setViewMode(opt.id)}
                                sx={{
                                    position: 'relative',
                                    zIndex: 1,
                                    flex: 1,
                                    px: { xs: 1.5, md: 2 },
                                    py: 0.75,
                                    border: 'none',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    bgcolor: 'transparent',
                                    color: active ? theme.palette.primary.contrastText : theme.palette.text.secondary,
                                    fontFamily: 'inherit',
                                    fontSize: getResponsiveFontSize('sm'),
                                    fontWeight: active ? fontWeight.semibold : fontWeight.medium,
                                    transition: `color ${durations.normal} ${easings.easeOut}`,
                                    whiteSpace: 'nowrap',
                                    '&:hover': {
                                        color: active ? theme.palette.primary.contrastText : theme.palette.primary.main,
                                    },
                                }}
                            >
                                {opt.label}
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            {/* ========== TOP SECTION: Chart/Info (left) + Detail Panel (right) ========== */}
            <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: { xs: 2, md: 3 },
            }}>
                {/* Left: Chart or Info (toggle controlled) */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    {viewMode === 'chart' ? (
                        <MarketIndexChart
                            key={ticker}
                            symbol={ticker}
                            title={stockName}
                            eodData={eodData}
                            intradayData={intradayData}
                            isLoading={isLoading}
                            error={error}
                            timeRange={timeRange}
                            onTimeRangeChange={setTimeRange}
                            onLoadMore={loadMoreHistory}
                        />
                    ) : (
                        <StockInfoSection
                            info={stockInfo}
                            todayData={todayAllData[ticker] || []}
                        />
                    )}
                </Box>

                {/* Tall vertical divider giữa left & right — chỉ ở info view (desktop) */}
                {viewMode === 'info' && (
                    <Box
                        sx={{
                            display: { xs: 'none', md: 'block' },
                            width: '1px',
                            bgcolor: 'divider',
                            alignSelf: 'stretch',
                            flexShrink: 0,
                        }}
                    />
                )}

                {/* Right: Detail Panel (chart view) hoặc Key Metrics (info view) */}
                <Box sx={{
                    width: { xs: '100%', md: viewMode === 'info' ? 520 : 340 },
                    flexShrink: 0,
                }}>
                    {viewMode === 'chart' ? (
                        <IndexDetailPanel
                            indexName={''}
                            todayData={todayAllData[ticker] || []}
                        />
                    ) : (
                        <StockKeyMetricsPanel
                            rawData={finratiosData}
                            todayStockData={todayAllData[ticker]?.[0]}
                        />
                    )}
                </Box>
            </Box>

            {/* ========== SUB-NAVBAR (full-width bleed) ========== */}
            <Box sx={{ mt: 4 }}>
                <SubNavbar activeTab={activeTab} onTabChange={handleTabChange} />
            </Box>

            {/* ========== TAB CONTENT: each gated individually ========== */}

            {/* Dòng tiền → ADVANCED */}
            {activeTab === 'cashflow' && (
                <OptionalAuthWrapper requireAuth={true} requiredFeatures={ADVANCED_AND_ABOVE}>
                    <Box sx={{ mt: 4 }}>
                        <DongTienSection
                            ticker={ticker}
                            historyLoading={historyLoading}
                            dongTienDates={dongTienDates}
                            t5ScoreData={t5ScoreData}
                            t0ScoreData={t0ScoreData}
                            tuongQuanDates={tuongQuanDates}
                            tuongQuanSeries={tuongQuanSeries}
                            rankingDates={rankingDates}
                            marketRankData={marketRankData}
                            industryRankData={industryRankData}
                        />
                    </Box>
                </OptionalAuthWrapper>
            )}

            {/* PTKT → ADVANCED */}
            {activeTab === 'pricemap' && (
                <OptionalAuthWrapper requireAuth={true} requiredFeatures={ADVANCED_AND_ABOVE}>
                    <Box sx={{ mt: 4 }}>
                        <PriceMapSection
                            ticker={ticker}
                            chartIndicatorData={chartIndicatorData}
                            currentPrice={todayAllData[ticker]?.[todayAllData[ticker].length - 1]?.close ?? 0}
                            currentDiff={todayAllData[ticker]?.[todayAllData[ticker].length - 1]?.diff}
                            currentPctChange={todayAllData[ticker]?.[todayAllData[ticker].length - 1]?.pct_change}
                        />
                    </Box>
                </OptionalAuthWrapper>
            )}

            {/* Tài Chính → ADVANCED */}
            {activeTab === 'financials' && (
                <OptionalAuthWrapper requireAuth={true} requiredFeatures={ADVANCED_AND_ABOVE}>
                    <Box sx={{ mt: 4 }}>
                        <StockFinancialsSection ticker={ticker} />
                    </Box>
                </OptionalAuthWrapper>
            )}

            {/* Tin tức → BASIC */}
            {activeTab === 'news' && (
                <OptionalAuthWrapper requireAuth={true} requiredFeatures={BASIC_AND_ABOVE}>
                    <Box sx={{ mt: 4 }}>
                        <NewsSection ticker={ticker} />
                    </Box>
                </OptionalAuthWrapper>
            )}
        </Box>
    );
}
