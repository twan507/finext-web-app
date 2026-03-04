'use client';

import { useMemo, memo } from 'react';
import { Box, useTheme, Skeleton } from '@mui/material';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { fontWeight } from 'theme/tokens';
import type { NNTDRecord } from './NNTDSummaryPanel';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

interface NNTDTreemapProps {
    data: NNTDRecord[];
    chartHeight?: string;
    seriesName?: string;
}

// ── 11-stop heatmap palette (same as StockTreemap) ────────────────────────────
const HEATMAP_COLORS = [
    '#e11d1d', // 0:  trend.down
    '#e3431a', // 1
    '#e56916', // 2
    '#e78f12', // 3
    '#e9b50d', // 4
    '#eadb08', // 5:  trend.ref (mid)
    '#c2d40e', // 6
    '#99ce14', // 7
    '#71c71a', // 8
    '#48c020', // 9
    '#20b927', // 10: trend.up
];

/**
 * Pick color from 11-stop palette, normalized independently for positive/negative.
 */
function pickColor(netValue: number, maxNeg: number, maxPos: number): string {
    const MID = 5;
    if (Math.abs(netValue) < 0.001) return HEATMAP_COLORS[MID];

    if (netValue < 0) {
        const t = maxNeg < 0.001 ? 0 : Math.min(Math.abs(netValue) / maxNeg, 1);
        const index = MID - Math.round(t * MID);
        return HEATMAP_COLORS[Math.max(0, index)];
    } else {
        const t = maxPos < 0.001 ? 0 : Math.min(netValue / maxPos, 1);
        const index = MID + Math.round(t * MID);
        return HEATMAP_COLORS[Math.min(10, index)];
    }
}

const MAX_STOCKS = 100;

// ── Static chart options ──────────────────────────────────────────────────────

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
            const netValue =
                op.w?.config?.series?.[op.seriesIndex]?.data?.[op.dataPointIndex]?.netValue;
            if (netValue === undefined) return [text];
            const valStr = `${netValue >= 0 ? '+' : ''}${netValue.toFixed(2)} tỷ`;
            return [text, valStr];
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

// ── Inner chart (memoized) ────────────────────────────────────────────────────

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
                    const dp = w.config.series[seriesIndex]?.data?.[dataPointIndex];
                    if (!dp) return '';

                    const ticker = dp.x || '';
                    const netValue = dp.netValue || 0;
                    const buyValue = dp.buyValue || 0;
                    const sellValue = dp.sellValue || 0;

                    const fmtVal = (v: number) =>
                        `${v >= 0 ? '+' : ''}${v.toFixed(2)} tỷ`;
                    const fmtAbsVal = (v: number) =>
                        `${Math.abs(v).toFixed(2)} tỷ`;

                    const bgColor = isDark ? 'rgba(26,26,26,0.95)' : 'rgba(255,255,255,0.95)';
                    const textColor = isDark ? '#e0e0e0' : '#333';

                    return `<div style="background:${bgColor};border:none;border-radius:8px;padding:12px 14px;color:${textColor};min-width:180px;box-shadow:none!important;">
                        <div style="font-weight:700;font-size:14px;margin-bottom:6px;display:flex;align-items:center;gap:8px;">
                            <span style="width:12px;height:12px;border-radius:3px;background:${dp.fillColor};display:inline-block;"></span>
                            ${ticker}
                            <span style="font-weight:600;font-size:12px;color:${dp.fillColor};">${fmtVal(netValue)}</span>
                        </div>
                        <div style="font-size:12px;padding:2px 0;">Mua: <b>${fmtAbsVal(buyValue)}</b></div>
                        <div style="font-size:12px;padding:2px 0;">Bán: <b>${fmtAbsVal(sellValue)}</b></div>
                    </div>`;
                },
            },
        }),
        [isDark]
    );

    return <Chart options={options} series={series} type="treemap" height={height} width="100%" />;
});

// ── Main Component ────────────────────────────────────────────────────────────

export default function NNTDTreemap({ data, chartHeight = '550px', seriesName = 'NN mua ròng' }: NNTDTreemapProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const series = useMemo(() => {
        if (!data || data.length === 0) return [];

        // Lấy ngày mới nhất có dữ liệu thực (không phải toàn 0)
        const uniqueDates = Array.from(new Set(data.map((r) => r.date))).sort((a, b) => b.localeCompare(a));
        let targetDate = uniqueDates[0];
        for (const date of uniqueDates) {
            const records = data.filter((r) => r.date === date);
            const hasData = records.some(
                (r) => r.buy_value !== 0 || r.sell_value !== 0 || r.net_value !== 0
            );
            if (hasData) {
                targetDate = date;
                break;
            }
        }
        const latestRecords = data.filter((r) => r.date === targetDate);

        // Deduplicate by ticker (keep first)
        const seen = new Set<string>();
        const unique: NNTDRecord[] = [];
        for (const r of latestRecords) {
            if (!seen.has(r.ticker)) {
                seen.add(r.ticker);
                unique.push(r);
            }
        }

        // Sort by abs(net_value) descending, keep top N
        unique.sort((a, b) => Math.abs(b.net_value || 0) - Math.abs(a.net_value || 0));
        const topData = unique.slice(0, MAX_STOCKS);

        // Compute max positive / negative for color normalization
        let maxNeg = 0.001;
        let maxPos = 0.001;
        for (const r of topData) {
            const v = r.net_value || 0;
            if (v < 0 && Math.abs(v) > maxNeg) maxNeg = Math.abs(v);
            if (v > 0 && v > maxPos) maxPos = v;
        }

        // Single series (no industry grouping)
        const seriesData = topData.map((r) => ({
            x: r.ticker,
            y: Math.max(Math.abs(r.net_value || 0), 1),
            fillColor: pickColor(r.net_value || 0, maxNeg, maxPos),
            netValue: r.net_value || 0,
            buyValue: r.buy_value || 0,
            sellValue: r.sell_value || 0,
        }));

        return [{ name: seriesName, data: seriesData }];
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
                '& rect': {
                    rx: '0 !important',
                    ry: '0 !important',
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
                <TreemapChart series={series} height={chartHeight} isDark={isDark} />
            )}
        </Box>
    );
}
