'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Box, Typography, Skeleton, useTheme, alpha } from '@mui/material';

import type { RawMarketData, ChartData, TimeRange } from '../../components/marketSection/MarketIndexChart';
import { transformToChartData } from '../../components/marketSection/MarketIndexChart';
import IndexDetailPanel from '../../components/marketSection/IndexDetailPanel';

import { ISseRequest } from 'services/core/types';
import { sseClient, getFromCache } from 'services/sseClient';
import { apiClient } from 'services/apiClient';
import { getResponsiveFontSize, fontWeight, getGlassCard, borderRadius, durations, easings, transitions, layoutTokens } from 'theme/tokens';

import DongTienSection from './components/Sectors/DongTienSection';
import StocksSection from './components/Sectors/StocksSection';
import NewsSection from './components/Sectors/NewsSection';
import FinRatiosSection from './components/Sectors/FinRatiosSection';

import type { StockData } from '../../components/marketSection/MarketVolatility';
import { transformTrendData, type RawTrendData, type TrendChartData } from '../../markets/components/TinHieuSecion/MarketTrendChart';

const MarketIndexChart = dynamic(
    () => import('../../components/marketSection/MarketIndexChart').then(mod => ({ default: mod.default })),
    {
        loading: () => <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />,
        ssr: false
    }
);

// Type for SSE data
type IndexDataByTicker = Record<string, RawMarketData[]>;

const emptyChartData: ChartData = {
    areaData: [],
    candleData: [],
    volumeData: []
};

const LINE_SESSIONS = 20;

// ========== SUB-NAVBAR TABS CONFIG ==========
const SECTOR_TABS = [
    { id: 'cashflow', label: 'Dòng tiền' },
    { id: 'stocks', label: 'Cổ phiếu' },
    { id: 'news', label: 'Tin tức' },
] as const;

type SectorTabId = typeof SECTOR_TABS[number]['id'];

