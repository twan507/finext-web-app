'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Container } from '@mui/material';
import VNIndexChart, {
    RawMarketData,
    ChartData,
    transformToChartData
} from './components/test_chart';

// Import SSE client
import { ISseConnection, ISseRequest } from 'services/core/types';
import { sseClient } from 'services/sseClient';

// Empty chart data for initial state
const emptyChartData: ChartData = {
    areaData: [],
    candleData: [],
    volumeData: []
};

export default function HomePage() {
    const ticker = 'VNINDEX';

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

    // SSE connection for EOD data
    useEffect(() => {
        // Set mounted flag immediately
        isMountedRef.current = true;

        // Delay to ensure component is fully mounted and hydrated
        const connectTimer = setTimeout(() => {

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
        }, 300);

        return () => {
            isMountedRef.current = false;
            clearTimeout(connectTimer);
            if (eodSseRef.current) {
                eodSseRef.current.close();
            }
        };
    }, [ticker]);

    // SSE connection for ITD (Intraday) data
    useEffect(() => {
        // Delay to ensure component is fully mounted and hydrated
        const connectTimer = setTimeout(() => {
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
        }, 300);

        return () => {
            clearTimeout(connectTimer);
            if (itdSseRef.current) {
                itdSseRef.current.close();
            }
        };
    }, [ticker]);

    console.log(intradayData);

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Box>
                <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
                    Trang chủ
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                    Biểu đồ VN-Index
                </Typography>
                <VNIndexChart
                    symbol="VN-Index"
                    title="Chỉ số VN-Index"
                    eodData={eodData}
                    intradayData={intradayData}
                    isLoading={isLoading}
                    error={error}
                />
            </Box>
        </Container>
    );
}
