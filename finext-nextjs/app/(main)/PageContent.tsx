'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Box, Skeleton } from '@mui/material';

// Import types từ MarketIndexChart (types được export riêng, không ảnh hưởng bundle)
import type { RawMarketData, ChartData, TimeRange } from './components/MarketIndexChart';
import { transformToChartData } from './components/MarketIndexChart';

// Import types từ MarketTrendChart
import type { RawTrendData, TrendChartData } from './components/MarketTrendChart';
import { transformTrendData } from './components/MarketTrendChart';

// Lazy load heavy chart components để giảm initial bundle size
const MarketIndexChart = dynamic(
    () => import('./components/MarketIndexChart').then(mod => ({ default: mod.default })),
    {
        loading: () => <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />,
        ssr: false
    }
);

const MiniIndexCard = dynamic(
    () => import('./components/MiniIndexCard'),
    {
        loading: () => <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />,
        ssr: false
    }
);

const MarketSection = dynamic(
    () => import('./components/MarketSection'),
    { loading: () => <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, my: 2 }} /> }
);

const IndustrySection = dynamic(
    () => import('./components/IndustrySection'),
    { loading: () => <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, my: 2 }} /> }
);

const StockSection = dynamic(
    () => import('./components/StockSection'),
    { loading: () => <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, my: 2 }} /> }
);

const NewsSection = dynamic(
    () => import('./components/NewsSection'),
    { loading: () => <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, my: 2 }} /> }
);

const MarketTrendSection = dynamic(
    () => import('./components/MarketPhaseSection'),
    { loading: () => <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, my: 2 }} /> }
);

const MarketTrendLineSection = dynamic(
    () => import('./components/MarketTrendSection'),
    { loading: () => <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2, my: 2 }} /> }
);

const IndustryStocksSection = dynamic(
    () => import('./components/IndustryStocksSection'),
    { loading: () => <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, my: 2 }} /> }
);

// Import API clients
import { apiClient } from 'services/apiClient';
import { ISseRequest } from 'services/core/types';
import { sseClient, getFromCache } from 'services/sseClient';
import MarketPhaseSection from './components/MarketPhaseSection';

// Danh sách các index cho mini charts
const MINI_CHART_INDEXES = [
    'VNINDEX',
    'VN30',
    'VNXALL',
    'HNXINDEX',
    'HNX30',
    'UPINDEX',
];

// Indexes bị ẩn ở tablet (md và nhỏ hơn)
const HIDDEN_ON_TABLET = ['VNXALL', 'HNX30'];

// Tab type cho bảng index
type IndexTabType = 'main' | 'derivative' | 'finext';

// Type cho home_today_index và home_itd_index response (grouped by ticker)
type IndexDataByTicker = Record<string, RawMarketData[]>;

// Empty chart data for initial state
const emptyChartData: ChartData = {
    areaData: [],
    candleData: [],
    volumeData: []
};