// ========== SUB-NAVBAR (full-width bleed) ==========
function SubNavbar({ activeTab, onTabChange }: {
    activeTab: SectorTabId;
    onTabChange: (tab: SectorTabId) => void;
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
                {SECTOR_TABS.map((tab) => {
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

// ========== SECTION TITLE ==========
function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <Typography
            color="text.secondary"
            sx={{
                fontSize: getResponsiveFontSize('lg'),
                fontWeight: fontWeight.semibold,
                textTransform: 'uppercase',
                mb: 1,
            }}
        >
            {children}
        </Typography>
    );
}

export default function SectorDetailContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const ticker = (params.sectorId as string).toUpperCase();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    // Tab param from URL
    const tabParam = searchParams.get('tab') as SectorTabId | null;

    // Active tab state - sync with URL
    const [activeTab, setActiveTab] = useState<SectorTabId>(() => {
        const validTabs: SectorTabId[] = ['cashflow', 'stocks', 'news'];
        if (tabParam && validTabs.includes(tabParam)) return tabParam;
        return 'cashflow';
    });

    // Sync activeTab when URL search param changes
    useEffect(() => {
        const validTabs: SectorTabId[] = ['cashflow', 'stocks', 'news'];
        if (tabParam && validTabs.includes(tabParam) && tabParam !== activeTab) {
            setActiveTab(tabParam);
        }
    }, [tabParam]);

    const handleTabChange = (newTab: SectorTabId) => {
        setActiveTab(newTab);
        router.push(`?tab=${newTab}`, { scroll: false });
    };

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

    function handleSelectSector(selectedTicker: string) {
        setDropdownOpen(false);
        setSearchQuery('');
        if (selectedTicker !== ticker) {
            router.push(`/sectors/${selectedTicker.toLowerCase()}`);
        }
    }

    // Focus search input when dropdown opens
    useEffect(() => {
        if (dropdownOpen && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
        if (!dropdownOpen) {
            setSearchQuery('');
        }
    }, [dropdownOpen]);

    const isMountedRef = useRef<boolean>(true);
    const todaySseRef = useRef<{ unsubscribe: () => void } | null>(null);
    const itdSseRef = useRef<{ unsubscribe: () => void } | null>(null);
    const trendSseRef = useRef<{ unsubscribe: () => void } | null>(null);
    const stockSseRef = useRef<{ unsubscribe: () => void } | null>(null);

    // Lifted timeRange state for chart
    const [timeRange, setTimeRange] = useState<TimeRange>('3M');

    // ========== STATE ==========
    const [todayAllData, setTodayAllData] = useState<IndexDataByTicker>(() => {
        const cached = getFromCache<RawMarketData[]>('home_today_index');
        if (cached && Array.isArray(cached)) {
            const grouped: IndexDataByTicker = {};
            cached.forEach((item: RawMarketData) => {
                const t = item.ticker;
                if (t) { if (!grouped[t]) grouped[t] = []; grouped[t].push(item); }
            });
            return grouped;
        }
        return {};
    });

    // ITD data
    const [itdAllData, setItdAllData] = useState<IndexDataByTicker>(() => {
        const cached = getFromCache<RawMarketData[]>('home_itd_index');
        if (cached && Array.isArray(cached)) {
            const grouped: IndexDataByTicker = {};
            cached.forEach((item: RawMarketData) => {
                const t = item.ticker;
                if (t) { if (!grouped[t]) grouped[t] = []; grouped[t].push(item); }
            });
            return grouped;
        }
        return {};
    });

    // Combined EOD data
    const [eodData, setEodData] = useState<ChartData>(emptyChartData);

    // Intraday data
    const [intradayData, setIntradayData] = useState<ChartData>(emptyChartData);

    // Loading state
    const [isLoading, setIsLoading] = useState<boolean>(() => {
        const todayCache = getFromCache<RawMarketData[]>('home_today_index');
        if (todayCache && Array.isArray(todayCache)) {
            const hasTodayForTicker = todayCache.some(item => item.ticker === ticker);
            return !hasTodayForTicker;
        }
        return true;
    });
    const [error] = useState<string | null>(null);

    // Dynamic industry list from today data
    const industryList = useMemo(() => {
        const list: { ticker: string; name: string }[] = [];
        todayAllData && Object.keys(todayAllData).forEach(t => {
            const item = todayAllData[t]?.[0] as any;
            if (item?.type === 'industry') {
                list.push({ ticker: t, name: item.ticker_name || t });
            }
        });
        list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        return list;
    }, [todayAllData]);

    // Filtered industry list by search
    const filteredIndustryList = useMemo(() => {
        if (!searchQuery.trim()) return industryList;
        const q = searchQuery.toLowerCase();
        return industryList.filter(item =>
            item.name.toLowerCase().includes(q) ||
            item.ticker.toLowerCase().includes(q)
        );
    }, [industryList, searchQuery]);

    // ========== REST - History Data ==========
    const { data: historyData = [], isLoading: historyLoading } = useQuery({
        queryKey: ['sector', 'history', ticker],
        queryFn: async () => {
            const response = await apiClient<RawMarketData[]>({
                url: '/api/v1/sse/rest/home_hist_index',
                method: 'GET',
                queryParams: { ticker },
                requireAuth: false
            });
            return response.data || [];
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // ========== REST - History Data for line charts ==========
    const { data: histLineTicker = [] } = useQuery({
        queryKey: ['sectors', 'hist_index_line', ticker, LINE_SESSIONS],
        queryFn: async () => {
            const response = await apiClient<RawMarketData[]>({
                url: '/api/v1/sse/rest/home_hist_index',
                method: 'GET',
                queryParams: { ticker, limit: LINE_SESSIONS },
                requireAuth: false,
            });
            return response.data || [];
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // ========== REST - History Data for VNINDEX ==========
    const { data: histLineVNINDEX = [] } = useQuery({
        queryKey: ['sectors', 'hist_index_line', 'VNINDEX', LINE_SESSIONS],
        queryFn: async () => {
            const response = await apiClient<RawMarketData[]>({
                url: '/api/v1/sse/rest/home_hist_index',
                method: 'GET',
                queryParams: { ticker: 'VNINDEX', limit: LINE_SESSIONS },
                requireAuth: false,
            });
            return response.data || [];
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // ========== REST - Trend History Data ==========
    const { data: historyTrendData = [], isLoading: historyTrendLoading } = useQuery({
        queryKey: ['sectors', 'history_trend', ticker],
        queryFn: async () => {
            const response = await apiClient<RawTrendData[]>({
                url: '/api/v1/sse/rest/home_history_trend',
                method: 'GET',
                queryParams: { ticker },
                requireAuth: false,
            });
            return response.data || [];
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // ========== SSE - Today All Indexes ==========
    useEffect(() => {
        isMountedRef.current = true;
        if (todaySseRef.current) { todaySseRef.current.unsubscribe(); todaySseRef.current = null; }

        const requestProps: ISseRequest = { url: '/api/v1/sse/stream', queryParams: { keyword: 'home_today_index' } };
        todaySseRef.current = sseClient<RawMarketData[]>(requestProps, {
            onOpen: () => { },
            onData: (receivedData) => {
                if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
                    const grouped: IndexDataByTicker = {};
                    receivedData.forEach((item: RawMarketData) => {
                        const t = item.ticker;
                        if (t) { if (!grouped[t]) grouped[t] = []; grouped[t].push(item); }
                    });
                    setTodayAllData(grouped);
                }
            },
            onError: (sseError) => { if (isMountedRef.current) console.warn('[SSE Today] Error:', sseError.message); },
            onClose: () => { }
        }, { cacheTtl: 5 * 60 * 1000, useCache: true });

        return () => { isMountedRef.current = false; if (todaySseRef.current) todaySseRef.current.unsubscribe(); };
    }, []);

    // ========== SSE - ITD All Indexes ==========
    useEffect(() => {
        isMountedRef.current = true;
        if (itdSseRef.current) { itdSseRef.current.unsubscribe(); itdSseRef.current = null; }

        const requestProps: ISseRequest = { url: '/api/v1/sse/stream', queryParams: { keyword: 'home_itd_index' } };
        itdSseRef.current = sseClient<RawMarketData[]>(requestProps, {
            onOpen: () => { },
            onData: (receivedData) => {
                if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
                    const grouped: IndexDataByTicker = {};
                    receivedData.forEach((item: RawMarketData) => {
                        const t = item.ticker;
                        if (t) { if (!grouped[t]) grouped[t] = []; grouped[t].push(item); }
                    });
                    setItdAllData(grouped);
                }
            },
            onError: (sseError) => { if (isMountedRef.current) console.warn('[SSE ITD] Error:', sseError.message); },
            onClose: () => { }
        }, { cacheTtl: 5 * 60 * 1000, useCache: true });

        return () => { isMountedRef.current = false; if (itdSseRef.current) itdSseRef.current.unsubscribe(); };
    }, []);

    // ========== SSE - Today Trend Data ==========
    const [trendTodayData, setTrendTodayData] = useState<RawTrendData[]>(() => {
        const cached = getFromCache<RawTrendData[]>('home_today_trend');
        if (cached && Array.isArray(cached)) {
            return cached.filter((item) => item.ticker === ticker);
        }
        return [];
    });

    useEffect(() => {
        isMountedRef.current = true;
        if (trendSseRef.current) { trendSseRef.current.unsubscribe(); trendSseRef.current = null; }

        const requestProps: ISseRequest = {
            url: '/api/v1/sse/stream',
            queryParams: { keyword: 'home_today_trend' },
        };

        trendSseRef.current = sseClient<RawTrendData[]>(requestProps, {
            onOpen: () => { },
            onData: (receivedData) => {
                if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
                    const filtered = receivedData.filter((item) => item.ticker === ticker);
                    setTrendTodayData(filtered);
                }
            },
            onError: (sseError) => {
                if (isMountedRef.current) console.warn('[SSE Trend] Error:', sseError.message);
            },
            onClose: () => { },
        }, { cacheTtl: 5 * 60 * 1000, useCache: true });

        return () => {
            isMountedRef.current = false;
            if (trendSseRef.current) trendSseRef.current.unsubscribe();
        };
    }, [ticker]);

    // Transform ITD data
    useEffect(() => {
        const itdDataForTicker = itdAllData[ticker] || [];
        if (itdDataForTicker.length > 0) {
            const transformedData = transformToChartData(itdDataForTicker, true);
            setIntradayData(transformedData);
        } else {
            setIntradayData(emptyChartData);
        }
    }, [itdAllData, ticker]);

    // ========== Combine History + Today -> EOD Data ==========
    useEffect(() => {
        const todayDataForTicker = todayAllData[ticker] || [];
        const hasHistoryData = !historyLoading && historyData.length > 0;
        const hasTodayData = todayDataForTicker.length > 0;

        if (!hasHistoryData || !hasTodayData) return;

        const combinedRawData = [...historyData, ...todayDataForTicker];
        const transformedData = transformToChartData(combinedRawData, false);
        setEodData(transformedData);
        setIsLoading(false);
    }, [historyData, todayAllData, ticker, historyLoading]);

    // Get display name for ticker
    const indexName = useMemo(() => {
        const firstRecord = historyData[0] || todayAllData[ticker]?.[0] || itdAllData[ticker]?.[0];
        return firstRecord?.ticker_name || ticker;
    }, [historyData, todayAllData, itdAllData, ticker]);

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

        const todayForVN = todayAllData['VNINDEX'] || [];
        const todayVNArr: RawMarketData[] = todayForVN.length > 0 ? [todayForVN[todayForVN.length - 1]] : [];
        const mergedVNINDEX = mergeData(histLineVNINDEX, todayVNArr);

        const refData = mergedTicker.length > 0 ? mergedTicker : mergedVNINDEX;
        const dateLabels = refData.map(d => {
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
                { name: `% VNINDEX`, data: buildCumsum(mergedVNINDEX, d => d.pct_change || 0) },
            ],
        };
    }, [histLineTicker, histLineVNINDEX, todayAllData, ticker]);

    // ========== CHART 3: Cấu trúc sóng ==========
    const [trendChartData, setTrendChartData] = useState<TrendChartData>({
        wTrend: [], mTrend: [], qTrend: [], yTrend: [],
    });
    const [isTrendLoading, setIsTrendLoading] = useState<boolean>(true);

    useEffect(() => {
        const hasHistory = !historyTrendLoading && historyTrendData.length > 0;
        if (!hasHistory) return;

        const combined = trendTodayData.length > 0
            ? [...historyTrendData, ...trendTodayData]
            : [...historyTrendData];
        const transformed = transformTrendData(combined);
        setTrendChartData(transformed);
        setIsTrendLoading(false);
    }, [historyTrendData, trendTodayData, historyTrendLoading]);

    // ========== REST - Finratios Industry Data ==========
    const { data: finratiosData = [] } = useQuery({
        queryKey: ['sector', 'finratios_industry', ticker],
        queryFn: async () => {
            const response = await apiClient<any[]>({
                url: '/api/v1/sse/rest/finratios_industry',
                method: 'GET',
                queryParams: { ticker },
                requireAuth: false
            });
            return response.data || [];
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // ========== SSE - Today Stock Data ==========
    const [stockData, setStockData] = useState<StockData[]>(() => {
        const cached = getFromCache<StockData[]>('home_today_stock');
        return cached && Array.isArray(cached) ? cached : [];
    });

    useEffect(() => {
        isMountedRef.current = true;
        if (stockSseRef.current) { stockSseRef.current.unsubscribe(); stockSseRef.current = null; }

        const requestProps: ISseRequest = {
            url: '/api/v1/sse/stream',
            queryParams: { keyword: 'home_today_stock' },
        };

        stockSseRef.current = sseClient<StockData[]>(requestProps, {
            onOpen: () => { },
            onData: (receivedData) => {
                if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
                    setStockData(receivedData);
                }
            },
            onError: (sseError) => {
                if (isMountedRef.current) console.warn('[SSE Stock] Error:', sseError.message);
            },
            onClose: () => { },
        }, { cacheTtl: 5 * 60 * 1000, useCache: true });

        return () => {
            isMountedRef.current = false;
            if (stockSseRef.current) stockSseRef.current.unsubscribe();
        };
    }, []);

    return (
        <Box sx={{ py: 2 }}>
            {/* Title with dropdown sector selector */}
            <Box ref={dropdownRef} sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
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
                        '&:hover .index-chevron': {
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
                        {indexName}
                    </Typography>
                    <Box
                        className="index-chevron"
                        sx={{
                            fontSize: getResponsiveFontSize('h1'),
                            fontWeight: fontWeight.semibold,
                            color: 'text.secondary',
                            lineHeight: 1.2,
                            transform: dropdownOpen ? 'rotate(90deg) translateX(5px) translateY(-5px)' : 'rotate(0deg) translateY(0)',
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
                            minWidth: 220,
                            maxHeight: 400,
                            overflowY: 'auto',
                            borderRadius: `${borderRadius.lg}px`,
                            ...getGlassCard(isDark),
                            animation: `dropdownFadeIn ${durations.fast} ${easings.easeOut}`,
                            '@keyframes dropdownFadeIn': {
                                from: { opacity: 0, transform: 'translateY(-6px)' },
                                to:   { opacity: 1, transform: 'translateY(0)' },
                            },
                        }}
                    >
                        {/* Search input */}
                        <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <Box
                                component="input"
                                ref={searchInputRef}
                                type="text"
                                placeholder="Tìm ngành..."
                                value={searchQuery}
                                onChange={(e: any) => setSearchQuery(e.target.value)}
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

                        {filteredIndustryList.map((item) => {
                            const isActive = item.ticker === ticker;
                            return (
                                <Box
                                    key={item.ticker}
                                    component="button"
                                    onClick={() => handleSelectSector(item.ticker)}
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
                                            fontSize: getResponsiveFontSize('md'),
                                            fontWeight: isActive ? fontWeight.semibold : fontWeight.medium,
                                            color: isActive ? 'primary.main' : 'text.primary',
                                            lineHeight: 1.4,
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

            {/* ========== TOP SECTION: Chart (left) + Detail Panel (right) ========== */}
            <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: { xs: 2, md: 3 },
            }}>
                {/* Left: Chart */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <MarketIndexChart
                        key={ticker}
                        symbol={ticker}
                        title={`Chỉ số ngành ${indexName}`}
                        eodData={eodData}
                        intradayData={intradayData}
                        isLoading={isLoading}
                        error={error}
                        timeRange={timeRange}
                        onTimeRangeChange={setTimeRange}
                    />

                    {/* FinRatios Section - same width as chart */}
                    <FinRatiosSection
                        ticker={ticker}
                        indexName={indexName}
                        rawData={finratiosData}
                    />
                </Box>

                {/* Right: Index Detail Panel */}
                <Box sx={{
                    width: { xs: '100%', md: 340 },
                    flexShrink: 0,
                }}>
                    <IndexDetailPanel
                        indexName={''}
                        todayData={todayAllData[ticker] || []}
                    />
                </Box>
            </Box>

            {/* ========== SUB-NAVBAR (full-width bleed) ========== */}
            <Box sx={{ mt: 4 }}>
                <SubNavbar activeTab={activeTab} onTabChange={handleTabChange} />
            </Box>

            {/* ========== TAB CONTENT ========== */}
            {activeTab === 'cashflow' && (
                <Box sx={{ mt: 4 }}>
                    <DongTienSection
                        ticker={ticker}
                        indexName={indexName}
                        todayAllData={todayAllData}
                        histLineTicker={histLineTicker}
                        histLineVNINDEX={histLineVNINDEX}
                        historyTrendData={historyTrendData}
                        trendTodayData={trendTodayData}
                        historyTrendLoading={historyTrendLoading}
                    />
                </Box>
            )}

            {activeTab === 'stocks' && (
                <Box sx={{ mt: 4 }}>
                    <StocksSection
                        ticker={ticker}
                        indexName={indexName}
                        stockData={stockData}
                    />
                </Box>
            )}

            {activeTab === 'news' && (
                <Box sx={{ mt: 4 }}>
                    <NewsSection ticker={ticker} />
                </Box>
            )}
        </Box>
    );
}
