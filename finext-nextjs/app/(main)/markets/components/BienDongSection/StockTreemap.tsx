'use client';

import { useMemo, memo, useCallback } from 'react';
import { Box, useTheme, Skeleton } from '@mui/material';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import type { StockData } from '../../../home/components/marketSection/MarketVolatility';
import { fontWeight, trendColors } from 'theme/tokens';

/** Get VSI color hex based on VSI value (mirrors colorHelpers.ts getVsiColor logic) */
function getVsiColorHex(vsi: number, isDark: boolean): string {
    if (vsi === 0) return isDark ? '#e0e0a0' : '#eadb08'; // ref
    if (vsi < 0.6) return isDark ? trendColors.floor.dark : trendColors.floor.light; // floor (cyan)
    if (vsi < 0.9) return isDark ? trendColors.down.dark : trendColors.down.light; // down (red)
    if (vsi < 1.2) return isDark ? '#e0e0a0' : '#eadb08'; // ref (yellow)
    if (vsi < 1.5) return isDark ? trendColors.up.dark : trendColors.up.light; // up (green)
    return isDark ? trendColors.ceil.dark : trendColors.ceil.light; // ceil (purple)
}

/** Get flow color hex based on t0_score value (mirrors colorHelpers.ts getFlowColor logic) */
function getFlowColorHex(t0Score: number, isDark: boolean): string {
    if (t0Score > -1 && t0Score < 1) return isDark ? '#e0e0a0' : '#eadb08'; // ref (yellow)
    if (t0Score >= 1) return isDark ? trendColors.up.dark : trendColors.up.light; // up (green)
    return isDark ? trendColors.down.dark : trendColors.down.light; // down (red)
}

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

interface StockTreemapProps {
    data: StockData[];
    chartHeight?: string;
}

// ── 11-stop heatmap palette ───────────────────────────────────────────────────
// 3 fixed anchor colors: index 0 = trend.down, index 5 = trend.ref, index 10 = trend.up
// Intermediate colors are softer transitions — never darker than the anchors
// Fixed values — NO theme dependency
const HEATMAP_COLORS = [
    '#e11d1d', // 0:  trend.down — đỏ đậm (FIXED)
    '#e43232', // 1:  đỏ đậm
    '#e74b4b', // 2:  đỏ vừa
    '#ea6464', // 3:  đỏ nhạt
    '#ec8282', // 4:  đỏ nhạt nhất (vẫn rõ đỏ)
    '#eadb08', // 5:  trend.ref — vàng (FIXED, chính giữa)
    '#82e186', // 6:  xanh nhạt nhất (vẫn rõ xanh)
    '#5fd764', // 7:  xanh nhạt
    '#42cd48', // 8:  xanh vừa
    '#2cc332', // 9:  xanh đậm
    '#20b927', // 10: trend.up — xanh đậm (FIXED)
];

// Ceil (trần) & Floor (sàn) fixed colors — matching theme trendColors
const CEIL_COLOR = trendColors.ceil.light;
const FLOOR_COLOR = trendColors.floor.dark;

/** Get ceil/floor limit (as decimal) based on exchange */
function getExchangeLimit(exchange: string | undefined): number {
    const ex = (exchange || 'HSX').toUpperCase();
    if (ex === 'HNX' || ex.includes('HNX')) return 0.09;
    if (ex === 'UPCOM' || ex.includes('UPCOM')) return 0.135;
    return 0.065; // HSX default
}

// Fixed global range: ±5% — shared across ALL industries
// index 0 = -6%, index 5 = 0%, index 10 = +6%
const FIXED_RANGE = 0.06;

/**
 * Pick color from 11-stop palette using a FIXED global range of ±5%.
 * index 0 → -5%, index 5 → 0%, index 10 → +5%.
 * Values beyond ±5% are clamped to index 0 or index 10.
 * Ceil/floor by exchange takes priority (CEIL_COLOR / FLOOR_COLOR).
 */