export default function HomeContent() {
    const [ticker, setTicker] = useState<string>('VNINDEX');

    // Lifted timeRange state từ chart component
    const [timeRange, setTimeRange] = useState<TimeRange>('3M');

    // Tab state cho bảng index
    const [indexTab, setIndexTab] = useState<IndexTabType>('finext');

    // Track if component is mounted
    const isMountedRef = useRef<boolean>(true);

    // SSE subscription refs (for cleanup)
    const todaySseRef = useRef<{ unsubscribe: () => void } | null>(null);
    const itdSseRef = useRef<{ unsubscribe: () => void } | null>(null);
    const todayStockSseRef = useRef<{ unsubscribe: () => void } | null>(null);
    const todayTrendSseRef = useRef<{ unsubscribe: () => void } | null>(null);

    // ========== STATE ==========

    // Today data (từ SSE home_today_index - cho TẤT CẢ indexes)
    // Khởi tạo từ cache nếu có
    const [todayAllData, setTodayAllData] = useState<IndexDataByTicker>(() => {
        const cached = getFromCache<RawMarketData[]>('home_today_index');
        if (cached && Array.isArray(cached)) {
            const grouped: IndexDataByTicker = {};
            cached.forEach((item: RawMarketData) => {
                const t = item.ticker;
                if (t) {
                    if (!grouped[t]) grouped[t] = [];
                    grouped[t].push(item);
                }
            });
            return grouped;
        }
        return {};
    });

    // ITD data (từ SSE home_itd_index - cho TẤT CẢ indexes)
    // Khởi tạo từ cache nếu có
    const [itdAllData, setItdAllData] = useState<IndexDataByTicker>(() => {
        const cached = getFromCache<RawMarketData[]>('home_itd_index');
        if (cached && Array.isArray(cached)) {
            const grouped: IndexDataByTicker = {};
            cached.forEach((item: RawMarketData) => {
                const t = item.ticker;
                if (t) {
                    if (!grouped[t]) grouped[t] = [];
                    grouped[t].push(item);
                }
            });
            return grouped;
        }
        return {};
    });

    // Combined EOD data (history + today)
    const [eodData, setEodData] = useState<ChartData>(emptyChartData);

    // Intraday data (transform từ itdAllData cho ticker hiện tại)
    const [intradayData, setIntradayData] = useState<ChartData>(emptyChartData);

    // Today Stock data (từ SSE home_today_stock - cho Market Trend Section)
    // Khởi tạo từ cache nếu có
    const [todayStockData, setTodayStockData] = useState<any[]>(() => {
        const cached = getFromCache<any[]>('home_today_stock');
        return cached && Array.isArray(cached) ? cached : [];
    });
    const [isStockDataLoading, setIsStockDataLoading] = useState<boolean>(() => {
        // Nếu có cache, không cần loading
        const cached = getFromCache<any[]>('home_today_stock');
        return !(cached && Array.isArray(cached) && cached.length > 0);
    });

    // Trend data (history_trend + today_trend cho FNXINDEX)
    const [trendTodayData, setTrendTodayData] = useState<RawTrendData[]>(() => {
        const cached = getFromCache<RawTrendData[]>('home_today_trend');
        if (cached && Array.isArray(cached)) {
            return cached.filter((item) => item.ticker === 'FNXINDEX');
        }
        return [];
    });
    const [trendChartData, setTrendChartData] = useState<TrendChartData>({
        wTrend: [], mTrend: [], qTrend: [], yTrend: [],
    });
    const [isTrendLoading, setIsTrendLoading] = useState<boolean>(true);

    // Loading & Error states
    // Khởi tạo loading dựa trên cache có sẵn
    const [isLoading, setIsLoading] = useState<boolean>(() => {
        const todayCache = getFromCache<RawMarketData[]>('home_today_index');
        // Nếu có cache today data cho ticker mặc định, có thể hiển thị ngay
        if (todayCache && Array.isArray(todayCache)) {
            const hasTodayForTicker = todayCache.some(item => item.ticker === 'VNINDEX');
            return !hasTodayForTicker;
        }
        return true;
    });
    const [error, setError] = useState<string | null>(null);

    // ========== LUỒNG 1: REST - History Data ==========
    const { data: historyData = [], isLoading: historyLoading } = useQuery({
        queryKey: ['market', 'history', ticker],
        queryFn: async () => {
            const response = await apiClient<RawMarketData[]>({
                url: '/api/v1/sse/rest/home_hist_index',
                method: 'GET',
                queryParams: { ticker },
                requireAuth: false
            });
            return response.data || [];
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    });


    // ========== LUỒNG 1.5: REST - History Trend Data (FNXINDEX) ==========
    const { data: historyTrendData = [], isLoading: historyTrendLoading } = useQuery({
        queryKey: ['market', 'history_trend', 'FNXINDEX'],
        queryFn: async () => {
            const response = await apiClient<RawTrendData[]>({
                url: '/api/v1/sse/rest/home_history_trend',
                method: 'GET',
                queryParams: { ticker: 'FNXINDEX' },
                requireAuth: false
            });
            return response.data || [];
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // ========== LUỒNG 2: SSE - Today All Indexes (với cache) ==========
    useEffect(() => {
        isMountedRef.current = true;

        // Unsubscribe from existing connection
        if (todaySseRef.current) {
            todaySseRef.current.unsubscribe();
            todaySseRef.current = null;
        }

        const requestProps: ISseRequest = {
            url: '/api/v1/sse/stream',
            queryParams: { keyword: 'home_today_index' }
        };

        todaySseRef.current = sseClient<RawMarketData[]>(
            requestProps,
            {
                onOpen: () => {
                    // Connected
                },
                onData: (receivedData) => {
                    if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
                        // Group by ticker trên FE
                        const grouped: IndexDataByTicker = {};
                        receivedData.forEach((item: RawMarketData) => {
                            const t = item.ticker;
                            if (t) {
                                if (!grouped[t]) grouped[t] = [];
                                grouped[t].push(item);
                            }
                        });
                        setTodayAllData(grouped);
                    }
                },
                onError: (sseError) => {
                    if (isMountedRef.current) {
                        console.warn('[SSE Today] Error:', sseError.message);
                    }
                },
                onClose: () => {
                    // Closed
                }
            },
            { cacheTtl: 5 * 60 * 1000, useCache: true } // Cache 5 phút
        );

        return () => {
            isMountedRef.current = false;
            if (todaySseRef.current) {
                todaySseRef.current.unsubscribe();
            }
        };
    }, []); // Chỉ chạy 1 lần khi mount

    // ========== LUỒNG 3: SSE - ITD All Indexes (với cache) ==========
    // Gọi 1 SSE duy nhất để lấy ITD data cho TẤT CẢ indexes, sau đó lọc theo ticker
    useEffect(() => {
        isMountedRef.current = true;

        // Unsubscribe from existing connection
        if (itdSseRef.current) {
            itdSseRef.current.unsubscribe();
            itdSseRef.current = null;
        }

        const requestProps: ISseRequest = {
            url: '/api/v1/sse/stream',
            queryParams: { keyword: 'home_itd_index' }
            // Không truyền ticker -> lấy tất cả indexes
        };

        itdSseRef.current = sseClient<RawMarketData[]>(
            requestProps,
            {
                onOpen: () => {
                    // Connected
                },
                onData: (receivedData) => {
                    if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
                        // Group by ticker trên FE
                        const grouped: IndexDataByTicker = {};
                        receivedData.forEach((item: RawMarketData) => {
                            const t = item.ticker;
                            if (t) {
                                if (!grouped[t]) grouped[t] = [];
                                grouped[t].push(item);
                            }
                        });
                        setItdAllData(grouped);
                    }
                },
                onError: (sseError) => {
                    if (isMountedRef.current) {
                        console.warn('[SSE ITD] Error:', sseError.message);
                    }
                },
                onClose: () => {
                    // Closed
                }
            },
            { cacheTtl: 5 * 60 * 1000, useCache: true } // Cache 5 phút
        );

        return () => {
            isMountedRef.current = false;
            if (itdSseRef.current) {
                itdSseRef.current.unsubscribe();
            }
        };
    }, []); // Chỉ chạy 1 lần khi mount

    // Transform ITD data cho ticker hiện tại khi itdAllData thay đổi
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
        // Lấy today data cho ticker hiện tại từ todayAllData
        const todayDataForTicker = todayAllData[ticker] || [];

        // Chỉ combine và hiển thị khi CẢ HAI đã có dữ liệu:
        // 1. History đã load xong (historyLoading = false) VÀ có data
        // 2. Today data đã có cho ticker hiện tại
        const hasHistoryData = !historyLoading && historyData.length > 0;
        const hasTodayData = todayDataForTicker.length > 0;

        if (!hasHistoryData || !hasTodayData) {
            // Chưa đủ dữ liệu -> giữ loading
            return;
        }

        // Combine history + today
        const combinedRawData = [...historyData, ...todayDataForTicker];
        const transformedData = transformToChartData(combinedRawData, false);
        setEodData(transformedData);

        // Đã đủ dữ liệu -> tắt loading
        setIsLoading(false);
    }, [historyData, todayAllData, ticker, historyLoading]);

    // Handle ticker change from Table
    const handleTableTickerChange = (newTicker: string) => {
        setTicker(newTicker);
        setIsLoading(true);
        // Date refetch handled by React Query queryKey change
        setEodData(emptyChartData);
        setIntradayData(emptyChartData);
    };

    // Get display info for current ticker
    // Lấy ticker_name từ dữ liệu (tất cả API đều trả về ticker_name)
    const getTickerName = (): string => {
        const firstRecord = historyData[0] || todayAllData[ticker]?.[0] || itdAllData[ticker]?.[0];
        return firstRecord?.ticker_name || ticker;
    };

    const indexName = getTickerName();

    // ========== LUỒNG 4: SSE - Today Stock Data (với cache) ==========
    useEffect(() => {
        isMountedRef.current = true;

        // Unsubscribe from existing connection
        if (todayStockSseRef.current) {
            todayStockSseRef.current.unsubscribe();
            todayStockSseRef.current = null;
        }

        const requestProps: ISseRequest = {
            url: '/api/v1/sse/stream',
            queryParams: { keyword: 'home_today_stock' }
        };

        todayStockSseRef.current = sseClient<any[]>(
            requestProps,
            {
                onOpen: () => {
                    // Connected
                },
                onData: (receivedData) => {
                    if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
                        setTodayStockData(receivedData);
                        setIsStockDataLoading(false);
                    }
                },
                onError: (sseError) => {
                    if (isMountedRef.current) {
                        console.warn('[SSE Today Stock] Error:', sseError.message);
                    }
                },
                onClose: () => {
                    // Closed
                }
            },
            { cacheTtl: 5 * 60 * 1000, useCache: true } // Cache 5 phút
        );

        return () => {
            isMountedRef.current = false;
            if (todayStockSseRef.current) {
                todayStockSseRef.current.unsubscribe();
            }
        };
    }, []); // Chỉ chạy 1 lần khi mount

    // ========== LUỒNG 4.5: SSE - Today Trend Data (với cache) ==========
    useEffect(() => {
        isMountedRef.current = true;

        if (todayTrendSseRef.current) {
            todayTrendSseRef.current.unsubscribe();
            todayTrendSseRef.current = null;
        }

        const requestProps: ISseRequest = {
            url: '/api/v1/sse/stream',
            queryParams: { keyword: 'home_today_trend' }
        };

        todayTrendSseRef.current = sseClient<RawTrendData[]>(
            requestProps,
            {
                onOpen: () => { },
                onData: (receivedData) => {
                    if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
                        // Filter chỉ lấy FNXINDEX
                        const fnxData = receivedData.filter((item) => item.ticker === 'FNXINDEX');
                        setTrendTodayData(fnxData);
                    }
                },
                onError: (sseError) => {
                    if (isMountedRef.current) {
                        console.warn('[SSE Today Trend] Error:', sseError.message);
                    }
                },
                onClose: () => { }
            },
            { cacheTtl: 5 * 60 * 1000, useCache: true }
        );

        return () => {
            isMountedRef.current = false;
            if (todayTrendSseRef.current) {
                todayTrendSseRef.current.unsubscribe();
            }
        };
    }, []);

    // ========== Combine History Trend + Today Trend -> Trend Chart Data ==========
    useEffect(() => {
        // History data is required before rendering chart
        // Today data is optional (appended if available)
        const hasHistory = !historyTrendLoading && historyTrendData.length > 0;

        if (!hasHistory) return;

        // Combine history + today (today appended after history)
        const combined = trendTodayData.length > 0
            ? [...historyTrendData, ...trendTodayData]
            : [...historyTrendData];
        const transformed = transformTrendData(combined);
        setTrendChartData(transformed);
        setIsTrendLoading(false);
    }, [historyTrendData, trendTodayData, historyTrendLoading]);

    // ========== LUỒNG 5: REST - NN Stock Data ==========
    // Fetch home_nn_stock for Foreign Net Buy/Sell (REST với interval 10s)
    const { data: nnStockData = [], isLoading: isNnLoading } = useQuery({
        queryKey: ['market', 'nn_stock'],
        queryFn: async () => {
            const response = await apiClient<any[]>({
                url: '/api/v1/sse/rest/home_nn_stock',
                method: 'GET',
                requireAuth: false
            });
            return response.data || [];
        },
        staleTime: 5 * 60 * 1000,
        refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    });


    return (
        <Box sx={{ py: 4 }}>
            {/* Mini Index Cards */}
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: { xs: 'wrap', md: 'nowrap' },
                    justifyContent: 'space-between',
                    gap: 1.5,
                }}
            >
                {MINI_CHART_INDEXES.map((indexSymbol) => (
                    <MiniIndexCard
                        key={indexSymbol}
                        symbol={indexSymbol}
                        itdData={itdAllData[indexSymbol] || []}
                        todayData={todayAllData[indexSymbol] || []}
                        hideOnTablet={HIDDEN_ON_TABLET.includes(indexSymbol)}
                    />
                ))}
            </Box>

            {/* Section 1: Thị trường */}
            <Box sx={{ mt: 5 }}>
                <MarketSection
                    ticker={ticker}
                    indexName={indexName}
                    eodData={eodData}
                    intradayData={intradayData}
                    isLoading={isLoading}
                    error={error}
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                    indexTab={indexTab}
                    onIndexTabChange={setIndexTab}
                    onTickerChange={handleTableTickerChange}
                    todayAllData={todayAllData}
                />
            </Box>

            {/* Section 1.5: Diễn biến thị trường */}
            <Box sx={{ mt: 5 }}>
                <MarketPhaseSection
                    stockData={todayStockData}
                    foreignData={nnStockData}
                    isLoading={isStockDataLoading || isNnLoading}
                />
            </Box>

            {/* Section 2: Xu hướng thị trường (Trend Lines + Tín hiệu) */}
            <Box sx={{ mt: 5 }}>
                <MarketTrendLineSection
                    chartData={trendChartData}
                    isLoading={isTrendLoading}
                />
            </Box>

            {/* Section 3: Ngành */}
            <Box sx={{ mt: 5 }}>
                <IndustrySection todayAllData={todayAllData} itdAllData={itdAllData} />
            </Box>

            {/* Section 3.5: Cổ phiếu nổi bật theo ngành */}
            <Box sx={{ mt: 5 }}>
                <IndustryStocksSection stockData={todayStockData} isLoading={isStockDataLoading} />
            </Box>

            {/* Section 5: Tin tức */}
            <Box sx={{ mt: 5 }}>
                <NewsSection />
            </Box>

        </Box>
    );
}


