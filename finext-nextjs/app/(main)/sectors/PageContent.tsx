'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material';
import { useQueries, useQuery } from '@tanstack/react-query';
import { getResponsiveFontSize, fontWeight, getGlassCard, getGlassHighlight, getGlassEdgeLight, borderRadius } from 'theme/tokens';
import { ISseRequest } from 'services/core/types';
import { sseClient } from 'services/sseClient';
import { apiClient } from 'services/apiClient';
import type { RawMarketData } from '../home/components/marketSection/MarketIndexChart';
import StockTable, { IndexRowData } from '../groups/components/StockTable';
import FinRatiosTable from './components/FinRatiosTable';
import { OptionalAuthWrapper } from '@/components/auth/OptionalAuthWrapper';
import { ADVANCED_AND_ABOVE } from '@/components/auth/features';

// Reuse chart components from markets page
import DongTienTrongPhien from '../markets/components/DongTienSection/DongTienTrongPhien';
import ChiSoThanhKhoan from '../markets/components/DongTienSection/ChiSoThanhKhoan';
import PhanBoDongTien from '../markets/components/DongTienSection/PhanBoDongTien';
import DongTienTrongTuan from '../markets/components/DongTienSection/DongTienTrongTuan';

// ========== TYPES ==========
interface RawIndexData {
    ticker: string;
    ticker_name?: string;
    date: string;
    open?: number;
    high?: number;
    low?: number;
    close: number;
    volume?: number;
    trading_value?: number;
    diff?: number;
    pct_change?: number;
    w_pct?: number;
    m_pct?: number;
    q_pct?: number;
    y_pct?: number;
    vsi?: number;
    t0_score?: number;
    t5_score?: number;
    breadth_in?: number;
    breadth_out?: number;
    breadth_neu?: number;
    type?: string;
}


// ========== HELPERS ==========
function mergeData(hist: RawMarketData[], today: RawMarketData[]): RawMarketData[] {
    const merged = [...hist];
    if (today.length > 0) {
        const todayItem = today[today.length - 1];
        const lastHistDate = hist.length > 0 ? hist[hist.length - 1].date : '';
        if (todayItem.date !== lastHistDate) {
            merged.push(todayItem);
        } else if (merged.length > 0) {
            merged[merged.length - 1] = todayItem;
        }
    }
    merged.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return merged;
}

/**
 * Convert RawIndexData → RawMarketData (for mergeData compatibility)
 */
function toRawMarketData(item: RawIndexData): RawMarketData {
    return {
        ticker: item.ticker,
        ticker_name: item.ticker_name,
        date: item.date,
        open: item.open ?? 0,
        high: item.high ?? 0,
        low: item.low ?? 0,
        close: item.close,
        volume: item.volume ?? 0,
        pct_change: item.pct_change,
        t0_score: item.t0_score,
        t5_score: item.t5_score,
    } as unknown as RawMarketData;
}