function pickColor(pctChange: number, exchange?: string): string {
    const MID = 5;
    if (Math.abs(pctChange) < 1e-9) return HEATMAP_COLORS[MID];

    // Check ceil/floor based on exchange — highest priority
    const limit = getExchangeLimit(exchange);
    if (pctChange >= limit) return CEIL_COLOR;
    if (pctChange <= -limit) return FLOOR_COLOR;

    if (pctChange < 0) {
        // t>0 → index 4 (nhạt nhất); t=1 → index 0 (đỏ đậm = -5%)
        const t = Math.min(Math.abs(pctChange) / FIXED_RANGE, 1);
        const index = MID - Math.ceil(t * MID); // maps 4..0
        return HEATMAP_COLORS[Math.max(0, index)];
    } else {
        // t>0 → index 6 (nhạt nhất); t=1 → index 10 (xanh đậm = +5%)
        const t = Math.min(pctChange / FIXED_RANGE, 1);
        const index = MID + Math.ceil(t * MID); // maps 6..10
        return HEATMAP_COLORS[Math.min(10, index)];
    }
}

// Max number of stocks to display globally (top by trading value)
const MAX_STOCKS_GLOBAL = 200;

// ── Chart options (fully static — no theme dependency) ────────────────────────

const STATIC_OPTIONS: ApexOptions = {
    chart: {
        type: 'treemap',
        background: 'transparent',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: false },
    },
    legend: { show: false },
    dataLabels: {
        enabled: true,
        style: {
            fontSize: '12px',
            fontWeight: fontWeight.bold,
            fontFamily: 'inherit',
            colors: ['#fff'],
        },
        formatter: function (text: string, op: any) {
            const pctChange =
                op.w?.config?.series?.[op.seriesIndex]?.data?.[op.dataPointIndex]?.pctChange;
            if (pctChange === undefined) return [text];
            const pctStr = `${pctChange >= 0 ? '+' : ''}${(pctChange * 100).toFixed(2)}%`;
            return [text, pctStr];
        },
        offsetY: -2,
    },
    plotOptions: {
        treemap: {
            distributed: false,
            enableShades: false,
            useFillColorAsStroke: false,
            borderRadius: 0,
            dataLabels: {
                format: 'truncate',
            },
        },
    },
    stroke: {
        width: 1,
        colors: ['rgba(0,0,0,0.15)'],
    },
    title: { text: undefined },
    states: {
        hover: { filter: { type: 'darken', value: 0.09 } as any },
        active: { filter: { type: 'none' } },
    },
};

// ── Inner chart component (memoized to prevent re-renders) ────────────────────

const TreemapChart = memo(function TreemapChart({
    series,
    height,
    isDark,
    onStockClick,
}: {
    series: ApexAxisChartSeries;
    height: string;
    isDark: boolean;
    onStockClick: (ticker: string) => void;
}) {
    const options: ApexOptions = useMemo(
        () => ({
            ...STATIC_OPTIONS,
            chart: {
                ...STATIC_OPTIONS.chart,
                events: {
                    click: function (event, chartContext, config) {
                        const { seriesIndex, dataPointIndex, config: chartConfig } = config;
                        if (seriesIndex !== undefined && dataPointIndex !== undefined && dataPointIndex !== -1) {
                            const ticker = chartConfig.series[seriesIndex]?.data?.[dataPointIndex]?.x;
                            if (ticker) {
                                onStockClick(ticker);
                            }
                        }
                    }
                }
            },
            tooltip: {
                enabled: true,
                custom: function ({ seriesIndex, dataPointIndex, w }: any) {
                    const seriesConfig = w.config.series[seriesIndex];
                    const dp = seriesConfig?.data?.[dataPointIndex];
                    if (!dp) return '';

                    const ticker = dp.x || '';
                    const industryName = seriesConfig?.name || '';
                    const pctChange = dp.pctChange;
                    const tradingValue = dp.y || 0;
                    const closePrice = dp.closePrice;

                    const pctStr =
                        pctChange !== undefined
                            ? `${pctChange >= 0 ? '+' : ''}${(pctChange * 100).toFixed(2)}%`
                            : '—';

                    const priceStr = closePrice !== undefined
                        ? closePrice.toFixed(2)
                        : '—';

                    const valueStr = `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(tradingValue)} tỷ`;

                    const t0Score = dp.t0Score;
                    const vsi = dp.vsi;

                    const bgColor = isDark ? 'rgba(26,26,26,0.95)' : 'rgba(255,255,255,0.95)';
                    const textColor = isDark ? '#e0e0e0' : '#333';
                    const labelColor = isDark ? '#9e9e9e' : '#757575';

                    const vsiPct = vsi !== undefined ? (vsi * 100).toFixed(1) : '—';
                    const vsiColor = vsi !== undefined ? getVsiColorHex(vsi, isDark) : textColor;
                    const flowColor = t0Score !== undefined ? getFlowColorHex(t0Score, isDark) : textColor;

                    return `<div style="background:${bgColor};border:none;border-radius:8px;padding:12px 14px;color:${textColor};min-width:180px;box-shadow:none!important;">
                        <div style="font-weight:700;font-size:14px;margin-bottom:4px;display:flex;align-items:center;gap:8px;">
                            <span style="width:12px;height:12px;border-radius:3px;background:${dp.fillColor};display:inline-block;"></span>
                            ${ticker}
                            <span style="font-weight:600;font-size:12px;opacity:0.7;">${priceStr}</span>
                            <span style="font-weight:600;font-size:12px;color:${dp.fillColor};">${pctStr}</span>
                        </div>
                        <div style="font-size:12px;opacity:0.6;margin-bottom:6px;">${industryName}</div>
                        <div style="font-size:12px;margin-bottom:3px;">
                            <span style="color:${labelColor};">GTGD:</span> <b>${valueStr}</b>
                        </div>
                        <div style="font-size:12px;margin-bottom:3px;">
                            <span style="color:${labelColor};">Dòng tiền:</span> <b style="color:${flowColor};">${t0Score !== undefined ? t0Score.toFixed(2) : '—'}</b>
                        </div>
                        <div style="font-size:12px;">
                            <span style="color:${labelColor};">Thanh khoản:</span> <b style="color:${vsiColor};">${vsiPct}%</b>
                        </div>
                    </div>`;
                },
            },
        }),
        [isDark, onStockClick]
    );

    return <Chart options={options} series={series} type="treemap" height={height} width="100%" />;
});

