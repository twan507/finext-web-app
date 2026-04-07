'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Box, Typography, Skeleton, useTheme, useMediaQuery, alpha } from '@mui/material';

import type { RawMarketData, ChartData, TimeRange } from '../../home/components/marketSection/MarketIndexChart';
import { transformToChartData } from '../../home/components/marketSection/MarketIndexChart';
import IndexDetailPanel from '../../home/components/marketSection/IndexDetailPanel';

import { ISseRequest } from 'services/core/types';
import { sseClient, getFromCache } from 'services/sseClient';
import { apiClient } from 'services/apiClient';
import { getResponsiveFontSize, fontWeight, getGlassCard, borderRadius, durations, easings } from 'theme/tokens';

// Reuse components
import TuongQuanDongTien from '../components/TuongQuanDongTien';
import GroupStockTable, { GroupStockRowData } from './components/GroupStockTable';
import type { StockData } from '../../home/components/marketSection/MarketVolatility';
import type { RawTrendData, TrendChartData, TrendTimeRange } from '../../markets/components/TinHieuSecion/MarketTrendChart';
import { transformTrendData } from '../../markets/components/TinHieuSecion/MarketTrendChart';
import { OptionalAuthWrapper } from '@/components/auth/OptionalAuthWrapper';
import { ADVANCED_AND_ABOVE } from '@/components/auth/features';
import SubChartSkeleton from 'components/common/SubChartSkeleton';
import ChartSectionTitle from 'components/common/ChartSectionTitle';
import { useMarketUpdateTime } from 'hooks/useMarketUpdateTime';

// Lazy load heavy chart components
const VsiITDIndexLineChart = dynamic(
    () => import('./components/VsiScoreItdLineChart'),
    { ssr: false, loading: () => <SubChartSkeleton height={280} variant="line" legendCount={2} /> }
);

const MarketIndexChart = dynamic(
    () => import('../../home/components/marketSection/MarketIndexChart').then(mod => ({ default: mod.default })),
    {
        loading: () => <SubChartSkeleton height={400} variant="mixed" legendCount={2} />,
        ssr: false
    }
);

const SucManhDongTien = dynamic(
    () => import('./components/SucManhDongTien'),
    { ssr: false }
);

const MarketTrendChart = dynamic(
    () => import('../../markets/components/TinHieuSecion/MarketTrendChart'),
    {
        loading: () => <SubChartSkeleton height={345} variant="trend" legendCount={4} />,
        ssr: false,
    }
);

// Type cho SSE data
type IndexDataByTicker = Record<string, RawMarketData[]>;

// Empty chart data for initial state
const emptyChartData: ChartData = {
    areaData: [],
    candleData: [],
    volumeData: []
};

// Sessions for line charts
const LINE_SESSIONS = 20;

// ── ITD timeline helper ────────────────────────────────────────────────────────
function build1DTradingTimeline(referenceTimestamp?: number): number[] {
    const ref = referenceTimestamp != null
        ? new Date(referenceTimestamp)
        : new Date(Date.now() + 7 * 60 * 60 * 1000);
    const y = ref.getUTCFullYear(), m = ref.getUTCMonth(), d = ref.getUTCDate();
    const timeline: number[] = [];
    const pushRange = (sh: number, sm: number, eh: number, em: number) => {
        for (let ts = Date.UTC(y, m, d, sh, sm, 0, 0); ts <= Date.UTC(y, m, d, eh, em, 0, 0); ts += 60_000)
            timeline.push(ts);
    };
    pushRange(9, 0, 11, 30);
    pushRange(13, 0, 15, 0);
    return timeline;
}

// Danh sách index để chọn trong dropdown
const INDEX_LIST: { ticker: string; name: string }[] = [
    { ticker: 'FNXINDEX', name: 'Finext Index' },
    { ticker: 'FNX100', name: 'Finext 100' },
    { ticker: 'VUOTTROI', name: 'Finext Vượt trội' },
    { ticker: 'ONDINH', name: 'Finext Ổn định' },
    { ticker: 'SUKIEN', name: 'Finext Sự kiện' },
    { ticker: 'LARGECAP', name: 'Finext LargeCap' },
    { ticker: 'MIDCAP', name: 'Finext MidCap' },
    { ticker: 'SMALLCAP', name: 'Finext SmallCap' },
];

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

