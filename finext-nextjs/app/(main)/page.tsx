'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, Container, ToggleButton, ToggleButtonGroup } from '@mui/material';
import MarketIndexChart, {
    RawMarketData,
    ChartData,
    transformToChartData,
    TimeRange
} from './components/MarketIndexChart';

// Import API clients
import { apiClient } from 'services/apiClient';
import { ISseConnection, ISseRequest } from 'services/core/types';
import { sseClient } from 'services/sseClient';
import { usePollingClient } from 'services/pollingClient';

// Index mapping: key -> { symbol, name }
const INDEX_OPTIONS: Record<string, { symbol: string; name: string }> = {
    'VNINDEX': { symbol: 'VNINDEX', name: 'VN-Index' },
    'VN30': { symbol: 'VN30', name: 'VN30' },
    'HNXINDEX': { symbol: 'HNXINDEX', name: 'HNX-Index' },
    'UPINDEX': { symbol: 'UPINDEX', name: 'UP-Index' },
    'VN30F1M': { symbol: 'VN30F1M', name: 'VN30F1M' },
    'all_stock': { symbol: 'FNXINDEX', name: 'Finext-Index' },
    'mid': { symbol: 'FNXMID', name: 'Finext-Midcap' },
    'small': { symbol: 'FNXSMALL', name: 'Finext-Smallcap' },
    'large': { symbol: 'FNXLARGE', name: 'Finext-Largecap' },
};

// Type cho today_all_indexes response
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

    // SSE connection ref cho today_all_indexes
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
            queryParams: { keyword: 'today_all_indexes' }
            // Không cần ticker - lấy tất cả
        };

        todaySseRef.current = sseClient<TodayAllIndexesData>(requestProps, {
            onOpen: () => {
                if (isMountedRef.current) {
                    console.log('[SSE Today All] Connected');
                }
            },
            onData: (receivedData) => {
                if (isMountedRef.current && receivedData && typeof receivedData === 'object') {
                    setTodayAllData(receivedData);
                }
            },
            onError: (sseError) => {
                if (isMountedRef.current) {
                    console.warn('[SSE Today All] Error:', sseError.message);
                }
            },
            onClose: () => {
                console.log('[SSE Today All] Closed');
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
    const currentIndex = INDEX_OPTIONS[ticker];
    const symbol = currentIndex?.symbol || ticker;
    const indexName = currentIndex?.name || ticker;

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Box>
                <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
                    Trang chủ
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    Biểu đồ chỉ số thị trường
                </Typography>

                {/* Index Selection */}
                <ToggleButtonGroup
                    value={ticker}
                    exclusive
                    onChange={handleTickerChange}
                    aria-label="Chọn chỉ số"
                    sx={{ mb: 3, flexWrap: 'wrap', gap: 0.5 }}
                    size="small"
                >
                    {Object.entries(INDEX_OPTIONS).map(([key, { symbol }]) => (
                        <ToggleButton
                            key={key}
                            value={key}
                            sx={{
                                px: 2,
                                textTransform: 'none',
                                fontWeight: ticker === key ? 600 : 400
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