'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, FormControl, Select, MenuItem, SelectChangeEvent, useTheme } from '@mui/material';
import { useRouter } from 'next/navigation';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MarketIndexChart, {
    RawMarketData,
    ChartData,
    transformToChartData,
    TimeRange
} from './components/MarketIndexChart';
import MiniIndexCard from './components/MiniIndexCard';
import IndexTable from './components/IndexTable';

// Import API clients
import { apiClient } from 'services/apiClient';
import { fontSize, iconSize } from 'theme/tokens';
import { ISseConnection, ISseRequest } from 'services/core/types';
import { sseClient } from 'services/sseClient';

// Danh sách các index cho mini charts
const MINI_CHART_INDEXES = [
    'VNINDEX',
    'VN30',
    'VNXALL',
    'HNXINDEX',
    'HNX30',
    'UPINDEX',
];

// List 1: Main Indexes (giống MINI_CHART_INDEXES)
const MAIN_INDEXES = [...MINI_CHART_INDEXES];

// List 2: Derivatives (Phái sinh) - các F1M, F2M, F1Q, F2Q
const DERIVATIVE_INDEXES = [
    'VN30F1M',
    'VN30F2M',
    'VN30F1Q',
    'VN30F2Q',
    'VN100F1M',
    'VN100F2M',
    'VN100F1Q',
    'VN100F2Q',
];

// List 3: Special Indexes
const FINEXT_INDEXES = [
    'FNXINDEX',
    'FNX100',
    'LARGECAP',
    'MIDCAP',
    'SMALLCAP',
    'VUOTTROI',
    'ONDINH',
    'SUKIEN',
];

// Tab type cho bảng index
type IndexTabType = 'main' | 'derivative' | 'special';

// Map tab -> index list
const INDEX_TAB_MAP: Record<IndexTabType, string[]> = {
    main: MAIN_INDEXES,
    derivative: DERIVATIVE_INDEXES,
    special: FINEXT_INDEXES,
};

// Type cho sse_today_index và itd_market_index_chart response (grouped by ticker)
type IndexDataByTicker = Record<string, RawMarketData[]>;

// Empty chart data for initial state
const emptyChartData: ChartData = {
    areaData: [],
    candleData: [],
    volumeData: []
};

