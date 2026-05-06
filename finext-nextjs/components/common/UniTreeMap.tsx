'use client';

import { useMemo, memo, useCallback } from 'react';
import { Box, useTheme, Skeleton } from '@mui/material';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import type { StockData } from '../../app/(main)/home/components/marketSection/MarketVolatility';
import { fontWeight, trendColors } from 'theme/tokens';

/** Get VSI color hex based on VSI value */
function getVsiColorHex(vsi: number, isDark: boolean): string {
    if (vsi === 0) return isDark ? '#e0e0a0' : '#eadb08';
    if (vsi < 0.6) return isDark ? trendColors.floor.dark : trendColors.floor.light;
    if (vsi < 0.9) return isDark ? trendColors.down.dark : trendColors.down.light;
    if (vsi < 1.2) return isDark ? '#e0e0a0' : '#eadb08';
    if (vsi < 1.5) return isDark ? trendColors.up.dark : trendColors.up.light;
    return isDark ? trendColors.ceil.dark : trendColors.ceil.light;
}

/** Get flow color hex based on t0_score value */
function getFlowColorHex(t0Score: number, isDark: boolean): string {
    if (t0Score > -1 && t0Score < 1) return isDark ? '#e0e0a0' : '#eadb08';
    if (t0Score >= 1) return isDark ? trendColors.up.dark : trendColors.up.light;
    return isDark ? trendColors.down.dark : trendColors.down.light;
}

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

interface UniTreeMapProps {
    data: StockData[];
    chartHeight?: string;
    seriesName?: string;
}

// ── 11-stop heatmap palette ───────────────────────────────────────────────────

const HEATMAP_COLORS = [
    '#e11d1d',
    '#e43232',
    '#e74b4b',
    '#ea6464',
    '#ec8282',
    '#eadb08',
    '#82e186',
    '#5fd764',
    '#42cd48',
    '#2cc332',
    '#20b927',
];

const CEIL_COLOR = trendColors.ceil.light;
const FLOOR_COLOR = trendColors.floor.dark;

function getExchangeLimit(exchange: string | undefined): number {
    const ex = (exchange || 'HSX').toUpperCase();
    if (ex === 'HNX' || ex.includes('HNX')) return 0.09;
    if (ex === 'UPCOM' || ex.includes('UPCOM')) return 0.135;
    return 0.065;
}

const FIXED_RANGE = 0.06;

function pickColor(pctChange: number, exchange?: string): string {
    const MID = 5;
    if (Math.abs(pctChange) < 1e-9) return HEATMAP_COLORS[MID];

    const limit = getExchangeLimit(exchange);
    if (pctChange >= limit) return CEIL_COLOR;
    if (pctChange <= -limit) return FLOOR_COLOR;

    if (pctChange < 0) {
        const t = Math.min(Math.abs(pctChange) / FIXED_RANGE, 1);
        const index = MID - Math.ceil(t * MID);
        return HEATMAP_COLORS[Math.max(0, index)];
    } else {
        const t = Math.min(pctChange / FIXED_RANGE, 1);
        const index = MID + Math.ceil(t * MID);
        return HEATMAP_COLORS[Math.min(10, index)];
    }
}

const MAX_STOCKS_GLOBAL = 200;

// ── Chart options ─────────────────────────────────────────────────────────────

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

// ── Inner chart component ─────────────────────────────────────────────────────

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
                    click: function (_event, _chartContext, config) {
                        const { seriesIndex, dataPointIndex, config: chartConfig } = config;
                        if (seriesIndex !== undefined && dataPointIndex !== undefined && dataPointIndex !== -1) {
                            const ticker = chartConfig.series[seriesIndex]?.data?.[dataPointIndex]?.x;
                            if (ticker) {
                                onStockClick(ticker);
                            }
                        }
                    },
                },
            },
            tooltip: {
                enabled: true,
                custom: function ({ seriesIndex, dataPointIndex, w }: any) {
                    const dp = w.config.series[seriesIndex]?.data?.[dataPointIndex];
                    if (!dp) return '';

                    const ticker = dp.x || '';
                    const pctChange = dp.pctChange;
                    const tradingValue = dp.y || 0;
                    const closePrice = dp.closePrice;

                    const pctStr =
                        pctChange !== undefined
                            ? `${pctChange >= 0 ? '+' : ''}${(pctChange * 100).toFixed(2)}%`
                            : '—';

                    const priceStr = closePrice !== undefined ? closePrice.toFixed(2) : '—';

                    const valueStr = `${new Intl.NumberFormat('en-US', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                    }).format(tradingValue)} tỷ`;

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

export default function UniTreeMap({ data, chartHeight = '550px', seriesName = 'Cổ phiếu' }: UniTreeMapProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const router = useRouter();

    const handleStockClick = useCallback((ticker: string) => {
        router.push(`/stocks/${ticker.toLowerCase()}`);
    }, [router]);

    const series = useMemo(() => {
        if (!data || data.length === 0) return [];

        // Deduplicate by ticker
        const seen = new Set<string>();
        const uniqueData: StockData[] = [];
        for (const stock of data) {
            if (!seen.has(stock.ticker)) {
                seen.add(stock.ticker);
                uniqueData.push(stock);
            }
        }

        // Keep top N by trading value
        uniqueData.sort((a, b) => (b.trading_value || 0) - (a.trading_value || 0));
        const topData = uniqueData.slice(0, MAX_STOCKS_GLOBAL);

        // Single series — no industry grouping
        const seriesData = topData.map((stock) => ({
            x: stock.ticker,
            y: Math.max(stock.trading_value || 0, 1),
            fillColor: pickColor(stock.pct_change, stock.exchange),
            pctChange: stock.pct_change,
            closePrice: stock.close,
            vsi: stock.vsi,
            t0Score: stock.t0_score,
        }));

        return [{ name: seriesName, data: seriesData }];
    }, [data, seriesName]);

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
