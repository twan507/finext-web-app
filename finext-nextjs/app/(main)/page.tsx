'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Container, ToggleButton, ToggleButtonGroup } from '@mui/material';
import MarketIndexChart, {
    RawMarketData,
    ChartData,
    transformToChartData
} from './components/test_chart';

// Import SSE client
import { ISseConnection, ISseRequest } from 'services/core/types';
import { sseClient } from 'services/sseClient';

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

// Empty chart data for initial state
const emptyChartData: ChartData = {
    areaData: [],
    candleData: [],
    volumeData: []
};

export default function HomePage() {
    const [ticker, setTicker] = useState<string>('VNINDEX');

    // SSE connection refs
    const eodSseRef = useRef<ISseConnection | null>(null);
    const itdSseRef = useRef<ISseConnection | null>(null);

    // Track if component is mounted
    const isMountedRef = useRef<boolean>(false);

    // State for chart data
    const [eodData, setEodData] = useState<ChartData>(emptyChartData);
    const [intradayData, setIntradayData] = useState<ChartData>(emptyChartData);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Handle ticker change
    const handleTickerChange = (_event: React.MouseEvent<HTMLElement>, newTicker: string | null) => {
        if (newTicker !== null) {
            setTicker(newTicker);
            setIsLoading(true);
            setEodData(emptyChartData);
            setIntradayData(emptyChartData);
        }
    };

    // SSE connection for EOD data
    useEffect(() => {
        isMountedRef.current = true;

        // Close existing connection
        if (eodSseRef.current) {
            eodSseRef.current.close();
            eodSseRef.current = null;
        }

        const requestProps: ISseRequest = {
            url: '/api/v1/sse/stream',
            queryParams: { keyword: 'eod_market_index_chart', ticker }
        };

        eodSseRef.current = sseClient<RawMarketData[]>(requestProps, {
            onOpen: () => {
                if (isMountedRef.current) {
                    setError(null);
                }
            },
            onData: (receivedData) => {
                if (isMountedRef.current && Array.isArray(receivedData) && receivedData.length > 0) {
                    const transformedData = transformToChartData(receivedData, false);
                    setEodData(transformedData);
                    setIsLoading(false);
                }
            },
            onError: (sseError) => {
                if (isMountedRef.current) {
                    setError(`Lỗi kết nối EOD: ${sseError.message}`);
                    setIsLoading(false);
                }
            },
            onClose: () => {
            }
        });

        return () => {
            isMountedRef.current = false;
            if (eodSseRef.current) {
                eodSseRef.current.close();
            }
        };
    }, [ticker]);

    // SSE connection for ITD (Intraday) data
    useEffect(() => {
        if (!isMountedRef.current) return;

        // Close existing connection
        if (itdSseRef.current) {
            itdSseRef.current.close();
            itdSseRef.current = null;
        }

        const requestProps: ISseRequest = {
            url: '/api/v1/sse/stream',
            queryParams: { keyword: 'itd_market_index_chart', ticker }
        };

        itdSseRef.current = sseClient<RawMarketData[]>(requestProps, {
            onOpen: () => {
            },
            onData: (receivedData) => {
                if (isMountedRef.current && Array.isArray(receivedData) && receivedData.length > 0) {
                    const transformedData = transformToChartData(receivedData, true);
                    setIntradayData(transformedData);
                }
            },
            onError: (sseError) => {
            },
            onClose: () => {
            }
        });

        return () => {
            if (itdSseRef.current) {
                itdSseRef.current.close();
            }
        };
    }, [ticker]);

    console.log(intradayData);

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
                />
            </Box>
        </Container>
    );
}