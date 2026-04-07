'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Box, Skeleton } from '@mui/material';

// Import types từ MarketIndexChart (types được export riêng, không ảnh hưởng bundle)
import type { RawMarketData, ChartData, TimeRange } from './components/marketSection/MarketIndexChart';
import { transformToChartData } from './components/marketSection/MarketIndexChart';



const MiniIndexCard = dynamic(
    () => import('./components/MiniIndexCard'),
    {
        loading: () => <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />,
        ssr: false
    }
);

const MarketSection = dynamic(
    () => import('./components/marketSection/MarketSection'),
    { loading: () => <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, my: 2 }} /> }
);

const IndustrySection = dynamic(
    () => import('./components/industrySection/IndustrySection'),
    { loading: () => <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, my: 2 }} /> }
);

const NewsSection = dynamic(
    () => import('./components/NewsSection'),
    { loading: () => <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, my: 2 }} /> }
);



const IndustryStocksSection = dynamic(
    () => import('./components/industrySection/IndustryStocksSection'),
    { loading: () => <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2, my: 2 }} /> }
);

// Import API clients
import { apiClient } from 'services/apiClient';
import { ISseRequest } from 'services/core/types';
import { sseClient, getFromCache } from 'services/sseClient';
import MarketVolatility from './components/marketSection/MarketVolatility';

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

// Indexes bị ẩn ở mobile (xs) - chỉ giữ lại VNINDEX, HNXINDEX, UPINDEX
const HIDDEN_ON_MOBILE = ['VN30', 'VNXALL', 'HNX30'];

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
    // Đổi tên tab trên Client-side ngay khi component được render
    useEffect(() => {
        // Next.js có cơ chế tự động nạp lại title sau lần render đầu tiên,
        // Dùng setTimeout để đảm bảo lệnh đổi tên của mình chạy ghi đè sau cùng
        const timer = setTimeout(() => {
            document.title = "Trang chủ | Finext";
        }, 5);
        return () => clearTimeout(timer);
    }, []);

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

    // ========== LUỒNG 1: REST - History Data (lazy load) ==========
    const baseChunk = 90;
    const baseChunkRef = useRef(baseChunk);

    const [historyData, setHistoryData] = useState<RawMarketData[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [loadedBars, setLoadedBars] = useState(0);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);
    const isLoadingMoreRef = useRef(false);

    // Fetch initial chunk khi ticker thay đổi
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

    // Load thêm history cũ hơn (khi user scroll sang trái trong pan/zoom mode)
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
                if (olderData.length === 0) {
                    setHasMoreHistory(false);
                }
                isLoadingMoreRef.current = false;
            })
            .catch(() => {
                isLoadingMoreRef.current = false;
            });
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
        <Box sx={{ py: 2 }}>
            {/* Mini Index Cards */}
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'nowrap',
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
                        hideOnMobile={HIDDEN_ON_MOBILE.includes(indexSymbol)}
                        hasDetailPage={false}
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
                    onLoadMore={loadMoreHistory}
                />
            </Box>

            {/* Section 1.5: Diễn biến thị trường */}
            <Box sx={{ mt: 5 }}>
                <MarketVolatility
                    stockData={todayStockData}
                    foreignData={nnStockData}
                    isLoading={isStockDataLoading || isNnLoading}
                />
            </Box>



            {/* Section 3: Ngành */}
            <Box sx={{ mt: 5 }}>
                <IndustrySection todayAllData={todayAllData} itdAllData={itdAllData} />
            </Box>

            {/* Section 3.5: Cổ phiếu nổi bật theo ngành */}
            <Box sx={{ mt: 5 }}>
                <IndustryStocksSection
                    stockData={todayStockData}
                    isLoading={isStockDataLoading}
                    industryTickers={useMemo(() => {
                        const map: Record<string, string> = {};
                        Object.entries(todayAllData).forEach(([ticker, items]) => {
                            const indItem = (items as any[]).find((i: any) => i.type === 'industry');
                            if (indItem?.ticker_name) {
                                map[indItem.ticker_name] = ticker;
                            }
                        });
                        return map;
                    }, [todayAllData])}
                />
            </Box>

            {/* Section 5: Tin tức */}
            <Box sx={{ mt: 5 }}>
                <NewsSection />
            </Box>

        </Box>
    );
}