export default function HomePage() {
    const theme = useTheme();
    const router = useRouter();
    const [ticker, setTicker] = useState<string>('VNINDEX');

    // Lifted timeRange state từ chart component
    const [timeRange, setTimeRange] = useState<TimeRange>('1Y');

    // Tab state cho bảng index
    const [indexTab, setIndexTab] = useState<IndexTabType>('main');

    // Colors for dropdown (giống với nút time frame/chart type)
    const dropdownColors = {
        background: theme.palette.component.chart.buttonBackground,
        text: theme.palette.text.primary,
        textActive: theme.palette.component.chart.buttonBackgroundActive,
    };

    // Track if component is mounted
    const isMountedRef = useRef<boolean>(true);

    // SSE connection refs
    const todaySseRef = useRef<ISseConnection | null>(null);
    const itdSseRef = useRef<ISseConnection | null>(null);

    // ========== STATE ==========
    // History data (từ REST API - gọi 1 lần khi đổi ticker)
    const [historyData, setHistoryData] = useState<RawMarketData[]>([]);
    const [historyLoading, setHistoryLoading] = useState<boolean>(true);

    // Today data (từ SSE sse_today_index - cho TẤT CẢ indexes)
    const [todayAllData, setTodayAllData] = useState<IndexDataByTicker>({});

    // ITD data (từ SSE itd_market_index_chart - cho TẤT CẢ indexes)
    const [itdAllData, setItdAllData] = useState<IndexDataByTicker>({});

    // Combined EOD data (history + today)
    const [eodData, setEodData] = useState<ChartData>(emptyChartData);

    // Intraday data (transform từ itdAllData cho ticker hiện tại)
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
        });

        return () => {
            isMountedRef.current = false;
            if (todaySseRef.current) {
                todaySseRef.current.close();
            }
        };
    }, []); // Chỉ chạy 1 lần khi mount

    // ========== LUỒNG 3: SSE - ITD All Indexes ==========
    // Gọi 1 SSE duy nhất để lấy ITD data cho TẤT CẢ indexes, sau đó lọc theo ticker
    useEffect(() => {
        isMountedRef.current = true;

        // Close existing connection
        if (itdSseRef.current) {
            itdSseRef.current.close();
            itdSseRef.current = null;
        }

        const requestProps: ISseRequest = {
            url: '/api/v1/sse/stream',
            queryParams: { keyword: 'itd_market_index_chart' }
            // Không truyền ticker -> lấy tất cả indexes
        };

        itdSseRef.current = sseClient<RawMarketData[]>(requestProps, {
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
        });

        return () => {
            isMountedRef.current = false;
            if (itdSseRef.current) {
                itdSseRef.current.close();
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
        setHistoryData([]);
        setEodData(emptyChartData);
        setIntradayData(emptyChartData);
    };

    // Get display info for current ticker
    // Lấy ticker_name từ dữ liệu (tất cả API đều trả về ticker_name)
    const getTickerName = (): string => {
        const firstRecord = historyData[0] || todayAllData[ticker]?.[0] || itdAllData[ticker]?.[0];
        return firstRecord?.ticker_name || ticker;
    };

    const symbol = ticker;
    const indexName = getTickerName();

    return (
        <Box sx={{ py: 4 }}>
            <Box>
                {/* Mini Index Cards */}
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 1.5,
                    }}
                >
                    {MINI_CHART_INDEXES.map((indexSymbol) => (
                        <MiniIndexCard
                            key={indexSymbol}
                            symbol={indexSymbol}
                            itdData={itdAllData[indexSymbol] || []}
                        />
                    ))}
                </Box>

                {/* Title - Thị trường (clickable) */}
                <Box
                    onClick={() => router.push('/markets')}
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        mt: 4,
                        mb: 2,
                    }}
                >
                    <Typography variant="h1">
                        Thị trường
                    </Typography>
                    <ChevronRightIcon sx={{ fontSize: fontSize.h2.tablet, mt: 1.5, color: theme.palette.text.secondary }} />
                </Box>

                {/* Main Content: Chart + Table */}
                <Box sx={{ display: 'flex', gap: 3 }}>
                    {/* Chart */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
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

                    {/* Index Table */}
                    <Box sx={{ width: 400, flexShrink: 0, mt: 9.8 }}>
                        {/* Dropdown chọn nhóm chỉ số - căn phải */}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                            <FormControl size="small">
                                <Select
                                    value={indexTab}
                                    onChange={(e: SelectChangeEvent) => setIndexTab(e.target.value as IndexTabType)}
                                    sx={{
                                        fontSize: fontSize.base.tablet,
                                        borderRadius: 2,
                                        backgroundColor: dropdownColors.background,
                                        color: dropdownColors.text,
                                        height: 37,
                                        '& .MuiSelect-select': {
                                            py: 0,
                                            px: 1.5,
                                            display: 'flex',
                                            alignItems: 'center',
                                        },
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            border: 'none',
                                        },
                                        '&:hover': {
                                            backgroundColor: dropdownColors.background,
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                            border: 'none',
                                        },
                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                            border: 'none',
                                        },
                                        '& .MuiSelect-icon': {
                                            color: dropdownColors.text,
                                        },
                                    }}
                                    MenuProps={{
                                        PaperProps: {
                                            sx: {
                                                backgroundColor: `${dropdownColors.background} !important`,
                                                backgroundImage: 'none',
                                                '& .MuiList-root': {
                                                    py: 0.5,
                                                },
                                                '& .MuiMenuItem-root': {
                                                    fontSize: fontSize.base.tablet,
                                                    color: dropdownColors.text,
                                                    backgroundColor: 'transparent !important',
                                                    '&:hover': {
                                                        backgroundColor: 'transparent !important',
                                                    },
                                                    '&.Mui-selected': {
                                                        backgroundColor: 'transparent !important',
                                                        color: dropdownColors.textActive,
                                                    },
                                                    '&.Mui-selected:hover': {
                                                        backgroundColor: 'transparent !important',
                                                    },
                                                    '&.Mui-focusVisible': {
                                                        backgroundColor: 'transparent !important',
                                                    },
                                                },
                                            },
                                        },
                                    }}
                                >
                                    <MenuItem value="main">Chỉ số thị trường</MenuItem>
                                    <MenuItem value="derivative">Chỉ số phái sinh</MenuItem>
                                    <MenuItem value="special">Chỉ số Finext</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>

                        <IndexTable
                            selectedTicker={ticker}
                            onTickerChange={handleTableTickerChange}
                            indexList={INDEX_TAB_MAP[indexTab]}
                            todayAllData={todayAllData}
                        />
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}