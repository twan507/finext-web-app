'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material';
import BreadthPolarChart from './BienDongSection/BreadthPolarChart';
import FlowBarChart from './BienDongSection/FlowBarChart';
import VsiGaugeChart from './BienDongSection/VsiGaugeChart';
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
            return cached.filter((r) => r.ticker === 'FNXINDEX');
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
            queryParams: { keyword: 'home_itd_index', ticker: 'FNXINDEX' },
        };

        itdIndexSseRef.current = sseClient<ItdRecord[]>(
            requestProps,
            {
                onOpen: () => { },
                onData: (receivedData) => {
                    if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
                        const filtered = receivedData.filter((r) => r.ticker === 'FNXINDEX');
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

    // ========== VSI GAUGE DATA ==========
    const vsiLastValue = useMemo(() => {
        const sorted = [...itdData]
            .filter((r) => typeof r.vsi === 'number' && !isNaN(r.vsi))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        if (sorted.length === 0) return null;
        return parseFloat(((sorted[sorted.length - 1].vsi ?? 0) * 100).toFixed(2));
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
                {/* Độ rộng thị trường — Desktop: 33%, Tablet: 50%, Mobile: 100% */}
                <Box
                    sx={{
                        flex: isMobile ? '1 1 100%' : isTablet ? '1 1 calc(50% - 12px)' : '1 1 0',
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

                {/* Phân bổ dòng tiền — Desktop: 33%, Tablet: 50%, Mobile: 100% */}
                <Box
                    sx={{
                        flex: isMobile ? '1 1 100%' : isTablet ? '1 1 calc(50% - 12px)' : '1 1 0',
                        minWidth: 0,
                    }}
                >
                    {chartTitle('Phân bổ dòng tiền')}
                    <FlowBarChart
                        flowIn={flowIn}
                        flowOut={flowOut}
                        flowNeutral={flowNeutral}
                        chartHeight={chartHeight}
                        isLoading={stockData.length === 0}
                    />
                </Box>

                {/* Chỉ số thanh khoản — Desktop: 33%, Tablet: 50%, Mobile: 100% */}
                <Box
                    sx={{
                        flex: isMobile ? '1 1 100%' : isTablet ? '1 1 calc(50% - 12px)' : '1 1 0',
                        minWidth: 0,
                    }}
                >
                    {chartTitle('Chỉ số thanh khoản')}
                    <VsiGaugeChart value={vsiLastValue} />
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
