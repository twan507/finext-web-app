'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Box, Typography, Skeleton, useTheme, useMediaQuery } from '@mui/material';
import { RawMarketData } from 'app/(main)/home/components/marketSection/MarketIndexChart';
import MarketTrendChart, { RawTrendData, transformTrendData, TrendChartData, TrendTimeRange } from 'app/(main)/markets/components/TinHieuSecion/MarketTrendChart';
import TuongQuanDongTien from 'app/(main)/groups/components/TuongQuanDongTien';
import SubChartSkeleton from 'components/common/SubChartSkeleton';
import ChartSectionTitle from 'components/common/ChartSectionTitle';
import { useMarketUpdateTime } from 'hooks/useMarketUpdateTime';


const SucManhDongTien = dynamic(
    () => import('../SucManhDongTien'),
    { ssr: false }
);

const VsiITDIndexLineChart = dynamic(
    () => import('app/(main)/groups/[groupId]/components/VsiScoreItdLineChart'),
    { ssr: false, loading: () => <SubChartSkeleton height={280} variant="line" legendCount={2} /> }
);

function build1DTradingTimeline(referenceTimestamp?: number): number[] {
    const ref = referenceTimestamp != null
        ? new Date(referenceTimestamp)
        : new Date(Date.now() + 7 * 60 * 60 * 1000);
    const y = ref.getUTCFullYear(), m = ref.getUTCMonth(), d = ref.getUTCDate();
    const timeline: number[] = [];
    const pushRange = (sh: number, sm: number, eh: number, em: number) => {
        for (let ts = Date.UTC(y, m, d, sh, sm, 0, 0); ts <= Date.UTC(y, m, d, eh, em, 0, 0); ts += 60_000)
            timeline.push(ts);
    };
    pushRange(9, 0, 11, 30);
    pushRange(13, 0, 15, 0);
    return timeline;
}

interface DongTienSectionProps {
    ticker: string;
    indexName: string;
    todayAllData: Record<string, RawMarketData[]>;
    itdAllData: Record<string, RawMarketData[]>;
    histLineTicker: RawMarketData[];
    histLineTickerLoading: boolean;
    histLineVNINDEX: RawMarketData[];
    historyTrendData: RawTrendData[];
    trendTodayData: RawTrendData[];
    historyTrendLoading: boolean;
}

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



