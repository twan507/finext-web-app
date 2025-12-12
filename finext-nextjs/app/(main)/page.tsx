'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, Container, ToggleButton, ToggleButtonGroup } from '@mui/material';
import MarketIndexChart, {
    RawMarketData,
    ChartData,
    transformToChartData,
    TimeRange
} from './components/MarketIndexChart';
import MiniIndexCard from './components/MiniIndexCard';

// Import API clients
import { apiClient } from 'services/apiClient';
import { ISseConnection, ISseRequest } from 'services/core/types';
import { sseClient } from 'services/sseClient';
import { usePollingClient } from 'services/pollingClient';

// Danh sách các index symbols
const INDEX_OPTIONS = [
    'VNINDEX',
    'VN30',
    'HNXINDEX',
    'UPINDEX',
    'VN30F1M',
    'VN30F2M',
];

// Type cho sse_today_index response
type TodayAllIndexesData = Record<string, RawMarketData[]>;

// Empty chart data for initial state
const emptyChartData: ChartData = {
    areaData: [],
    candleData: [],
    volumeData: []
};

export default function HomePage() {
    const [ticker, setTicker] = useState<string>('VNINDEX');

    // Lifted timeRange state từ chart component
    const [timeRange, setTimeRange] = useState<TimeRange>('1Y');

    // Track if component is mounted
    const isMountedRef = useRef<boolean>(true);

    // SSE connection ref cho sse_today_index
    const todaySseRef = useRef<ISseConnection | null>(null);

    // ========== STATE ==========
    // History data (từ REST API - gọi 1 lần khi đổi ticker)
    const [historyData, setHistoryData] = useState<RawMarketData[]>([]);
    const [historyLoading, setHistoryLoading] = useState<boolean>(true);

    // Today data (từ SSE - cho TẤT CẢ indexes)
    const [todayAllData, setTodayAllData] = useState<TodayAllIndexesData>({});

    // Combined EOD data (history + today)
    const [eodData, setEodData] = useState<ChartData>(emptyChartData);

    // Intraday data (từ Polling)
    const [intradayData, setIntradayData] = useState<ChartData>(emptyChartData);

    // Loading & Error states
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // ========== LUỒNG 1: REST - History Data ==========
    const fetchHistoryData = useCallback(async (selectedTicker: string) => {
        setHistoryLoading(true);
        try {
            const response = await apiClient<RawMarketData[]>({
                url: '/api/v1/sse/rest/history_market_index_chart',
                method: 'GET',
                queryParams: { ticker: selectedTicker },
                requireAuth: false
            });

            if (isMountedRef.current && response.data) {
                setHistoryData(response.data);
                setError(null);
            }
        } catch (err: any) {
            if (isMountedRef.current) {
                console.error('[History] Fetch error:', err);
                setError(`Lỗi tải dữ liệu lịch sử: ${err.message}`);
            }
        } finally {
            if (isMountedRef.current) {
                setHistoryLoading(false);
            }
        }
    }, []);

    // Fetch history khi ticker thay đổi
    useEffect(() => {
        isMountedRef.current = true;
        fetchHistoryData(ticker);

        return () => {
            isMountedRef.current = false;
        };
    }, [ticker, fetchHistoryData]);

    // ========== LUỒNG 2: SSE - Today All Indexes ==========
    useEffect(() => {
        isMountedRef.current = true;

        // Close existing connection
        if (todaySseRef.current) {
            todaySseRef.current.close();
            todaySseRef.current = null;
        }

        const requestProps: ISseRequest = {
            url: '/api/v1/sse/stream',
            queryParams: { keyword: 'sse_today_index' }
        };

        todaySseRef.current = sseClient<RawMarketData[]>(requestProps, {
            onOpen: () => {
                // Connected
            },
            onData: (receivedData) => {
                if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
                    // Group by ticker trên FE
                    const grouped: TodayAllIndexesData = {};
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
        });

        return () => {
            isMountedRef.current = false;
            if (todaySseRef.current) {
                todaySseRef.current.close();
            }
        };
    }, []); // Chỉ chạy 1 lần khi mount

    // ========== LUỒNG 3: Polling - ITD Data ==========
    // Chỉ enable polling khi timeRange === '1D' (đang xem chart intraday)
    const isIntradayMode = timeRange === '1D';

    const { data: itdRawData } = usePollingClient<RawMarketData[]>(
        '/api/v1/sse/rest/itd_market_index_chart',
        { ticker },
        { interval: 5000, enabled: isIntradayMode, immediate: isIntradayMode }
    );

    // Transform ITD data khi có dữ liệu mới
    useEffect(() => {
        if (itdRawData && Array.isArray(itdRawData) && itdRawData.length > 0) {
            const transformedData = transformToChartData(itdRawData, true);
            setIntradayData(transformedData);
        } else {
            setIntradayData(emptyChartData);
        }
    }, [itdRawData]);

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

    // Handle ticker change
    const handleTickerChange = (_event: React.MouseEvent<HTMLElement>, newTicker: string | null) => {
        if (newTicker !== null) {
            setTicker(newTicker);
            setIsLoading(true);
            setHistoryData([]);
            setEodData(emptyChartData);
            setIntradayData(emptyChartData);
        }
    };

    // Get display info for current ticker
    // Lấy ticker_name từ dữ liệu (tất cả API đều trả về ticker_name)
    const getTickerName = (): string => {
        const firstRecord = historyData[0] || todayAllData[ticker]?.[0] || (itdRawData && itdRawData[0]);
        return firstRecord?.ticker_name || ticker;
    };

    const symbol = ticker;
    const indexName = getTickerName();

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Box>
                <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
                    Trang chủ
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    Biểu đồ chỉ số thị trường
                </Typography>

                {/* Mini Index Cards */}
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        mb: 4
                    }}
                >
                    {INDEX_OPTIONS.map((indexSymbol) => (
                        <MiniIndexCard key={indexSymbol} symbol={indexSymbol} />
                    ))}
                </Box>

                {/* Index Selection */}
                <ToggleButtonGroup
                    value={ticker}
                    exclusive
                    onChange={handleTickerChange}
                    aria-label="Chọn chỉ số"
                    sx={{ mb: 3, flexWrap: 'wrap', gap: 0.5 }}
                    size="small"
                >
                    {INDEX_OPTIONS.map((symbol) => (
                        <ToggleButton
                            key={symbol}
                            value={symbol}
                            sx={{
                                px: 2,
                                textTransform: 'none',
                                fontWeight: ticker === symbol ? 600 : 400
                            }}
                        >
                            {symbol}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>

                <MarketIndexChart
                    key={ticker}
                    symbol={symbol}
                    title={`Chỉ số ${indexName}`}
                    eodData={eodData}
                    intradayData={intradayData}
                    isLoading={isLoading}
                    error={error}
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                />
            </Box>
        </Container>
    );
}