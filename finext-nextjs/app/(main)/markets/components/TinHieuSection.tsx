'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Typography, Skeleton, useMediaQuery, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'services/apiClient';
import { ISseRequest } from 'services/core/types';
import { sseClient, getFromCache } from 'services/sseClient';
import type { RawTrendData, TrendChartData, TrendTimeRange } from './TinHieuSecion/MarketTrendChart';
import { transformTrendData } from './TinHieuSecion/MarketTrendChart';

const MarketTrendChart = dynamic(
    () => import('./TinHieuSecion/MarketTrendChart'),
    {
        loading: () => <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />,
        ssr: false,
    }
);

const PhaseSignalSection = dynamic(
    () => import('./TinHieuSecion/PhaseSignalSection'),
    {
        loading: () => <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2, mt: 4 }} />,
        ssr: false,
    }
);

// ── Section title helper (matches BienDongSection / DongTienSection style) ───
function SectionTitle({ children, sx }: { children: React.ReactNode; sx?: object }) {
    return (
        <Typography
            color="text.secondary"
            sx={{
                fontSize: getResponsiveFontSize('lg'),
                fontWeight: fontWeight.semibold,
                textTransform: 'uppercase',
                mb: 1,
                ...sx,
            }}
        >
            {children}
        </Typography>
    );
}

export default function TinHieuSection() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [timeRange, setTimeRange] = useState<TrendTimeRange>(isMobile ? '1M' : '3M');

    useEffect(() => {
        setTimeRange(isMobile ? '1M' : '3M');
    }, [isMobile]);

    // ========== SSE Ref ==========
    const isMountedRef = useRef<boolean>(true);
    const todayTrendSseRef = useRef<{ unsubscribe: () => void } | null>(null);

    // ========== REST — History Trend Data (FNXINDEX) ==========
    const { data: historyTrendData = [], isLoading: historyTrendLoading } = useQuery({
        queryKey: ['markets', 'history_trend', 'FNXINDEX'],
        queryFn: async () => {
            const response = await apiClient<RawTrendData[]>({
                url: '/api/v1/sse/rest/home_history_trend',
                method: 'GET',
                queryParams: { ticker: 'FNXINDEX' },
                requireAuth: false,
            });
            return response.data || [];
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // ========== SSE — Today Trend Data ==========
    const [trendTodayData, setTrendTodayData] = useState<RawTrendData[]>(() => {
        const cached = getFromCache<RawTrendData[]>('home_today_trend');
        if (cached && Array.isArray(cached)) {
            return cached.filter((item) => item.ticker === 'FNXINDEX');
        }
        return [];
    });

    useEffect(() => {
        isMountedRef.current = true;

        if (todayTrendSseRef.current) {
            todayTrendSseRef.current.unsubscribe();
            todayTrendSseRef.current = null;
        }

        const requestProps: ISseRequest = {
            url: '/api/v1/sse/stream',
            queryParams: { keyword: 'home_today_trend' },
        };

        todayTrendSseRef.current = sseClient<RawTrendData[]>(
            requestProps,
            {
                onOpen: () => { },
                onData: (receivedData) => {
                    if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
                        const fnxData = receivedData.filter((item) => item.ticker === 'FNXINDEX');
                        setTrendTodayData(fnxData);
                    }
                },
                onError: (sseError) => {
                    if (isMountedRef.current) console.warn('[SSE TinHieu Trend] Error:', sseError.message);
                },
                onClose: () => { },
            },
            { cacheTtl: 5 * 60 * 1000, useCache: true }
        );

        return () => {
            isMountedRef.current = false;
            if (todayTrendSseRef.current) todayTrendSseRef.current.unsubscribe();
        };
    }, []);

    // ========== Combine History + Today → Trend Chart Data ==========
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

    return (
        <Box sx={{ py: 3 }}>
            {/* ========== XU HƯỚNG THỊ TRƯỜNG (below) ========== */}
            <Box >
                <SectionTitle>Xu hướng thị trường</SectionTitle>
                <MarketTrendChart
                    chartData={trendChartData}
                    isLoading={isTrendLoading}
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                    height={345}
                />
            </Box>

            {/* ========== TÍN HIỆU THỊ TRƯỜNG (on top) ========== */}
            <Box sx={{ mt: 4 }}>
                <SectionTitle>Giai đoạn thị trường</SectionTitle>
                <PhaseSignalSection hideTitle={true} />
            </Box>

        </Box>
    );
}