export default function DongTienSection({
    ticker,
    indexName,
    todayAllData,
    itdAllData,
    histLineTicker,
    histLineTickerLoading,
    histLineVNINDEX,
    historyTrendData,
    trendTodayData,
    historyTrendLoading,
}: DongTienSectionProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const updateTime = useMarketUpdateTime();

    const [trendTimeRange, setTrendTimeRange] = useState<TrendTimeRange>(isMobile ? '1M' : '3M');

    useEffect(() => {
        setTrendTimeRange(isMobile ? '1M' : '3M');
    }, [isMobile]);

    // Chart ITD: VSI + t0_score intraday
    const { vsiSeriesData, t0ScoreSeriesData, vsiIndexToTimestamp, vsiXAxisMax } = useMemo(() => {
        const rawData = (itdAllData[ticker] || []) as any[];
        const sorted = [...rawData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (sorted.length === 0) {
            return {
                vsiSeriesData: [] as { x: number; y: number }[],
                t0ScoreSeriesData: [] as { x: number; y: number }[],
                vsiIndexToTimestamp: new Map<number, number>(),
                vsiXAxisMax: undefined as number | undefined,
            };
        }

        const seen = new Set<number>();
        const points = sorted
            .map((r) => ({
                ts: Math.floor((new Date(r.date).getTime() + 7 * 60 * 60 * 1000) / 60_000) * 60_000,
                vsi: parseFloat(((r.vsi ?? 0) * 100).toFixed(2)),
                t0: parseFloat((r.t0_score ?? 0).toFixed(2)),
            }))
            .filter((p) => { if (seen.has(p.ts)) return false; seen.add(p.ts); return true; });

        const latestTs = points.length > 0 ? points[points.length - 1].ts : undefined;
        const fixedTimeline = build1DTradingTimeline(latestTs);
        const tsToIdx = new Map<number, number>();
        const idxToTs = new Map<number, number>();
        fixedTimeline.forEach((ts, idx) => { tsToIdx.set(ts, idx); idxToTs.set(idx, ts); });
        const maxIdx = idxToTs.size > 0 ? Math.max(...Array.from(idxToTs.keys())) : undefined;

        const toSeries = (field: 'vsi' | 't0') =>
            points
                .map((p) => { const idx = tsToIdx.get(p.ts); return idx !== undefined ? { x: idx, y: p[field] } : null; })
                .filter((p): p is { x: number; y: number } => p !== null);

        return {
            vsiSeriesData: toSeries('vsi'),
            t0ScoreSeriesData: toSeries('t0'),
            vsiIndexToTimestamp: idxToTs,
            vsiXAxisMax: maxIdx,
        };
    }, [itdAllData, ticker]);

    // Chart 1: Sức mạnh dòng tiền
    const dongTienDates = (() => {
        const todayForTicker = todayAllData[ticker] || [];
        const todayArr: RawMarketData[] = todayForTicker.length > 0 ? [todayForTicker[todayForTicker.length - 1]] : [];
        const merged = mergeData(histLineTicker, todayArr);
        return merged.map(d => {
            const date = new Date(d.date);
            const dd = date.getDate().toString().padStart(2, '0');
            const mm = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${dd}-${mm}`;
        });
    })();

    const t5ScoreData = (() => {
        const todayForTicker = todayAllData[ticker] || [];
        const todayArr: RawMarketData[] = todayForTicker.length > 0 ? [todayForTicker[todayForTicker.length - 1]] : [];
        const merged = mergeData(histLineTicker, todayArr);
        return merged.map(d => parseFloat(((d as any)?.t5_score ?? 0).toFixed(2)));
    })();

    const t0ScoreData = (() => {
        const todayForTicker = todayAllData[ticker] || [];
        const todayArr: RawMarketData[] = todayForTicker.length > 0 ? [todayForTicker[todayForTicker.length - 1]] : [];
        const merged = mergeData(histLineTicker, todayArr);
        return merged.map(d => parseFloat(((d as any)?.t0_score ?? 0).toFixed(2)));
    })();

    // Chart 2: Tương quan
    const tuongQuanDates = (() => {
        const todayForTicker = todayAllData[ticker] || [];
        const todayTickerArr: RawMarketData[] = todayForTicker.length > 0 ? [todayForTicker[todayForTicker.length - 1]] : [];
        const mergedTicker = mergeData(histLineTicker, todayTickerArr);

        const todayForVN = todayAllData['VNINDEX'] || [];
        const todayVNArr: RawMarketData[] = todayForVN.length > 0 ? [todayForVN[todayForVN.length - 1]] : [];
        const mergedVNINDEX = mergeData(histLineVNINDEX, todayVNArr);

        const refData = mergedTicker.length > 0 ? mergedTicker : mergedVNINDEX;
        return refData.map(d => {
            const date = new Date(d.date);
            const dd = date.getDate().toString().padStart(2, '0');
            const mm = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${dd}-${mm}`;
        });
    })();

    const tuongQuanSeries = (() => {
        const todayForTicker = todayAllData[ticker] || [];
        const todayTickerArr: RawMarketData[] = todayForTicker.length > 0 ? [todayForTicker[todayForTicker.length - 1]] : [];
        const mergedTicker = mergeData(histLineTicker, todayTickerArr);

        const todayForVN = todayAllData['VNINDEX'] || [];
        const todayVNArr: RawMarketData[] = todayForVN.length > 0 ? [todayForVN[todayForVN.length - 1]] : [];
        const mergedVNINDEX = mergeData(histLineVNINDEX, todayVNArr);

        return [
            { name: `% Dòng tiền`, data: buildCumsum(mergedTicker, d => ((d as any)?.t0_score ?? 0) / 1000) },
            { name: `% Giá`, data: buildCumsum(mergedTicker, d => d.pct_change || 0) },
            { name: `% VNINDEX`, data: buildCumsum(mergedVNINDEX, d => d.pct_change || 0) },
        ];
    })();

    // Chart 3: Cấu trúc sóng
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
        <Box>
            <ChartSectionTitle
                title={`nhóm ${indexName} trong phiên`}
                description="Theo dõi biến động dòng tiền mua/bán chủ động và chỉ số thanh khoản VSI trong ngày của nhóm."
                updateTime={updateTime}
                sx={{ mb: 1 }}
            />
            <Box sx={{ mt: 2, mb: 3 }}>
                {vsiSeriesData.length > 0 ? (
                    <VsiITDIndexLineChart
                        seriesData={vsiSeriesData}
                        t0ScoreSeriesData={t0ScoreSeriesData}
                        indexToTimestamp={vsiIndexToTimestamp}
                        xAxisMax={vsiXAxisMax}
                        chartHeight="280px"
                    />
                ) : (
                    <SubChartSkeleton height={280} variant="line" legendCount={2} />
                )}
            </Box>

            <ChartSectionTitle
                title={`nhóm ${indexName} trong tháng`}
                description="Thống kê lịch sử sức mạnh dòng tiền của nhóm và độ tương quan so với thị trường chung."
                updateTime={updateTime}
                sx={{ mt: 2 }}
            />
            <Box sx={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: isMobile ? 2 : 5,
                mt: 2
            }}>
                {/* Left: Sức mạnh dòng tiền */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    {!histLineTickerLoading && dongTienDates.length > 0 ? (
                        <SucManhDongTien
                            title=""
                            chartHeight="300px"
                            dates={dongTienDates}
                            t5ScoreData={t5ScoreData}
                            t0ScoreData={t0ScoreData}
                        />
                    ) : (
                        <SubChartSkeleton height={300} variant="mixed" legendCount={2} />
                    )}
                </Box>

                {/* Right: Tương quan */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    {!histLineTickerLoading && tuongQuanDates.length > 0 ? (
                        <TuongQuanDongTien
                            chartHeight="300px"
                            dates={tuongQuanDates}
                            series={tuongQuanSeries}
                            unit="percent"
                        />
                    ) : (
                        <SubChartSkeleton height={300} variant="line" legendCount={3} />
                    )}
                </Box>
            </Box>

            {/* Bottom: Cấu trúc sóng */}
            <Box sx={{ mt: 3 }}>
                <ChartSectionTitle
                    title={`Xu hướng nhóm ${indexName}`}
                    description="Biểu đồ xu hướng và cường độ sóng của nhóm qua các chu kỳ."
                    updateTime={updateTime}
                    sx={{ mb: 1 }}
                />
                {!isTrendLoading ? (
                    <MarketTrendChart
                        chartData={trendChartData}
                        isLoading={isTrendLoading}
                        timeRange={trendTimeRange}
                        onTimeRangeChange={setTrendTimeRange}
                        height={345}
                    />
                ) : (
                    <SubChartSkeleton height={345} variant="trend" legendCount={4} />
                )}
            </Box>
        </Box>
    );
}
