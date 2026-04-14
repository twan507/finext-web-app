// finext-nextjs/app/(main)/charts/[id]/DetailPanel.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Box,
    Typography,
    Skeleton,
    useTheme,
    Divider,
} from '@mui/material';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'services/apiClient';
import { ISseRequest } from 'services/core/types';
import { sseClient } from 'services/sseClient';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import { getVsiColor, getPriceColor } from 'theme/colorHelpers';
import { ApexOptions } from 'apexcharts';
import PanelNewsList from './PanelNewsList';
import ReportList from 'app/(main)/reports/components/ReportList';
import type { ChartRawData } from './PageContent';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

// ─── Ticker classification (đồng bộ với backend _constants.py) ───────────────
const INDEX_TICKERS = new Set([
    'HNX30', 'HNXINDEX', 'UPINDEX', 'VN30', 'VNINDEX', 'VNXALL',
    'VN100F1M', 'VN100F1Q', 'VN100F2M', 'VN100F2Q',
    'VN30F1M', 'VN30F1Q', 'VN30F2M', 'VN30F2Q',
    'FNXINDEX', 'FNX100', 'VUOTTROI', 'ONDINH', 'SUKIEN',
    'LARGECAP', 'MIDCAP', 'SMALLCAP',
]);

const INDUSTRY_TICKERS = new Set([
    'BANLE', 'BAOHIEM', 'BDS', 'CAOSU', 'CHUNGKHOAN', 'CONGNGHE',
    'CONGNGHIEP', 'DAUKHI', 'DETMAY', 'DULICH', 'HOACHAT', 'KCN',
    'KHOANGSAN', 'KIMLOAI', 'NGANHANG', 'NHUA', 'NONGNGHIEP',
    'THUCPHAM', 'THUYSAN', 'TIENICH', 'VANTAI', 'VLXD', 'XAYDUNG', 'YTE',
]);

export type TickerType = 'stock' | 'industry' | 'index';

export function getTickerType(ticker: string): TickerType {
    const t = ticker.toUpperCase();
    if (INDUSTRY_TICKERS.has(t)) return 'industry';
    if (INDEX_TICKERS.has(t)) return 'index';
    return 'stock';
}

function getTickerDetailUrl(ticker: string, type: TickerType): string {
    const t = ticker.toLowerCase();
    switch (type) {
        case 'stock': return `/stocks/${t}`;
        case 'industry': return `/sectors/${t}`;
        case 'index': return `/groups/${t}`;
    }
}

// ─── ITD data type (from home_itd_stock / home_itd_index) ────────────────────
interface ItdRecord {
    ticker: string;
    ticker_name?: string;
    date: string;
    close: number;
    diff?: number;
    pct_change?: number;
}

// ─── Finratios data type ──────────────────────────────────────────────────────
interface FinratiosRecord {
    date?: string;
    ticker?: string;
    ryd21?: number | null; // P/E
    ryd25?: number | null; // P/B
    ryd14?: number | null; // EPS
    [key: string]: any;
}

// ─── Stock meta from home_today_stock ────────────────────────────────────────
interface StockMeta {
    exchange?: string | null;
    industry_name?: string | null;
    category_name?: string | null;
    marketcap_name?: string | null;
}

// ─── Props ───────────────────────────────────────────────────────────────────
interface DetailPanelProps {
    ticker: string;
    todayData: ChartRawData[] | null; // from chart_today_data SSE (already available)
}

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmtPrice(val: number | null | undefined, decimals = 2): string {
    if (val == null || isNaN(val)) return '—';
    return val >= 1000
        ? val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : val.toFixed(decimals);
}

function fmtVolume(val: number | null | undefined): string {
    if (val == null || isNaN(val)) return '—';
    if (val >= 1_000_000) return (val / 1_000_000).toFixed(2) + 'M';
    if (val >= 1_000) return (val / 1_000).toFixed(1) + 'K';
    return val.toLocaleString('vi-VN');
}

