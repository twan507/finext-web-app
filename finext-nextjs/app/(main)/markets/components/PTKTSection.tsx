'use client';

import { useState, useEffect, useRef } from 'react';
import { Box, Skeleton } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'services/apiClient';
import { sseClient } from 'services/sseClient';
import { ISseRequest } from 'services/core/types';
import type { RawMarketData } from 'app/(main)/home/components/marketSection/MarketIndexChart';
import dynamic from 'next/dynamic';

const VNINDEXPriceMap = dynamic(
    () => import('./PTKTSection/IndexPriceMap'),
    {
        loading: () => <Skeleton variant="rectangular" height={500} sx={{ borderRadius: 2 }} />,
        ssr: false,
    }
);

const TICKER = 'VNINDEX';

export default function PTKTSection() {
    const isMountedRef = useRef<boolean>(true);
    const sseRef = useRef<{ unsubscribe: () => void } | null>(null);

    // ── Chart indicator data (REST) ──────────────────────────────────────────
    const { data: chartIndicatorData = null } = useQuery({
        queryKey: ['markets', 'chart_history_data', TICKER],
        queryFn: async () => {
            const response = await apiClient<any[]>({
                url: '/api/v1/sse/rest/chart_history_data',
                method: 'GET',
                queryParams: { ticker: TICKER, limit: 1 },
                requireAuth: false,
            });
            const data = response.data;
            if (data && Array.isArray(data) && data.length > 0) return data[data.length - 1];
            return null;
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // ── Current price (SSE home_today_index) ─────────────────────────────────
    const [latestPrice, setLatestPrice] = useState<RawMarketData | null>(null);

    useEffect(() => {
        isMountedRef.current = true;

        if (sseRef.current) {
            sseRef.current.unsubscribe();
            sseRef.current = null;
        }

        const requestProps: ISseRequest = {
            url: '/api/v1/sse/stream',
            queryParams: { keyword: 'home_today_index' },
        };

        sseRef.current = sseClient<RawMarketData[]>(
            requestProps,
            {
                onOpen: () => { },
                onData: (data) => {
                    if (isMountedRef.current && data && Array.isArray(data)) {
                        const items = data.filter((d) => d.ticker === TICKER);
                        if (items.length > 0) setLatestPrice(items[items.length - 1]);
                    }
                },
                onError: () => { },
                onClose: () => { },
            },
        );

        return () => {
            isMountedRef.current = false;
            if (sseRef.current) sseRef.current.unsubscribe();
        };
    }, []);

    const currentPrice = latestPrice?.close ?? 0;
    const currentDiff = latestPrice?.diff;
    const currentPctChange = latestPrice?.pct_change;

    return (
        <Box sx={{ py: 3 }}>
            <VNINDEXPriceMap
                chartIndicatorData={chartIndicatorData}
                currentPrice={currentPrice}
                currentDiff={currentDiff}
                currentPctChange={currentPctChange}
            />
        </Box>
    );
}