// ── Main Component ────────────────────────────────────────────────────────────

export default function StockTreemap({ data, chartHeight = '550px' }: StockTreemapProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const router = useRouter();

    const handleStockClick = useCallback((ticker: string) => {
        router.push(`/stocks/${ticker.toLowerCase()}`);
    }, [router]);

    // Series: only depends on data (not theme) → stable on theme switch
    const series = useMemo(() => {
        if (!data || data.length === 0) return [];

        // Deduplicate by ticker (keep first occurrence)
        const seen = new Set<string>();
        const uniqueData: StockData[] = [];
        for (const stock of data) {
            if (!seen.has(stock.ticker)) {
                seen.add(stock.ticker);
                uniqueData.push(stock);
            }
        }

        // Keep only top N stocks by trading value globally
        uniqueData.sort((a, b) => (b.trading_value || 0) - (a.trading_value || 0));
        const topData = uniqueData.slice(0, MAX_STOCKS_GLOBAL);

        // Group by industry
        const grouped = new Map<string, StockData[]>();
        for (const stock of topData) {
            const industry = stock.industry_name || 'Khác';
            if (!grouped.has(industry)) grouped.set(industry, []);
            grouped.get(industry)!.push(stock);
        }

        return Array.from(grouped.entries())
            .map(([name, stocks]) => {
                const totalValue = stocks.reduce((s, st) => s + (st.trading_value || 0), 0);

                return {
                    name,
                    totalValue,
                    data: stocks.map((stock) => ({
                        x: stock.ticker,
                        y: Math.max(stock.trading_value || 0, 1),
                        // Fixed global range ±6.5% — same scale for all industries
                        fillColor: pickColor(stock.pct_change, stock.exchange),
                        pctChange: stock.pct_change,
                        closePrice: stock.close,
                        vsi: stock.vsi,
                        t0Score: stock.t0_score,
                    })),
                };
            })
            .sort((a, b) => b.totalValue - a.totalValue)
            .map(({ name, data: d }) => ({ name, data: d }));
    }, [data]);

    const isLoading = !data || data.length === 0 || series.length === 0;

    return (
        <Box
            sx={{
                width: '100%',
                height: chartHeight,
                mt: -1,
                '& .apexcharts-tooltip': {
                    boxShadow: 'none !important',
                    filter: 'none !important',
                    background: 'transparent !important',
                    border: 'none !important',
                    padding: '0 !important',
                },
                '& .apexcharts-tooltip.apexcharts-theme-light, & .apexcharts-tooltip.apexcharts-theme-dark': {
                    boxShadow: 'none !important',
                    filter: 'none !important',
                    background: 'transparent !important',
                },
                // Remove border-radius from all treemap rects (including industry headers)
                '& rect': {
                    rx: '0 !important',
                    ry: '0 !important',
                },
                '& .apexcharts-series rect': {
                    cursor: 'pointer',
                },
            }}
        >
            {isLoading ? (
                <Box sx={{ position: 'relative', width: '100%', height: '100%', mt: 4, overflow: 'hidden' }}>
                    {/* Row 1: 3 large blocks */}
                    <Skeleton variant="rectangular" animation="wave" sx={{ position: 'absolute', top: 0, left: 0, width: '35%', height: '55%', borderRadius: 0 }} />
                    <Skeleton variant="rectangular" animation="wave" sx={{ position: 'absolute', top: 0, left: 'calc(35% + 1px)', width: '30%', height: '35%', borderRadius: 0 }} />
                    <Skeleton variant="rectangular" animation="wave" sx={{ position: 'absolute', top: 0, left: 'calc(65% + 2px)', width: 'calc(35% - 2px)', height: '55%', borderRadius: 0 }} />
                    {/* Row 1 mid-right: 2 smaller blocks */}
                    <Skeleton variant="rectangular" animation="wave" sx={{ position: 'absolute', top: 'calc(35% + 1px)', left: 'calc(35% + 1px)', width: '15%', height: 'calc(20% - 1px)', borderRadius: 0 }} />
                    <Skeleton variant="rectangular" animation="wave" sx={{ position: 'absolute', top: 'calc(35% + 1px)', left: 'calc(50% + 2px)', width: 'calc(15% - 1px)', height: 'calc(20% - 1px)', borderRadius: 0 }} />
                    {/* Row 2: medium blocks */}
                    <Skeleton variant="rectangular" animation="wave" sx={{ position: 'absolute', top: 'calc(55% + 1px)', left: 0, width: '22%', height: 'calc(45% - 1px)', borderRadius: 0 }} />
                    <Skeleton variant="rectangular" animation="wave" sx={{ position: 'absolute', top: 'calc(55% + 1px)', left: 'calc(22% + 1px)', width: '18%', height: '25%', borderRadius: 0 }} />
                    <Skeleton variant="rectangular" animation="wave" sx={{ position: 'absolute', top: 'calc(55% + 1px)', left: 'calc(40% + 2px)', width: '25%', height: 'calc(45% - 1px)', borderRadius: 0 }} />
                    <Skeleton variant="rectangular" animation="wave" sx={{ position: 'absolute', top: 'calc(55% + 1px)', left: 'calc(65% + 3px)', width: '17%', height: '25%', borderRadius: 0 }} />
                    <Skeleton variant="rectangular" animation="wave" sx={{ position: 'absolute', top: 'calc(55% + 1px)', left: 'calc(82% + 4px)', width: 'calc(18% - 4px)', height: 'calc(45% - 1px)', borderRadius: 0 }} />
                    {/* Row 2 bottom-small */}
                    <Skeleton variant="rectangular" animation="wave" sx={{ position: 'absolute', top: 'calc(80% + 2px)', left: 'calc(22% + 1px)', width: '9%', height: 'calc(20% - 2px)', borderRadius: 0 }} />
                    <Skeleton variant="rectangular" animation="wave" sx={{ position: 'absolute', top: 'calc(80% + 2px)', left: 'calc(31% + 2px)', width: 'calc(9% - 1px)', height: 'calc(20% - 2px)', borderRadius: 0 }} />
                    <Skeleton variant="rectangular" animation="wave" sx={{ position: 'absolute', top: 'calc(80% + 2px)', left: 'calc(65% + 3px)', width: '8%', height: 'calc(20% - 2px)', borderRadius: 0 }} />
                    <Skeleton variant="rectangular" animation="wave" sx={{ position: 'absolute', top: 'calc(80% + 2px)', left: 'calc(73% + 4px)', width: 'calc(9% - 1px)', height: 'calc(20% - 2px)', borderRadius: 0 }} />
                </Box>
            ) : (
                <TreemapChart series={series} height={chartHeight} isDark={isDark} onStockClick={handleStockClick} />
            )}
        </Box>
    );
}
