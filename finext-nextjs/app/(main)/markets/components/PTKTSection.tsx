'use client';

import { Box, Skeleton } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'services/apiClient';
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

type IndexDataByTicker = Record<string, RawMarketData[]>;

interface PTKTSectionProps {
    todayAllData: IndexDataByTicker;
}

export default function PTKTSection({ todayAllData }: PTKTSectionProps) {
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

    // ── Current price (từ todayAllData của parent — tránh duplicate SSE) ─────
    const vnindexData = todayAllData[TICKER];
    const latestPrice = vnindexData && vnindexData.length > 0 ? vnindexData[vnindexData.length - 1] : null;

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