export default function GroupDetailContent() {
    const params = useParams();
    const router = useRouter();
    const ticker = (params.groupId as string).toUpperCase();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
    const updateTime = useMarketUpdateTime();

    // Dropdown state
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    function handleSelectIndex(selectedTicker: string) {
        setDropdownOpen(false);
        if (selectedTicker !== ticker) {
            router.push(`/groups/${selectedTicker.toLowerCase()}`);
        }
    }


    const isMountedRef = useRef<boolean>(true);
    const todaySseRef = useRef<{ unsubscribe: () => void } | null>(null);
    const itdSseRef = useRef<{ unsubscribe: () => void } | null>(null);
    const trendSseRef = useRef<{ unsubscribe: () => void } | null>(null);
    const stockSseRef = useRef<{ unsubscribe: () => void } | null>(null);

    // Lifted timeRange state for chart
    const [timeRange, setTimeRange] = useState<TimeRange>('3M');

    // Trend chart timeRange
    const [trendTimeRange, setTrendTimeRange] = useState<TrendTimeRange>(isMobile ? '1M' : '3M');

    useEffect(() => {
        setTrendTimeRange(isMobile ? '1M' : '3M');
    }, [isMobile]);

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

    // ITD data (từ SSE home_itd_index)
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

    // Combined EOD data (history + today)
    const [eodData, setEodData] = useState<ChartData>(emptyChartData);

    // Intraday data
    const [intradayData, setIntradayData] = useState<ChartData>(emptyChartData);

    // Loading & Error states
    const [isLoading, setIsLoading] = useState<boolean>(() => {
        const todayCache = getFromCache<RawMarketData[]>('home_today_index');
        if (todayCache && Array.isArray(todayCache)) {
            const hasTodayForTicker = todayCache.some(item => item.ticker === ticker);
            return !hasTodayForTicker;
        }
        return true;
    });
    const [error, setError] = useState<string | null>(null);

    // ========== REST - History Data (lazy load) ==========
    const baseChunk = 90;
    const baseChunkRef = useRef(baseChunk);
    baseChunkRef.current = baseChunk;

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
            url: '/api/v1/sse/rest/home_hist_index',
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
            url: '/api/v1/sse/rest/home_hist_index',
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
            url: '/api/v1/sse/rest/home_hist_index',
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

    // ========== REST - History Data for line charts (ticker, ~20 sessions) ==========
    const { data: histLineTicker = [], isLoading: histLineTickerLoading } = useQuery({
        queryKey: ['groups', 'hist_index_line', ticker, LINE_SESSIONS],
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

    // ========== REST - History Data for VNINDEX (~20 sessions) ==========
    const { data: histLineVNINDEX = [] } = useQuery({
        queryKey: ['groups', 'hist_index_line', 'VNINDEX', LINE_SESSIONS],
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
        queryKey: ['groups', 'history_trend', ticker],
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

    // Transform ITD data cho ticker hiện tại
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

        if (!hasHistoryData) return;

        const combinedRawData = todayDataForTicker.length > 0
            ? [...historyData, ...todayDataForTicker]
            : [...historyData];
        const transformedData = transformToChartData(combinedRawData, false);
        setEodData(transformedData);
        setIsLoading(false);
    }, [historyData, todayAllData, ticker, historyLoading]);

    // Get display name for ticker
    const indexName = useMemo(() => {
        const firstRecord = historyData[0] || todayAllData[ticker]?.[0] || itdAllData[ticker]?.[0];
        return firstRecord?.ticker_name || ticker;
    }, [historyData, todayAllData, itdAllData, ticker]);

    // ========== CHART 1: Sức mạnh dòng tiền (line t5_score + bar t0_score) ==========
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

    // ========== CHART 2: Tương quan biến động giá và dòng tiền ==========
    const { tuongQuanDates, tuongQuanSeries } = useMemo(() => {
        const todayForTicker = todayAllData[ticker] || [];
        const todayTickerArr: RawMarketData[] = todayForTicker.length > 0 ? [todayForTicker[todayForTicker.length - 1]] : [];
        const mergedTicker = mergeData(histLineTicker, todayTickerArr);

        const todayForVN = todayAllData['VNINDEX'] || [];
        const todayVNArr: RawMarketData[] = todayForVN.length > 0 ? [todayForVN[todayForVN.length - 1]] : [];
        const mergedVNINDEX = mergeData(histLineVNINDEX, todayVNArr);

        // Use ticker merged as reference for dates
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

    // ========== CHART ITD: VSI + t0_score intraday ==========
    const { vsiSeriesData, t0ScoreSeriesData, vsiIndexToTimestamp, vsiXAxisMax } = useMemo(() => {
        const rawData = (itdAllData[ticker] || []) as any[];
        const sorted = [...rawData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (sorted.length === 0) {
            return {
                vsiSeriesData: [] as { x: number; y: number }[],
                t0ScoreSeriesData: [] as { x: number; y: number }[],
                vsiIndexToTimestamp: new Map<number, number>(),
                vsiXAxisMax: undefined as number | undefined,
            };
        }

        const seen = new Set<number>();
        const points = sorted
            .map((r) => ({
                ts: Math.floor((new Date(r.date).getTime() + 7 * 60 * 60 * 1000) / 60_000) * 60_000,
                vsi: parseFloat(((r.vsi ?? 0) * 100).toFixed(2)),
                t0: parseFloat((r.t0_score ?? 0).toFixed(2)),
            }))
            .filter((p) => { if (seen.has(p.ts)) return false; seen.add(p.ts); return true; });

        const latestTs = points.length > 0 ? points[points.length - 1].ts : undefined;
        const fixedTimeline = build1DTradingTimeline(latestTs);
        const tsToIdx = new Map<number, number>();
        const idxToTs = new Map<number, number>();
        fixedTimeline.forEach((ts, idx) => { tsToIdx.set(ts, idx); idxToTs.set(idx, ts); });
        const maxIdx = idxToTs.size > 0 ? Math.max(...Array.from(idxToTs.keys())) : undefined;

        const toSeries = (field: 'vsi' | 't0') =>
            points
                .map((p) => { const idx = tsToIdx.get(p.ts); return idx !== undefined ? { x: idx, y: p[field] } : null; })
                .filter((p): p is { x: number; y: number } => p !== null);

        return {
            vsiSeriesData: toSeries('vsi'),
            t0ScoreSeriesData: toSeries('t0'),
            vsiIndexToTimestamp: idxToTs,
            vsiXAxisMax: maxIdx,
        };
    }, [itdAllData, ticker]);

    // ========== CHART 3: Cấu trúc sóng (Trend) ==========
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

    // Top 10 stocks by trading_value, filtered by current group
    const topStocks: GroupStockRowData[] = useMemo(() => {
        if (stockData.length === 0) return [];

        const filterByGroup = (stocks: StockData[]): StockData[] => {
            switch (ticker) {
                case 'FNXINDEX': return stocks;
                case 'FNX100': return stocks.filter(s => s.top100 === 1);
                case 'VUOTTROI': return stocks.filter(s => s.category_name === 'Finext Vượt trội');
                case 'ONDINH': return stocks.filter(s => s.category_name === 'Finext Ổn định');
                case 'SUKIEN': return stocks.filter(s => s.category_name === 'Finext Sự kiện');
                case 'LARGECAP': return stocks.filter(s => s.marketcap_name === 'Finext LargeCap');
                case 'MIDCAP': return stocks.filter(s => s.marketcap_name === 'Finext MidCap');
                case 'SMALLCAP': return stocks.filter(s => s.marketcap_name === 'Finext SmallCap');
                default: return stocks;
            }
        };

        const filtered = filterByGroup(stockData);
        return [...filtered]
            .sort((a, b) => (b.trading_value || 0) - (a.trading_value || 0))
            .slice(0, 10)
            .map(s => ({
                ticker: s.ticker,
                exchange: s.exchange,
                close: s.close,
                diff: s.diff,
                pct_change: s.pct_change,
                industry_name: s.industry_name,
                category_name: s.category_name,
                marketcap_name: s.marketcap_name,
                t0_score: s.t0_score,
                t5_score: s.t5_score,
                vsi: s.vsi,
            }));
    }, [stockData]);

    return (
        <Box sx={{ py: 2 }}>
            {/* Title with dropdown index selector and Mở biểu đồ button */}
            <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 2 }}>
                <Box ref={dropdownRef} sx={{ position: 'relative', display: 'inline-block' }}>
                {/* Clickable title */}
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
                    {/* Chevron indicator */}
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
                            borderRadius: `${borderRadius.lg}px`,
                            overflow: 'hidden',
                            ...getGlassCard(isDark),
                            animation: `dropdownFadeIn ${durations.fast} ${easings.easeOut}`,
                            '@keyframes dropdownFadeIn': {
                                from: { opacity: 0, transform: 'translateY(-6px)' },
                                to: { opacity: 1, transform: 'translateY(0)' },
                            },
                        }}
                    >
                        {INDEX_LIST.map((item) => {
                            const isActive = item.ticker === ticker;
                            return (
                                <Box
                                    key={item.ticker}
                                    component="button"
                                    onClick={() => handleSelectIndex(item.ticker)}
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

                {/* Chart Button */}
                <Box
                    component="span"
                    onClick={() => router.push(`/charts/${ticker}`)}
                    sx={{ textDecoration: 'none', cursor: 'pointer', mb: '4px' }}
                >
                    <Typography sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        fontWeight: fontWeight.bold,
                        color: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        px: 1.5,
                        py: 0.5,
                        borderRadius: `${borderRadius.sm}px`,
                        transition: 'background 0.2s',
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.15) },
                        userSelect: 'none',
                    }}>
                        Mở biểu đồ ↗
                    </Typography>
                </Box>
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
                        title={`Chỉ số ${indexName}`}
                        eodData={eodData}
                        intradayData={intradayData}
                        isLoading={isLoading}
                        error={error}
                        timeRange={timeRange}
                        onTimeRangeChange={setTimeRange}
                        onLoadMore={loadMoreHistory}
                    />
                </Box>

                {/* Right: Index Detail Panel */}
                <Box sx={{
                    width: { xs: '100%', md: 340 },
                    flexShrink: 0,
                }}>
                    <IndexDetailPanel
                        indexName=''
                        todayData={todayAllData[ticker] || []}
                    />
                </Box>
            </Box>

            {/* ========== ADVANCED GATE: ITD + Bottom charts + Stock table ========== */}
            <OptionalAuthWrapper requireAuth={true} requiredFeatures={ADVANCED_AND_ABOVE}>
                {/* ========== ITD SECTION: VSI intraday chart ========== */}
                <Box sx={{ mt: 4 }}>
                    <ChartSectionTitle
                        title={`Nhóm ${indexName} trong phiên`}
                        description="Theo dõi biến động dòng tiền mua/bán chủ động và chỉ số thanh khoản VSI trong ngày của nhóm."
                        updateTime={updateTime}
                        sx={{ mb: 1 }}
                    />
                    <Box sx={{ mt: 2 }}>
                        {vsiSeriesData.length > 0 ? (
                            <VsiITDIndexLineChart
                                seriesData={vsiSeriesData}
                                t0ScoreSeriesData={t0ScoreSeriesData}
                                indexToTimestamp={vsiIndexToTimestamp}
                                xAxisMax={vsiXAxisMax}
                                chartHeight="280px"
                            />
                        ) : (
                            <SubChartSkeleton height={280} variant="line" legendCount={2} />
                        )}
                    </Box>
                </Box>

                {/* ========== BOTTOM SECTION: 3 Charts ========== */}
                <Box sx={{ mt: 4 }}>
                    {/* Top row: 2 charts side by side */}
                    <ChartSectionTitle
                        title={`Nhóm ${indexName} trong tháng`}
                        description="Thống kê lịch sử sức mạnh dòng tiền của nhóm và độ tương quan so với thị trường chung."
                        updateTime={updateTime}
                        sx={{ mb: 1 }}
                    />
                    <Box sx={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        gap: isMobile ? 2 : 5,
                        mt: 2
                    }}>
                        {/* Left: Sức mạnh dòng tiền */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            {!histLineTickerLoading && dongTienDates.length > 0 ? (
                                <SucManhDongTien
                                    title=""
                                    chartHeight="300px"
                                    dates={dongTienDates}
                                    t5ScoreData={t5ScoreData}
                                    t0ScoreData={t0ScoreData}
                                />
                            ) : (
                                <SubChartSkeleton height={300} variant="mixed" legendCount={2} />
                            )}
                        </Box>

                        {/* Right: Tương quan biến động giá và dòng tiền */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            {!histLineTickerLoading && tuongQuanDates.length > 0 ? (
                                <TuongQuanDongTien
                                    chartHeight="300px"
                                    dates={tuongQuanDates}
                                    series={tuongQuanSeries}
                                    unit="percent"
                                />
                            ) : (
                                <SubChartSkeleton height={300} variant="line" legendCount={3} />
                            )}
                        </Box>
                    </Box>

                    {/* Bottom: Cấu trúc sóng */}
                    <Box sx={{ mt: 3 }}>
                        <ChartSectionTitle
                            title={`Xu hướng nhóm ${indexName}`}
                            description="Biểu đồ xu hướng và cường độ sóng của nhóm qua các chu kỳ."
                            updateTime={updateTime}
                            sx={{ mb: 1 }}
                        />
                        {!isTrendLoading ? (
                            <MarketTrendChart
                                chartData={trendChartData}
                                isLoading={isTrendLoading}
                                timeRange={trendTimeRange}
                                onTimeRangeChange={setTrendTimeRange}
                                height={345}
                            />
                        ) : (
                            <SubChartSkeleton height={345} variant="trend" legendCount={4} />
                        )}
                    </Box>
                </Box>

                {/* ========== STOCK TABLE: Top 10 cổ phiếu giao dịch cao nhất ========== */}
                <Box sx={{ mt: 4 }}>
                    <Box sx={{ mb: 2 }}>
                        <ChartSectionTitle
                            title={`Cổ phiếu nổi bật nhóm ${indexName}`}
                            description="Danh sách các cổ phiếu có giá trị giao dịch cao nhất trong nhóm."
                            updateTime={updateTime}
                            sx={{ mb: 0 }}
                        />
                    </Box>
                    <GroupStockTable
                        data={topStocks}
                        isLoading={stockData.length === 0}
                        skeletonRows={10}
                    />
                </Box>
            </OptionalAuthWrapper>
        </Box>
    );
}
