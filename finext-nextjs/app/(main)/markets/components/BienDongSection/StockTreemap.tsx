'use client';

import { useMemo, memo, useCallback } from 'react';
import { Box, useTheme } from '@mui/material';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import type { StockData } from '../../../components/marketSection/MarketVolatility';
import { fontWeight } from 'theme/tokens';

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
    '#e3431a', // 1:  cam đỏ đậm
    '#e56916', // 2:  cam đỏ
    '#e78f12', // 3:  cam
    '#e9b50d', // 4:  cam vàng
    '#eadb08', // 5:  trend.ref — vàng (FIXED, chính giữa)
    '#c2d40e', // 6:  vàng xanh
    '#99ce14', // 7:  xanh nhạt
    '#71c71a', // 8:  xanh lá nhạt
    '#48c020', // 9:  xanh lá trung
    '#20b927', // 10: trend.up — xanh đậm (FIXED)
];

/**
 * Pick color from 11-stop palette, per-industry normalized.
 * Positive and negative sides are normalized INDEPENDENTLY.
 */
function pickColor(pctChange: number, maxNeg: number, maxPos: number): string {
    const MID = 5;
    if (Math.abs(pctChange) < 0.0003) return HEATMAP_COLORS[MID];

    if (pctChange < 0) {
        const t = maxNeg < 0.0001 ? 0 : Math.min(Math.abs(pctChange) / maxNeg, 1);
        const index = MID - Math.round(t * MID);
        return HEATMAP_COLORS[Math.max(0, index)];
    } else {
        const t = maxPos < 0.0001 ? 0 : Math.min(pctChange / maxPos, 1);
        const index = MID + Math.round(t * MID);
        return HEATMAP_COLORS[Math.min(10, index)];
    }
}

// Max number of stocks to display per industry
const MAX_STOCKS_PER_INDUSTRY = 15;

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
        hover: { filter: { type: 'darken', value: 0.08 } as any },
        active: { filter: { type: 'none' } },
    },
};

// ── Inner chart component (memoized to prevent re-renders) ────────────────────

const TreemapChart = memo(function TreemapChart({
    series,
    height,
    isDark,
}: {
    series: ApexAxisChartSeries;
    height: string;
    isDark: boolean;
}) {
    const options: ApexOptions = useMemo(
        () => ({
            ...STATIC_OPTIONS,
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

                    const pctStr =
                        pctChange !== undefined
                            ? `${pctChange >= 0 ? '+' : ''}${(pctChange * 100).toFixed(2)}%`
                            : '—';

                    const valueStr =
                        tradingValue >= 1e9
                            ? `${(tradingValue / 1e9).toFixed(1)} tỷ`
                            : tradingValue >= 1e6
                                ? `${(tradingValue / 1e6).toFixed(0)} triệu`
                                : tradingValue.toLocaleString('vi-VN');

                    const bgColor = isDark ? 'rgba(26,26,26,0.95)' : 'rgba(255,255,255,0.95)';
                    const textColor = isDark ? '#e0e0e0' : '#333';

                    return `<div style="background:${bgColor};border:none;border-radius:8px;padding:12px 14px;color:${textColor};min-width:180px;box-shadow:none!important;">
                        <div style="font-weight:700;font-size:14px;margin-bottom:6px;display:flex;align-items:center;gap:8px;">
                            <span style="width:12px;height:12px;border-radius:3px;background:${dp.fillColor};display:inline-block;"></span>
                            ${ticker}
                            <span style="font-weight:600;font-size:12px;color:${dp.fillColor};">${pctStr}</span>
                        </div>
                        <div style="font-size:12px;opacity:0.7;margin-bottom:4px;">${industryName}</div>
                        <div style="font-size:12px;">GTGD: <b>${valueStr}</b></div>
                    </div>`;
                },
            },
        }),
        [isDark]
    );

    return <Chart options={options} series={series} type="treemap" height={height} width="100%" />;
});

// ── Main Component ────────────────────────────────────────────────────────────

export default function StockTreemap({ data, chartHeight = '550px' }: StockTreemapProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

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

        // Group by industry
        const grouped = new Map<string, StockData[]>();
        for (const stock of uniqueData) {
            const industry = stock.industry_name || 'Khác';
            if (!grouped.has(industry)) grouped.set(industry, []);
            grouped.get(industry)!.push(stock);
        }

        return Array.from(grouped.entries())
            .map(([name, stocks]) => {
                const totalValue = stocks.reduce((s, st) => s + (st.trading_value || 0), 0);

                // Limit stocks per industry for performance
                const topStocks = stocks
                    .sort((a, b) => (b.trading_value || 0) - (a.trading_value || 0))
                    .slice(0, MAX_STOCKS_PER_INDUSTRY);

                // Per-industry: separate max for positive and negative sides
                let maxNeg = 0.001;
                let maxPos = 0.001;
                for (const s of topStocks) {
                    const pct = s.pct_change || 0;
                    if (pct < 0 && Math.abs(pct) > maxNeg) maxNeg = Math.abs(pct);
                    if (pct > 0 && pct > maxPos) maxPos = pct;
                }

                return {
                    name,
                    totalValue,
                    data: topStocks.map((stock) => ({
                        x: stock.ticker,
                        y: Math.max(stock.trading_value || 0, 1),
                        fillColor: pickColor(stock.pct_change, maxNeg, maxPos),
                        pctChange: stock.pct_change,
                    })),
                };
            })
            .sort((a, b) => b.totalValue - a.totalValue)
            .map(({ name, data: d }) => ({ name, data: d }));
    }, [data]);

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
            }}
        >
            <TreemapChart series={series} height={chartHeight} isDark={isDark} />
        </Box>
    );
}
