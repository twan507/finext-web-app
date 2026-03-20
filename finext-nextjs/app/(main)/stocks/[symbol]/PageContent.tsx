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
import FinRatiosSection from '../../sectors/[sectorId]/components/Sectors/FinRatiosSection';

import type { StockData } from '../../components/marketSection/MarketVolatility';

const MarketIndexChart = dynamic(
    () => import('../../components/marketSection/MarketIndexChart').then(mod => ({ default: mod.default })),
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
    { id: 'stocks', label: 'Cổ phiếu' },
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
        const validTabs: StockTabId[] = ['cashflow', 'stocks', 'news'];
        if (tabParam && validTabs.includes(tabParam)) return tabParam;
        return 'cashflow';
    });

    // Sync activeTab when URL search param changes
    useEffect(() => {
        const validTabs: StockTabId[] = ['cashflow', 'stocks', 'news'];
        if (tabParam && validTabs.includes(tabParam) && tabParam !== activeTab) {
            setActiveTab(tabParam);
        }
    }, [tabParam]);

    const handleTabChange = (newTab: StockTabId) => {
        setActiveTab(newTab);
        router.push(`?tab=${newTab}`, { scroll: false });
    };

    const isMountedRef = useRef<boolean>(true);
    const todaySseRef = useRef<{ unsubscribe: () => void } | null>(null);

    // Lifted timeRange state for chart
    const [timeRange, setTimeRange] = useState<TimeRange>('3M');

    // ========== STATE ==========
    const [todayAllData, setTodayAllData] = useState<StockDataByTicker>(() => {
        const cached = getFromCache<RawMarketData[]>('home_today_stock');
        if (cached && Array.isArray(cached)) {
            const grouped: StockDataByTicker = {};
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

    // Intraday data (empty for stocks - using history + today only)
    const [intradayData] = useState<ChartData>(emptyChartData);

    // Loading state
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error] = useState<string | null>(null);

    // ========== REST - History Data ==========
    const { data: historyData = [], isLoading: historyLoading } = useQuery({
        queryKey: ['stock', 'history', ticker],
        queryFn: async () => {
            const response = await apiClient<RawMarketData[]>({
                url: '/api/v1/sse/rest/home_hist_stock',
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
        queryKey: ['stocks', 'hist_index_line', ticker, LINE_SESSIONS],
        queryFn: async () => {
            const response = await apiClient<RawMarketData[]>({
                url: '/api/v1/sse/rest/home_hist_stock',
                method: 'GET',
                queryParams: { ticker, limit: LINE_SESSIONS },
                requireAuth: false,
            });
            return response.data || [];
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

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
        }, { cacheTtl: 5 * 60 * 1000, useCache: true });

        return () => { isMountedRef.current = false; if (todaySseRef.current) todaySseRef.current.unsubscribe(); };
    }, []);

    // ========== REST - Finratios Stock Data ==========
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

    return (
        <Box sx={{ py: 2 }}>
            {/* Title */}
            <Box sx={{ mb: 2 }}>
                <Typography
                    variant="h1"
                    sx={{
                        fontSize: getResponsiveFontSize('h1'),
                        lineHeight: 1.2,
                    }}
                >
                    {`Cổ phiếu ${ticker}`}
                </Typography>
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
                        title={stockName}
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
                        indexName={stockName}
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
                        indexName={stockName}
                        todayAllData={todayAllData}
                        histLineTicker={histLineTicker}
                    />
                </Box>
            )}

            {activeTab === 'stocks' && (
                <Box sx={{ mt: 4 }}>
                    <StocksSection
                        ticker={ticker}
                        indexName={stockName}
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
