'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material';
import { useQueries } from '@tanstack/react-query';
import { getResponsiveFontSize, fontWeight, getGlassCard, getGlassHighlight, getGlassEdgeLight, borderRadius } from 'theme/tokens';
import { ISseRequest } from 'services/core/types';
import { sseClient, getFromCache } from 'services/sseClient';
import { apiClient } from 'services/apiClient';
import type { RawMarketData } from '../components/marketSection/MarketIndexChart';
import StockTable, { IndexRowData } from './components/StockTable';

// Reuse chart components from markets page
import DongTienTrongPhien from '../markets/components/DongTienSection/DongTienTrongPhien';
import ChiSoThanhKhoan from '../markets/components/DongTienSection/ChiSoThanhKhoan';
import PhanBoDongTien from '../markets/components/DongTienSection/PhanBoDongTien';
import DongTienTrongTuan from '../markets/components/DongTienSection/DongTienTrongTuan';
import TuongQuanDongTien from './components/TuongQuanDongTien';
import NhomCPLineChart from './components/DienBienDongTien';

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

// ========== GROUP DEFINITIONS ==========
const DISPLAY_INDEXES = [
    'FNXINDEX', 'FNX100', 'VUOTTROI', 'ONDINH',
    'SUKIEN', 'LARGECAP', 'MIDCAP', 'SMALLCAP',
];

// 3 nhóm biểu đồ
const GROUP_MARKET = ['FNXINDEX', 'FNX100'];           // Nhóm thị trường
const GROUP_FLOW = ['VUOTTROI', 'ONDINH', 'SUKIEN'];  // Nhóm dòng tiền
const GROUP_CAP = ['LARGECAP', 'MIDCAP', 'SMALLCAP']; // Nhóm vốn hóa

// Line chart — 20 sessions (1M)
const LINE_SESSIONS = 20;

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
 * Build cumulative sum series from raw values, normalized so first = 0.
 */
