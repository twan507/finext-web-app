'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Box, Typography, useTheme, Divider, useMediaQuery } from '@mui/material';
import BreadthPolarChart from './BienDongSection/BreadthPolarChart';
import FlowBarChart from './BienDongSection/FlowBarChart';
import VsiITDLineChart from './BienDongSection/VsiITDLineChart';
import StockTreemap from './BienDongSection/StockTreemap';
import type { StockData } from '../../components/marketSection/MarketVolatility';
import { ISseRequest } from 'services/core/types';
import { sseClient, getFromCache } from 'services/sseClient';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ItdRecord {
    ticker: string;
    ticker_name?: string;
    date: string;
    close: number;
    volume: number;
    diff?: number;
    pct_change?: number;
    vsi?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a fixed 1D trading timeline: 09:00–11:30 + 13:00–15:00 (skip lunch break).
 * Returns array of UTC timestamps at minute resolution.
 */
function build1DTradingTimeline(referenceTimestamp?: number): number[] {
    const ref = referenceTimestamp != null
        ? new Date(referenceTimestamp)
        : new Date(Date.now() + 7 * 60 * 60 * 1000);

    const y = ref.getUTCFullYear();
    const m = ref.getUTCMonth();
    const d = ref.getUTCDate();

    const timeline: number[] = [];

    const pushMinuteRange = (startHour: number, startMinute: number, endHour: number, endMinute: number) => {
        const start = Date.UTC(y, m, d, startHour, startMinute, 0, 0);
        const end = Date.UTC(y, m, d, endHour, endMinute, 0, 0);
        for (let ts = start; ts <= end; ts += 60 * 1000) {
            timeline.push(ts);
        }
    };

    // Hours 9-15 because data timestamps are already shifted +7h
    // so getUTCHours() returns VN local time directly
    pushMinuteRange(9, 0, 11, 30);
    pushMinuteRange(13, 0, 15, 0);

    return timeline;
}

export default function BienDongSection() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
    const chartHeight = '250px';

    const isMountedRef = useRef<boolean>(true);
    const todayStockSseRef = useRef<{ unsubscribe: () => void } | null>(null);
    const itdIndexSseRef = useRef<{ unsubscribe: () => void } | null>(null);

    // SSE state: home_today_stock
    const [stockData, setStockData] = useState<StockData[]>(() => {
        const cached = getFromCache<StockData[]>('home_today_stock');
        return cached && Array.isArray(cached) ? cached : [];
    });

    // SSE state: home_itd_index (for VSI chart)
    const [itdData, setItdData] = useState<ItdRecord[]>(() => {
        const cached = getFromCache<ItdRecord[]>('home_itd_index');
        if (cached && Array.isArray(cached)) {
            return cached.filter((r) => r.ticker === 'VNINDEX');
        }
        return [];
    });

    // ========== SSE - Today Stock Data ==========
    useEffect(() => {
        isMountedRef.current = true;

        if (todayStockSseRef.current) {
            todayStockSseRef.current.unsubscribe();
            todayStockSseRef.current = null;
        }

        const requestProps: ISseRequest = {
            url: '/api/v1/sse/stream',
            queryParams: { keyword: 'home_today_stock' },
        };

        todayStockSseRef.current = sseClient<StockData[]>(
            requestProps,
            {
                onOpen: () => { },
                onData: (receivedData) => {
                    if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
                        setStockData(receivedData);
                    }
                },
                onError: (sseError) => {
                    if (isMountedRef.current) console.warn('[SSE BienDong Stock] Error:', sseError.message);
                },
                onClose: () => { },
            },
            { cacheTtl: 5 * 60 * 1000, useCache: true }
        );

        return () => {
            isMountedRef.current = false;
            if (todayStockSseRef.current) todayStockSseRef.current.unsubscribe();
        };
    }, []);

    // ========== SSE - ITD Index Data (for VSI) ==========
    useEffect(() => {
        isMountedRef.current = true;

        if (itdIndexSseRef.current) {
            itdIndexSseRef.current.unsubscribe();
            itdIndexSseRef.current = null;
        }

        const requestProps: ISseRequest = {
            url: '/api/v1/sse/stream',
            queryParams: { keyword: 'home_itd_index', ticker: 'VNINDEX' },
        };

        itdIndexSseRef.current = sseClient<ItdRecord[]>(
            requestProps,
            {
                onOpen: () => { },
                onData: (receivedData) => {
                    if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
                        const filtered = receivedData.filter((r) => r.ticker === 'VNINDEX');
                        setItdData(filtered);
                    }
                },
                onError: (err) => {
                    if (isMountedRef.current) console.warn('[SSE BienDong ITD] Error:', err.message);
                },
                onClose: () => { },
            },
            { cacheTtl: 5 * 60 * 1000, useCache: true }
        );

        return () => {
            isMountedRef.current = false;
            if (itdIndexSseRef.current) itdIndexSseRef.current.unsubscribe();
        };
    }, []);

    // ========== DATA PROCESSING ==========

    // Breadth: count by pct_change
    const priceIncrease = stockData.filter((s) => s.pct_change > 0).length;
    const priceDecrease = stockData.filter((s) => s.pct_change < 0).length;
    const priceUnchanged = stockData.filter((s) => s.pct_change === 0).length;

    // Flow: sum trading_value grouped by t0_score
    const flowIn = stockData.filter((s) => s.t0_score > 0).reduce((sum, s) => sum + (s.trading_value || 0), 0);
    const flowOut = stockData.filter((s) => s.t0_score < 0).reduce((sum, s) => sum + (s.trading_value || 0), 0);
    const flowNeutral = stockData.filter((s) => s.t0_score === 0).reduce((sum, s) => sum + (s.trading_value || 0), 0);

    // ========== VSI CHART DATA PROCESSING ==========
    const { vsiSeriesData, vsiIndexToTimestamp, vsiXAxisMax } = useMemo(() => {
        // Sort by date, filter records that have a valid vsi value
        const sortedData = [...itdData]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .filter((r) => typeof r.vsi === 'number' && !isNaN(r.vsi));

        if (sortedData.length === 0) {
            return {
                vsiSeriesData: [] as { x: number; y: number }[],
                vsiIndexToTimestamp: new Map<number, number>(),
                vsiXAxisMax: undefined as number | undefined,
            };
        }

        // Convert dates to UTC timestamps, shift to VN time, normalize to minute
        const seenTimestamps = new Set<number>();
        const dataPoints = sortedData
            .map((r) => ({
                ts: Math.floor((new Date(r.date).getTime() + 7 * 60 * 60 * 1000) / (60 * 1000)) * (60 * 1000),
                y: parseFloat(((r.vsi ?? 0) * 100).toFixed(2)),
            }))
            .filter((p) => {
                if (seenTimestamps.has(p.ts)) return false;
                seenTimestamps.add(p.ts);
                return true;
            });

        // Build fixed 1D timeline to skip lunch break
        const latestDataTs = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].ts : undefined;
        const fixedTimeline = build1DTradingTimeline(latestDataTs);

        // Map timestamp → sequential index
        const timestampToIndex = new Map<number, number>();
        const idxToTs = new Map<number, number>();
        fixedTimeline.forEach((ts, index) => {
            timestampToIndex.set(ts, index);
            idxToTs.set(index, ts);
        });

        // Max index for fixed x-axis width (data draws up to where it exists)
        const maxIndex = idxToTs.size > 0 ? Math.max(...Array.from(idxToTs.keys())) : undefined;

        // Transform data points to use sequential index as X
        const seriesData = dataPoints
            .map((p) => {
                const index = timestampToIndex.get(p.ts);
                if (index === undefined) return null;
                return { x: index, y: p.y };
            })
            .filter((p): p is { x: number; y: number } => p !== null);

        return {
            vsiSeriesData: seriesData,
            vsiIndexToTimestamp: idxToTs,
            vsiXAxisMax: maxIndex,
        };
    }, [itdData]);

    // ========== Chart title component ==========
    const chartTitle = (title: string) => (
        <Typography
            color="text.secondary"
            sx={{
                fontSize: getResponsiveFontSize('lg'),
                fontWeight: fontWeight.semibold,
                mb: 0,
                textTransform: 'uppercase',
            }}
        >
            {title}
        </Typography>
    );

    return (
        <Box sx={{ py: 3 }}>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    flexWrap: isTablet ? 'wrap' : 'nowrap',
                    gap: isMobile ? 2 : 3,
                }}
            >
                {/* Độ rộng thị trường — Desktop: 25%, Tablet: 50%, Mobile: 100% */}
                <Box
                    sx={{
                        flex: isMobile ? '1 1 100%' : isTablet ? '1 1 calc(50% - 12px)' : '0 0 25%',
                        minWidth: 0,
                    }}
                >
                    {chartTitle('Độ rộng thị trường')}
                    <BreadthPolarChart
                        series={[priceIncrease, priceUnchanged, priceDecrease]}
                        labels={['Tăng giá', 'Không đổi', 'Giảm giá']}
                        colors={[theme.palette.trend.up, theme.palette.trend.ref, theme.palette.trend.down]}
                        chartHeight={chartHeight}
                    />
                </Box>

                {/* Phân bổ dòng tiền — Desktop: 30%, Tablet: 50%, Mobile: 100% */}
                <Box
                    sx={{
                        flex: isMobile ? '1 1 100%' : isTablet ? '1 1 calc(50% - 12px)' : '0 0 30%',
                        minWidth: 0,
                        ml: (isMobile || isTablet) ? 0 : -2,
                        mr: (isMobile || isTablet) ? 0 : 2,
                    }}
                >
                    {chartTitle('Phân bổ dòng tiền')}
                    <FlowBarChart
                        flowIn={flowIn}
                        flowOut={flowOut}
                        flowNeutral={flowNeutral}
                        chartHeight={chartHeight}
                    />
                </Box>

                {/* Chỉ số thanh khoản — Desktop: 45%, Tablet: 100%, Mobile: 100% */}
                <Box
                    sx={{
                        flex: isMobile ? '1 1 100%' : isTablet ? '1 1 100%' : '0 0 45%',
                        minWidth: 0,
                        mt: isTablet ? 1 : 0,
                    }}
                >
                    {chartTitle('Chỉ số thanh khoản')}
                    <VsiITDLineChart
                        seriesData={vsiSeriesData}
                        indexToTimestamp={vsiIndexToTimestamp}
                        xAxisMax={vsiXAxisMax}
                    />
                </Box>
            </Box>

            <Box sx={{ mt: 3 }}>
                <Typography
                    color="text.secondary"
                    sx={{
                        fontSize: getResponsiveFontSize('lg'),
                        fontWeight: fontWeight.semibold,
                        textTransform: 'uppercase',
                    }}
                >
                    Bản đồ thị trường
                </Typography>
                <StockTreemap data={stockData} />
            </Box>
        </Box>
    );
}