// ========== MAIN COMPONENT ==========
export default function SectorsContent() {
    const isMountedRef = useRef<boolean>(true);
    const todaySseRef = useRef<{ unsubscribe: () => void } | null>(null);

    // Raw data map (keeps all data for chart computations)
    const [rawDataMap, setRawDataMap] = useState<Map<string, RawIndexData>>(new Map());

    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const isTablet = useMediaQuery(theme.breakpoints.down('lg'));

    // Get all industry tickers, sorted by t0_score descending
    const industryTickers = useMemo(() => {
        const items: { ticker: string; t0_score: number }[] = [];
        rawDataMap.forEach((item, ticker) => {
            if (item.type === 'industry') {
                items.push({ ticker, t0_score: item.t0_score ?? 0 });
            }
        });
        items.sort((a, b) => b.t0_score - a.t0_score);
        return items.map(i => i.ticker);
    }, [rawDataMap]);

    // Table data (filtered to only industries)
    const indexData = useMemo(() => transformData(rawDataMap), [rawDataMap]);

    const [isLoading, setIsLoading] = useState<boolean>(true);

    // SSE subscription
    useEffect(() => {
        isMountedRef.current = true;

        if (todaySseRef.current) {
            todaySseRef.current.unsubscribe();
            todaySseRef.current = null;
        }

        const requestProps: ISseRequest = {
            url: '/api/v1/sse/stream',
            queryParams: { keyword: 'home_today_index' },
        };

        todaySseRef.current = sseClient<RawIndexData[]>(
            requestProps,
            {
                onOpen: () => { },
                onData: (receivedData) => {
                    if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
                        setRawDataMap(buildRawMap(receivedData));
                        setIsLoading(false);
                    }
                },
                onError: (sseError) => {
                    if (isMountedRef.current) {
                        console.warn('[SSE Sectors Today Index] Error:', sseError.message);
                    }
                },
                onClose: () => { },
            },
            {},
        );

        return () => {
            isMountedRef.current = false;
            if (todaySseRef.current) {
                todaySseRef.current.unsubscribe();
            }
        };
    }, []);

    // ========== History queries ==========
    // 5 sessions — for bar charts (dòng tiền trong tuần)
    const histQueries5 = useQueries({
        queries: industryTickers.map(ticker => ({
            queryKey: ['sectors', 'hist_index', ticker, 5],
            queryFn: async () => {
                const response = await apiClient<RawMarketData[]>({
                    url: '/api/v1/sse/rest/home_hist_index',
                    method: 'GET',
                    queryParams: { ticker, limit: 5 },
                    requireAuth: false,
                });
                return response.data || [];
            },
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
        })),
    });

    // ========== Finratios Industry Query ==========
    const { data: finratiosData = [], isLoading: finratiosLoading } = useQuery({
        queryKey: ['sectors', 'finratios_industry'],
        queryFn: async () => {
            const response = await apiClient<any[]>({
                url: '/api/v1/sse/rest/finratios_industry',
                method: 'GET',
                queryParams: {},
                requireAuth: false
            });
            return response.data || [];
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Category labels
    const categories = useMemo(() =>
        industryTickers.map(t => {
            const item = rawDataMap.get(t);
            return item?.ticker_name || t;
        }),
        [industryTickers, rawDataMap]);

    // Chart 1: Dòng tiền trong phiên (t0_score)
    const bar1Series = useMemo(() => [{
        name: 'Dòng tiền trong phiên',
        data: industryTickers.map(t => {
            const item = rawDataMap.get(t);
            return parseFloat((item?.t0_score ?? 0).toFixed(1));
        }),
    }], [industryTickers, rawDataMap]);

    // Chart 2: Chỉ số thanh khoản (vsi * 100)
    const bar2Series = useMemo(() => [{
        name: 'Chỉ số thanh khoản',
        data: industryTickers.map(t => {
            const item = rawDataMap.get(t);
            return parseFloat(((item?.vsi ?? 0) * 100).toFixed(1));
        }),
    }], [industryTickers, rawDataMap]);

    // Chart 3: Phân bổ dòng tiền (breadth)
    const flowData = useMemo(() =>
        industryTickers.map(t => {
            const item = rawDataMap.get(t);
            return {
                flowIn: item?.breadth_in ?? 0,
                flowOut: item?.breadth_out ?? 0,
                flowNeutral: item?.breadth_neu ?? 0,
            };
        }),
        [industryTickers, rawDataMap]);

    // Chart 4: Dòng tiền trong tuần (t0_score last 5 sessions)
    const stackedData = useMemo(() => {
        const BAR_SESSIONS = 5;
        const dayLabels = ['T-4', 'T-3', 'T-2', 'T-1', 'T-0'];

        return dayLabels.map((dayLabel, dayIdx) => {
            const data = industryTickers.map((ticker, tickerIdx) => {
                const histRaw = histQueries5[tickerIdx]?.data;
                const hist: RawMarketData[] = Array.isArray(histRaw) ? histRaw : [];
                const todayItem = rawDataMap.get(ticker);
                const today: RawMarketData[] = todayItem ? [toRawMarketData(todayItem)] : [];
                const merged = mergeData(hist, today);
                const slice = merged.slice(-BAR_SESSIONS);
                if (dayIdx < slice.length) {
                    return parseFloat(((slice[dayIdx] as any)?.t0_score ?? 0).toFixed(1));
                }
                return 0;
            });
            return { dayLabel, data };
        });
    }, [industryTickers, rawDataMap, histQueries5]);

    return (
        <Box sx={{ py: 2 }}>
            <Typography variant="h1" sx={{ fontSize: getResponsiveFontSize('h1'), mb: 3 }}>
                Ngành Nghề
            </Typography>

            {/* Index Table */}
            <StockTable
                data={indexData}
                isLoading={isLoading}
            />

            {/* ========== ADVANCED GATE: Biểu đồ + Bảng định giá ========== */}
            <OptionalAuthWrapper requireAuth={true} requiredFeatures={ADVANCED_AND_ABOVE}>
                {/* ========== BIỂU ĐỒ NGÀNH ========== */}
                {!isLoading && industryTickers.length > 0 && (
                    <Box sx={{ mt: 4, ...getGlassCard(isDark), borderRadius: `${borderRadius.lg}px`, p: 2, position: 'relative', '&::before': getGlassHighlight(isDark), '&::after': getGlassEdgeLight(isDark) }}>
                        <Typography
                            color="text.secondary"
                            sx={{
                                fontSize: getResponsiveFontSize('lg'),
                                fontWeight: fontWeight.semibold,
                                mb: 3,
                                textTransform: 'uppercase',
                            }}
                        >
                            DÒNG TIỀN NGÀNH NGHỀ
                        </Typography>

                        {/* 4 bar charts */}
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: {
                                    xs: '1fr',
                                    md: '1fr 1fr',
                                    lg: '4fr 2fr 2fr 3fr',
                                },
                                gap: 2,
                            }}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <DongTienTrongPhien
                                    title="Dòng tiền trong phiên"
                                    categories={categories}
                                    series={bar1Series}
                                    unit="number"
                                    chartHeight="800px"
                                />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <ChiSoThanhKhoan
                                    title="Chỉ số thanh khoản"
                                    categories={categories}
                                    series={bar2Series}
                                    unit="percent"
                                    chartHeight="800px"
                                />
                            </Box>
                            <Box sx={{ minWidth: 0, ...(!isTablet && { ml: -2 }) }}>
                                <PhanBoDongTien
                                    title="Phân bổ dòng tiền"
                                    categories={categories}
                                    flowData={flowData}
                                    chartHeight="800px"
                                />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <DongTienTrongTuan
                                    title="Dòng tiền trong tuần"
                                    categories={categories}
                                    daySeriesData={stackedData}
                                    unit="number"
                                    chartHeight="800px"
                                />
                            </Box>
                        </Box>
                    </Box>
                )}

                {/* ========== CHỆ SỐ ĐỊNH GIÁ NGÀNH ========== */}
                {!finratiosLoading && finratiosData.length > 0 && (
                    <Box sx={{ mt: 6, ...getGlassCard(isDark), borderRadius: `${borderRadius.lg}px`, p: 2, position: 'relative', overflow: 'hidden', '&::before': getGlassHighlight(isDark), '&::after': getGlassEdgeLight(isDark) }}>
                        <FinRatiosTable
                            data={finratiosData}
                            isLoading={finratiosLoading}
                        />
                    </Box>
                )}
            </OptionalAuthWrapper>
        </Box>
    );
}

// ========== DATA HELPERS ==========

function buildRawMap(rawData: RawIndexData[]): Map<string, RawIndexData> {
    const map = new Map<string, RawIndexData>();
    rawData.forEach((item) => {
        map.set(item.ticker, item);
    });
    return map;
}

function transformData(rawDataMap: Map<string, RawIndexData>): IndexRowData[] {
    const result: IndexRowData[] = [];
    rawDataMap.forEach((item) => {
        if (item.type === 'industry') {
            result.push({
                ticker: item.ticker,
                ticker_name: item.ticker_name,
                close: item.close,
                diff: item.diff,
                pct_change: item.pct_change ?? 0,
                w_pct: item.w_pct,
                m_pct: item.m_pct,
                q_pct: item.q_pct,
                y_pct: item.y_pct,
                t0_score: item.t0_score,
                t5_score: item.t5_score,
                vsi: item.vsi,
                type: item.type,
            });
        }
    });
    result.sort((a, b) => (b.t0_score ?? 0) - (a.t0_score ?? 0));
    return result;
}