function fmtTy(val: number | null | undefined): string {
    if (val == null || isNaN(val)) return '—';
    // Data đã bỏ 9 số 0 → nhân lại để ra VND gốc, rồi format KMB
    const v = val * 1_000_000_000;
    if (v >= 1_000_000_000) {
        const b = v / 1_000_000_000;
        // >= 1000B: dùng , chia hàng nghìn và bỏ số thập phân
        if (b >= 1000) return b.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + 'B';
        return b.toFixed(2) + 'B';
    }
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
    if (v >= 1_000) return Math.round(v / 1_000).toString() + 'K';
    return v.toLocaleString('en-US');
}

function fmtVsi(val: number | null | undefined): string {
    if (val == null || isNaN(val)) return '—';
    return (val * 100).toFixed(2) + '%';
}

function fmtRatio(val: number | null | undefined): string {
    if (val == null || isNaN(val)) return '—';
    return val.toFixed(2);
}

function fmtEps(val: number | null | undefined): string {
    if (val == null || isNaN(val)) return '—';
    return val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ─── ITD Sparkline Chart (same pattern as MiniIndexCard) ─────────────────────
interface ChartDataPoint { value: number; dateStr: string; }

const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const vnDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const day = vnDate.getUTCDate().toString().padStart(2, '0');
    const month = (vnDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = vnDate.getUTCFullYear();
    const hours = vnDate.getUTCHours().toString().padStart(2, '0');
    const minutes = vnDate.getUTCMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
};

function ItdChart({ data, pctChange, isDark }: { data: ItdRecord[]; pctChange: number | null; isDark: boolean }) {
    const theme = useTheme();
    const pct = (pctChange ?? 0) * 100; // pct_change từ backend là dạng decimal (-0.0034 = -0.34%)
    const isUp = pct > 0;
    const isRef = Math.abs(pct) <= 0.005;
    const lineColor = isRef
        ? theme.palette.trend?.ref || '#f59e0b'
        : isUp
            ? theme.palette.trend?.up || '#26a69a'
            : theme.palette.trend?.down || '#ef5350';

    const chartData = useMemo<ChartDataPoint[]>(() => {
        const sorted = [...data]
            .filter((d) => d.date && typeof d.close === 'number' && !isNaN(d.close))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return sorted.map((d) => ({ value: d.close, dateStr: d.date }));
    }, [data]);

    const lastDataIndex = chartData.length - 1;
    const MIN_POINTS = 58;
    const FIXED_POINTS = Math.max(MIN_POINTS, chartData.length + 2);

    const paddedData = useMemo(() => {
        const values = chartData.map((d) => d.value);
        while (values.length < FIXED_POINTS) values.push(null as unknown as number);
        return values;
    }, [chartData, FIXED_POINTS]);

    const chartOptions: ApexOptions = useMemo(() => {
        const gridColor = theme.palette.component.chart.gridLine;
        const axisColor = theme.palette.text.secondary;

        // ── Nice tick: chọn step đẹp, snap min/max để ticks luôn là số tròn ──
        let niceMin: number | undefined;
        let niceMax: number | undefined;
        let tickCount = 4;

        if (chartData.length > 0) {
            const values = chartData.map((d) => d.value);
            const rawMin = Math.min(...values);
            const rawMax = Math.max(...values);
            const rawRange = rawMax - rawMin || rawMax * 0.01;
            const isSmall = rawMax < 100;

            // Danh sách step đẹp theo cấp giá
            const niceSteps = isSmall
                ? [0.05, 0.10, 0.20, 0.50, 1.00]
                : [0.5, 1.0, 2.0, 5.0, 10.0];

            // Chọn step nhỏ nhất cho ≤5 ticks
            let step = niceSteps[0];
            for (const s of niceSteps) {
                step = s;
                if (Math.ceil(rawRange / s) + 1 <= 5) break;
            }

            // Snap min xuống, max lên → data luôn nằm trong range
            niceMin = Math.floor(rawMin / step) * step;
            niceMax = Math.ceil(rawMax / step) * step;
            if (niceMax <= niceMin) niceMax = niceMin + step;

            // Round để tránh floating point: 28.799999 → 28.80
            niceMin = Math.round(niceMin * 1000) / 1000;
            niceMax = Math.round(niceMax * 1000) / 1000;
            tickCount = Math.round((niceMax - niceMin) / step);
            if (tickCount < 2) tickCount = 2;
        }

        return {
            chart: {
                type: 'area',
                sparkline: { enabled: false },
                toolbar: { show: false },
                zoom: { enabled: false },
                animations: { enabled: false },
                selection: { enabled: false },
                dropShadow: { enabled: true, top: 0, left: 0, blur: 5, opacity: 1, color: lineColor },
                parentHeightOffset: 0,
            },
            dataLabels: { enabled: false },
            legend: { show: false },
            stroke: { curve: 'smooth', width: 1.5 },
            colors: [lineColor],
            tooltip: {
                enabled: true,
                theme: isDark ? 'dark' : 'light',
                custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
                    const dp = chartData[dataPointIndex];
                    if (!dp) return '';
                    const priceStr = dp.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    return `<div style="padding:5px 10px;font-size:12px;line-height:1.5;">${formatDateTime(dp.dateStr)}<br/><strong>${priceStr}</strong></div>`;
                },
            },
            markers: {
                strokeWidth: 0,
                hover: { sizeOffset: 4 },
                discrete: lastDataIndex >= 0 ? [{
                    seriesIndex: 0, dataPointIndex: lastDataIndex,
                    fillColor: lineColor, strokeColor: '#fff', size: 4, shape: 'circle' as const,
                }] : [],
            },
            fill: {
                type: 'gradient',
                gradient: { shadeIntensity: 1, opacityFrom: isDark ? 0.40 : 0.50, opacityTo: 0, stops: [0, 100] },
            },
            grid: {
                show: true,
                borderColor: gridColor,
                strokeDashArray: 0,
                xaxis: { lines: { show: false } },
                yaxis: { lines: { show: true } },
                padding: { top: -18, right: 8, bottom: -18, left: 2 },
            },
            xaxis: {
                type: 'category',
                labels: { show: false },
                axisBorder: { show: false },
                axisTicks: { show: false },
                tooltip: { enabled: false },
            },
            yaxis: {
                show: true,
                opposite: true,
                tickAmount: tickCount,
                min: niceMin,
                max: niceMax,
                labels: {
                    show: true,
                    align: 'left' as const,
                    style: {
                        colors: [axisColor],
                        fontSize: '11px',
                        fontFamily: 'inherit',
                        fontWeight: 500,
                    },
                    formatter: (val: number) => {
                        if (val == null || isNaN(val)) return '';
                        const decimals = val >= 100 ? 1 : 2;
                        return val >= 1000
                            ? val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
                            : val.toFixed(decimals);
                    },
                    offsetX: -4,
                },
                axisBorder: { show: false },
                axisTicks: { show: false },
            },
        };
    }, [lineColor, theme, isDark, chartData, lastDataIndex, FIXED_POINTS]);

    const chartSeries = useMemo(() => [{ name: 'ITD', data: paddedData }], [paddedData]);

    if (chartData.length === 0) {
        return (
            <Box sx={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.disabled' }}>
                    Đang chờ dữ liệu ITD...
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ height: 120 }}>
            <ReactApexChart options={chartOptions} series={chartSeries} type="area" height={120} width="100%" />
        </Box>
    );
}