function buildCumsum(data: RawMarketData[], fieldExtractor: (d: RawMarketData) => number): number[] {
    if (data.length === 0) return [];
    let cumulative = 0;
    const values = data.map(d => {
        const raw = fieldExtractor(d);
        const val = Math.abs(raw) < 1 ? raw * 100 : raw;
        cumulative += val;
        return parseFloat(cumulative.toFixed(2));
    });
    const base = values[0];
    return values.map(v => parseFloat((v - base).toFixed(2)));
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

// ========== CHART ROW COMPONENT ==========
interface GroupChartRowProps {
    title: string;
    tickers: string[];
    rawDataMap: Map<string, RawIndexData>;
    histQueries5: ReturnType<typeof useQueries<any>>;    // 5 sessions (bar charts)
    histQueriesLine: ReturnType<typeof useQueries<any>>; // 20 sessions (line charts)
}

function GroupChartRow({ title, tickers, rawDataMap, histQueries5, histQueriesLine }: GroupChartRowProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isTablet = useMediaQuery(theme.breakpoints.down('lg'));

    // Category labels (hiển thị ticker_name thay vì ticker)
    const categories = useMemo(() =>
        tickers.map(t => {
            const item = rawDataMap.get(t);
            return item?.ticker_name || t;
        }),
        [tickers, rawDataMap]);

    // Chart 1: Dòng tiền trong phiên (t0_score)
    const bar1Series = useMemo(() => [{
        name: 'Dòng tiền trong phiên',
        data: tickers.map(t => {
            const item = rawDataMap.get(t);
            return parseFloat((item?.t0_score ?? 0).toFixed(1));
        }),
    }], [tickers, rawDataMap]);

    // Chart 2: Chỉ số thanh khoản (vsi * 100)
    const bar2Series = useMemo(() => [{
        name: 'Chỉ số thanh khoản',
        data: tickers.map(t => {
            const item = rawDataMap.get(t);
            return parseFloat(((item?.vsi ?? 0) * 100).toFixed(1));
        }),
    }], [tickers, rawDataMap]);

    // Chart 3: Phân bổ dòng tiền (breadth)
    const flowData = useMemo(() =>
        tickers.map(t => {
            const item = rawDataMap.get(t);
            return {
                flowIn: item?.breadth_in ?? 0,
                flowOut: item?.breadth_out ?? 0,
                flowNeutral: item?.breadth_neu ?? 0,
            };
        }),
        [tickers, rawDataMap]);

    // Chart 4: Dòng tiền trong tuần (t0_score last 5 sessions)
    const stackedData = useMemo(() => {
        const BAR_SESSIONS = 5;
        const dayLabels = ['T-4', 'T-3', 'T-2', 'T-1', 'T-0'];

        return dayLabels.map((dayLabel, dayIdx) => {
            const data = tickers.map((ticker, tickerIdx) => {
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
    }, [tickers, rawDataMap, histQueries5]);

    // ========== LINE CHARTS DATA ==========
    // Merged data per ticker (hist + today, for line charts)
    const mergedPerTicker = useMemo(() =>
        tickers.map((ticker, idx) => {
            const histRaw = histQueriesLine[idx]?.data;
            const hist: RawMarketData[] = Array.isArray(histRaw) ? histRaw : [];
            const todayItem = rawDataMap.get(ticker);
            const today: RawMarketData[] = todayItem ? [toRawMarketData(todayItem)] : [];
            return mergeData(hist, today);
        }),
        [tickers, rawDataMap, histQueriesLine]);

    // Reference data for date labels (use first ticker that has data)
    const refMerged = useMemo(() => {
        for (const m of mergedPerTicker) {
            if (m.length > 0) return m;
        }
        return [];
    }, [mergedPerTicker]);

    // Date labels (dd/mm format)
    const lineDates = useMemo(() =>
        refMerged.map(d => {
            const date = new Date(d.date);
            const dd = date.getDate().toString().padStart(2, '0');
            const mm = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${dd}/${mm}`;
        }),
        [refMerged]);

    // Left chart: TuongQuanLineChart — cumulative t0_score
    const cumsumLineSeries = useMemo(() =>
        tickers.map((ticker, idx) => ({
            name: categories[idx],
            data: buildCumsum(mergedPerTicker[idx], d => ((d as any)?.t0_score ?? 0) / 1000),
        })),
        [tickers, categories, mergedPerTicker]);

    // Right chart: DienBienDongTien — raw t5_score per session
    const t5LineSeries = useMemo(() =>
        tickers.map((ticker, idx) => ({
            name: categories[idx],
            data: mergedPerTicker[idx].map(d => parseFloat(((d as any)?.t5_score ?? 0).toFixed(1))),
        })),
        [tickers, categories, mergedPerTicker]);

    return (
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
                {title}
            </Typography>

            {/* 4 bar charts */}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',
                        md: '1fr 1fr',
                        lg: '3fr 2fr 2fr 3fr',
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
                    />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <ChiSoThanhKhoan
                        title="Chỉ số thanh khoản"
                        categories={categories}
                        series={bar2Series}
                        unit="percent"
                    />
                </Box>
                <Box sx={{ minWidth: 0, ...(!isTablet && { ml: -2 }) }}>
                    <PhanBoDongTien
                        title="Phân bổ dòng tiền"
                        categories={categories}
                        flowData={flowData}
                    />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <DongTienTrongTuan
                        title="Dòng tiền trong tuần"
                        categories={categories}
                        daySeriesData={stackedData}
                        unit="number"
                    />
                </Box>
            </Box>

            {/* 2 line charts */}
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? 2 : 5,
                    mt: 2,
                }}
            >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <TuongQuanDongTien
                        title="Tương quan dòng tiền"
                        dates={lineDates}
                        series={cumsumLineSeries}
                        unit="percent"
                    />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <NhomCPLineChart
                        title="Diễn biến dòng tiền"
                        dates={lineDates}
                        series={t5LineSeries}
                        unit="number"
                    />
                </Box>
            </Box>
        </Box>
    );
}

// ========== MAIN COMPONENT ==========
export default function GroupsContent() {
    const isMountedRef = useRef<boolean>(true);
    const todaySseRef = useRef<{ unsubscribe: () => void } | null>(null);

    // Raw data map (keeps all data for chart computations)
    const [rawDataMap, setRawDataMap] = useState<Map<string, RawIndexData>>(() => {
        const cached = getFromCache<RawIndexData[]>('home_today_index');
        if (cached && Array.isArray(cached)) {
            return buildRawMap(cached);
        }
        return new Map();
    });

    // Table data (filtered + ordered subset for StockTable)
    const indexData = useMemo(() => transformData(rawDataMap), [rawDataMap]);

    const [isLoading, setIsLoading] = useState<boolean>(() => {
        const cached = getFromCache<RawIndexData[]>('home_today_index');
        return !(cached && Array.isArray(cached) && cached.length > 0);
    });

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
                        console.warn('[SSE Groups Today Index] Error:', sseError.message);
                    }
                },
                onClose: () => { },
            },
            { cacheTtl: 5 * 60 * 1000, useCache: true },
        );

        return () => {
            isMountedRef.current = false;
            if (todaySseRef.current) {
                todaySseRef.current.unsubscribe();
            }
        };
    }, []);

    // ========== History queries ==========
    const allTickers = useMemo(() => [...GROUP_MARKET, ...GROUP_FLOW, ...GROUP_CAP], []);

    // 5 sessions — for bar charts (dòng tiền trong tuần)
    const histQueries5 = useQueries({
        queries: allTickers.map(ticker => ({
            queryKey: ['groups', 'hist_index', ticker, 5],
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

    // 20 sessions — for line charts (tương quan & diễn biến)
    const histQueriesLine = useQueries({
        queries: allTickers.map(ticker => ({
            queryKey: ['groups', 'hist_index', ticker, LINE_SESSIONS],
            queryFn: async () => {
                const response = await apiClient<RawMarketData[]>({
                    url: '/api/v1/sse/rest/home_hist_index',
                    method: 'GET',
                    queryParams: { ticker, limit: LINE_SESSIONS },
                    requireAuth: false,
                });
                return response.data || [];
            },
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
        })),
    });

    // Split histQueries by group
    const mOff = GROUP_MARKET.length;
    const fOff = mOff + GROUP_FLOW.length;

    const marketHist5 = histQueries5.slice(0, mOff);
    const flowHist5 = histQueries5.slice(mOff, fOff);
    const capHist5 = histQueries5.slice(fOff);

    const marketHistLine = histQueriesLine.slice(0, mOff);
    const flowHistLine = histQueriesLine.slice(mOff, fOff);
    const capHistLine = histQueriesLine.slice(fOff);

    return (
        <Box sx={{ py: 2 }}>
            <Typography variant="h1" sx={{ fontSize: getResponsiveFontSize('h1'), mb: 3 }}>
                Nhóm cổ phiếu
            </Typography>

            {/* Index Table */}
            <StockTable
                data={indexData}
                isLoading={isLoading}
            />

            {/* ========== 3 NHÓM BIỂU ĐỒ ========== */}
            {!isLoading && (
                <>
                    {/* Nhóm Thị trường: FNXINDEX, FNX100 */}
                    <GroupChartRow
                        title="Nhóm thị trường"
                        tickers={GROUP_MARKET}
                        rawDataMap={rawDataMap}
                        histQueries5={marketHist5}
                        histQueriesLine={marketHistLine}
                    />

                    {/* Nhóm Dòng tiền: VUOTTROI, ONDINH, SUKIEN */}
                    <GroupChartRow
                        title="Nhóm dòng tiền"
                        tickers={GROUP_FLOW}
                        rawDataMap={rawDataMap}
                        histQueries5={flowHist5}
                        histQueriesLine={flowHistLine}
                    />

                    {/* Nhóm Vốn hóa: LARGECAP, MIDCAP, SMALLCAP */}
                    <GroupChartRow
                        title="Nhóm vốn hoá"
                        tickers={GROUP_CAP}
                        rawDataMap={rawDataMap}
                        histQueries5={capHist5}
                        histQueriesLine={capHistLine}
                    />
                </>
            )}
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
    return DISPLAY_INDEXES
        .filter((ticker) => rawDataMap.has(ticker))
        .map((ticker) => {
            const item = rawDataMap.get(ticker)!;
            return {
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
            };
        });
}