// ─── Stat Row ─────────────────────────────────────────────────────────────────
function StatRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, px: 1.5 }}>
            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary' }}>{label}</Typography>
            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold, color: valueColor || 'text.primary' }}>
                {value}
            </Typography>
        </Box>
    );
}

// ─── Tab Bar ─────────────────────────────────────────────────────────────────
const TABS = ['Tổng hợp', 'Tin tức'] as const;
type Tab = typeof TABS[number];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DetailPanel({ ticker, todayData }: DetailPanelProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [activeTab, setActiveTab] = useState<Tab>('Tổng hợp');

    const tickerType = getTickerType(ticker);
    const isStock = tickerType === 'stock';
    const isIndustry = tickerType === 'industry';

    // Last today record — source of truth for OHLCV + vsi + trading_value + cap_value
    const lastToday = useMemo(() => {
        if (!todayData || todayData.length === 0) return null;
        return todayData[todayData.length - 1];
    }, [todayData]);

    const pctChange = lastToday?.pct_change ?? null;
    const pct = pctChange != null ? pctChange * 100 : null;
    const isUp = (pct ?? 0) > 0;
    const isRefPrice = Math.abs(pct ?? 0) <= 0.005;

    // ── ITD SSE ──────────────────────────────────────────────────────────────
    const [itdData, setItdData] = useState<ItdRecord[]>([]);
    const itdSseRef = React.useRef<{ unsubscribe: () => void } | null>(null);
    const isMountedRef = React.useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        if (itdSseRef.current) { itdSseRef.current.unsubscribe(); itdSseRef.current = null; }

        const keyword = isStock ? 'home_itd_stock' : 'home_itd_index';
        const queryParams: Record<string, string> = { keyword };
        if (isStock) queryParams.ticker = ticker;

        const req: ISseRequest = { url: '/api/v1/sse/stream', queryParams };
        itdSseRef.current = sseClient<ItdRecord[]>(req, {
            onOpen: () => { },
            onData: (data) => {
                if (!isMountedRef.current || !data || !Array.isArray(data)) return;
                if (isStock) {
                    setItdData(data.filter((d) => d.ticker === ticker));
                } else {
                    setItdData(data.filter((d) => d.ticker === ticker.toUpperCase()));
                }
            },
            onError: () => { },
            onClose: () => { },
        });

        return () => {
            isMountedRef.current = false;
            if (itdSseRef.current) { itdSseRef.current.unsubscribe(); itdSseRef.current = null; }
        };
    }, [ticker, isStock]);

    // ── REST: Stock metadata (industry_name, category_name, marketcap_name) ──
    const { data: stockMetaArr = [] } = useQuery({
        queryKey: ['chart', 'stock_meta', ticker],
        queryFn: async () => {
            const res = await apiClient<any[]>({
                url: '/api/v1/sse/rest/home_today_stock',
                method: 'GET',
                queryParams: { ticker },
                requireAuth: false,
            });
            return res.data || [];
        },
        enabled: isStock,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });
    const stockMeta: StockMeta = stockMetaArr[0] || {};

    // Tính màu trần/sàn sau khi có stockMeta.exchange
    const priceColor = pctChange != null
        ? getPriceColor(pctChange, isStock ? (stockMeta.exchange ?? 'HSX') : 'HSX', theme)
        : theme.palette.trend?.ref || '#f59e0b';

    // ── REST: Finratios (P/E, P/B, EPS) ─────────────────────────────────────
    const finratiosEndpoint = isStock ? 'finratios_stock' : 'finratios_industry';
    const { data: finratiosArr = [] } = useQuery({
        queryKey: ['chart', 'finratios', ticker, finratiosEndpoint],
        queryFn: async () => {
            const res = await apiClient<FinratiosRecord[]>({
                url: `/api/v1/sse/rest/${finratiosEndpoint}`,
                method: 'GET',
                queryParams: { ticker },
                requireAuth: false,
            });
            return res.data || [];
        },
        enabled: isStock || isIndustry,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Latest finratios record
    const latestFinratios = useMemo<FinratiosRecord | null>(() => {
        if (!finratiosArr || finratiosArr.length === 0) return null;
        return finratiosArr[finratiosArr.length - 1];
    }, [finratiosArr]);

    // ── Panel container styles ─────────────────────────────────────────────
    const panelBg = isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)';

    return (
        <Box
            sx={{
                width: 280,
                height: '100%',
                borderLeft: 1,
                borderColor: 'divider',
                backgroundColor: panelBg,
                backdropFilter: 'blur(8px)',
                overflowY: 'auto',
                overflowX: 'hidden',
                scrollbarWidth: 'thin',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
            }}
        >
            {/* ── Header: Ticker name + Price ─────────────────────────────── */}
            <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>

                {/* Ticker name */}
                {lastToday?.ticker_name ? (
                    <Box>

                        {(isStock || isIndustry) && (
                            <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.bold, color: 'text.primary', lineHeight: 1.3, mb: 0.5 }}>
                                {lastToday.ticker_name}
                            </Typography>
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                            <Link href={getTickerDetailUrl(ticker, tickerType)} style={{ textDecoration: 'none' }}>
                                <Typography sx={{ fontSize: getResponsiveFontSize('md'), fontWeight: fontWeight.bold, color: 'text.primary', lineHeight: 1.3, mb: 0.5, '&:hover': { color: 'primary.main' }, transition: 'color 0.15s', cursor: 'pointer' }}>
                                    {ticker}
                                </Typography>
                            </Link>
                            {isStock && stockMeta.exchange && (
                                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.bold, color: 'text.secondary', lineHeight: 1.3, mb: 0.5 }}>
                                    • {stockMeta.exchange}
                                </Typography>
                            )}
                        </Box>
                    </Box>
                ) : (
                    <Skeleton variant="text" width="70%" height={22} />
                )}

                {/* Price row */}
                {lastToday ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mt: 0.25 }}>
                        <Typography sx={{ fontSize: getResponsiveFontSize('lg'), fontWeight: fontWeight.bold, color: priceColor, lineHeight: 1 }}>
                            {fmtPrice(lastToday.close)}
                        </Typography>
                        {lastToday.diff != null && (
                            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: priceColor, fontWeight: fontWeight.semibold, lineHeight: 1 }}>
                                {(lastToday.diff > 0 ? '+' : '') + fmtPrice(lastToday.diff)}
                            </Typography>
                        )}
                        {pct != null && (
                            <Box
                                component="span"
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    px: 0.6,
                                    py: 0.35,
                                    borderRadius: 1,
                                    bgcolor: priceColor,
                                    color: '#fff',
                                    fontSize: getResponsiveFontSize('xs'),
                                    fontWeight: fontWeight.semibold,
                                    lineHeight: 1,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {!isRefPrice && (
                                    <span style={{ fontSize: '0.65em', lineHeight: 1 }}>
                                        {isUp ? '▲' : '▼'}
                                    </span>
                                )}
                                {Math.abs(pct).toFixed(2)}%
                            </Box>
                        )}
                    </Box>
                ) : (
                    <Skeleton variant="text" width="60%" height={28} />
                )}
            </Box>

            {/* ── Tab Bar ──────────────────────────────────────────────────── */}
            <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
                {TABS.map((tab) => {
                    const isActive = activeTab === tab;
                    return (
                        <Box
                            key={tab}
                            component="button"
                            onClick={() => setActiveTab(tab)}
                            sx={{
                                flex: 1,
                                py: 0.75,
                                px: 1,
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                color: isActive ? 'primary.main' : 'text.secondary',
                                fontFamily: 'inherit',
                                fontSize: getResponsiveFontSize('xs'),
                                fontWeight: isActive ? fontWeight.bold : fontWeight.medium,
                                borderBottom: isActive ? '2px solid' : '2px solid transparent',
                                borderBottomColor: isActive ? 'primary.main' : 'transparent',
                                transition: 'color 0.15s, border-color 0.15s',
                                '&:hover': { color: 'primary.main' },
                            }}
                        >
                            {tab}
                        </Box>
                    );
                })}
            </Box>

            {/* ── Tab: Tổng hợp ────────────────────────────────────────────── */}
            {activeTab === 'Tổng hợp' && (
                <Box sx={{ flexGrow: 1, overflowY: 'auto', pt: 1 }}>
                    {/* ITD Chart */}
                    <Box sx={{ px: 1, pb: 0.5 }}>
                        <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', mb: 0.25, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        </Typography>
                        <ItdChart data={itdData} pctChange={pctChange} isDark={isDark} />
                    </Box>

                    {/* OHLCV Stats */}
                    <Divider sx={{ my: 0.5 }} />
                    <StatRow label="Mở cửa" value={fmtPrice(lastToday?.open)} />
                    <StatRow label="Cao nhất" value={fmtPrice(lastToday?.high)} valueColor={theme.palette.trend?.up} />
                    <StatRow label="Thấp nhất" value={fmtPrice(lastToday?.low)} valueColor={theme.palette.trend?.down} />
                    <StatRow label="Giá hiện tại" value={fmtPrice(lastToday?.close)} valueColor={priceColor} />
                    <StatRow label="Khối lượng giao dịch" value={fmtVolume(lastToday?.volume)} />
                    <StatRow
                        label="Chỉ số thanh khoản"
                        value={fmtVsi((lastToday as any)?.vsi)}
                        valueColor={(lastToday as any)?.vsi != null ? getVsiColor((lastToday as any).vsi, theme) : undefined}
                    />
                    <StatRow label="Giá trị giao dịch" value={fmtTy((lastToday as any)?.trading_value)} />
                    <StatRow label="Vốn hoá" value={fmtTy((lastToday as any)?.cap_value)} />


                    {/* Performance grid (2×2) */}
                    {lastToday && (
                        <>
                            <Divider sx={{ my: 0.5 }} />
                            <Box sx={{ px: 1.5, py: 1 }}>
                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
                                    {([
                                        { label: '1 Tuần', value: (lastToday as any)?.w_pct },
                                        { label: '1 Tháng', value: (lastToday as any)?.m_pct },
                                        { label: '1 Quý', value: (lastToday as any)?.q_pct },
                                        { label: '1 Năm', value: (lastToday as any)?.y_pct },
                                    ] as { label: string; value: number | null | undefined }[]).map((item) => {
                                        const pctVal = item.value != null && !isNaN(item.value) ? item.value * 100 : null;
                                        const isPositive = (pctVal ?? 0) > 0;
                                        const isNeutral = pctVal == null || Math.abs(pctVal) <= 0.005;
                                        const cellColor = isNeutral
                                            ? (theme.palette.trend?.ref || '#f59e0b')
                                            : isPositive
                                                ? (theme.palette.trend?.up || '#26a69a')
                                                : (theme.palette.trend?.down || '#ef5350');
                                        const bgColor = isNeutral
                                            ? (isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)')
                                            : isPositive
                                                ? (isDark ? 'rgba(38,166,154,0.12)' : 'rgba(38,166,154,0.08)')
                                                : (isDark ? 'rgba(239,83,80,0.12)' : 'rgba(239,83,80,0.08)');
                                        const displayStr = pctVal != null
                                            ? `${pctVal >= 0 ? '+' : ''}${pctVal.toFixed(2)}%`
                                            : '—';

                                        return (
                                            <Box
                                                key={item.label}
                                                sx={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    py: 0.75,
                                                    borderRadius: 1,
                                                    backgroundColor: bgColor,
                                                    border: '1px solid',
                                                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                                }}
                                            >
                                                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.bold, color: cellColor, lineHeight: 1.3 }}>
                                                    {displayStr}
                                                </Typography>
                                                <Typography sx={{ fontSize: getResponsiveFontSize('xxs').md, color: 'text.secondary', lineHeight: 1.3, mt: 0.15 }}>
                                                    {item.label}
                                                </Typography>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </Box>
                        </>
                    )}

                    {/* Stock metadata (only for stocks) */}
                    {isStock && (
                        <>
                            <Divider sx={{ my: 0.5 }} />
                            <StatRow label="Ngành nghề" value={stockMeta.industry_name || '—'} />
                            <StatRow label="Nhóm dòng tiền" value={stockMeta.category_name || '—'} />
                            <StatRow label="Nhóm vốn hoá" value={stockMeta.marketcap_name || '—'} />
                        </>
                    )}

                    {/* Financial ratios (stock + industry only) */}
                    {(isStock || isIndustry) && (
                        <>
                            <Divider sx={{ my: 0.5 }} />
                            <StatRow label="P/E" value={fmtRatio(latestFinratios?.ryd21)} />
                            <StatRow label="P/B" value={fmtRatio(latestFinratios?.ryd25)} />
                            <StatRow label="EPS (VNĐ)" value={fmtEps(latestFinratios?.ryd14)} />
                        </>
                    )}

                    <Box sx={{ height: 12 }} />
                </Box>
            )}

            {/* ── Tab: Tin tức ─────────────────────────────────────────────── */}
            {activeTab === 'Tin tức' && (
                <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 1, py: 1 }}>
                    {isIndustry ? (
                        <ReportList ticker={ticker} pageSize={10} />
                    ) : (
                        <PanelNewsList ticker={isStock ? ticker : undefined} />
                    )}
                </Box>
            )}
        </Box>
    );
}
