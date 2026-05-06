'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Box, Typography, useTheme, useMediaQuery, Skeleton } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import dynamic from 'next/dynamic';
import { ISseRequest } from 'services/core/types';
import { sseClient } from 'services/sseClient';
import VsiITDStockLineChart from '../../../groups/[groupId]/components/VsiScoreItdLineChart';
import RankingLineChart from './RankingLineChart';
import SubChartSkeleton from 'components/common/SubChartSkeleton';
import ChartSectionTitle from 'components/common/ChartSectionTitle';
import { useMarketUpdateTime } from 'hooks/useMarketUpdateTime';

const SucManhDongTien = dynamic(
    () => import('../../../groups/[groupId]/components/SucManhDongTien'),
    { ssr: false, loading: () => <SubChartSkeleton height={280} variant="mixed" legendCount={2} /> }
);
const TuongQuanDongTien = dynamic(
    () => import('../../../groups/components/TuongQuanDongTien'),
    { ssr: false, loading: () => <SubChartSkeleton height={280} variant="line" legendCount={3} /> }
);

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
    t0_score?: number;
}

interface DongTienSectionProps {
    ticker: string;
    historyLoading: boolean;
    // Pre-computed chart data from parent
    dongTienDates: string[];
    t5ScoreData: number[];
    t0ScoreData: number[];
    tuongQuanDates: string[];
    tuongQuanSeries: { name: string; data: number[] }[];
    // Ranking data
    rankingDates: string[];
    marketRankData: number[];
    industryRankData: number[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

    pushMinuteRange(9, 0, 11, 30);
    pushMinuteRange(13, 0, 15, 0);

    return timeline;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DongTienSection({
    ticker,
    historyLoading,
    dongTienDates,
    t5ScoreData,
    t0ScoreData,
    tuongQuanDates,
    tuongQuanSeries,
    rankingDates,
    marketRankData,
    industryRankData,
}: DongTienSectionProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const hasData = !historyLoading && dongTienDates.length > 0;

    const updateTime = useMarketUpdateTime();

    const isMountedRef = useRef<boolean>(true);
    const itdStockSseRef = useRef<{ unsubscribe: () => void } | null>(null);

    // SSE state: home_itd_stock
    const [itdStockData, setItdStockData] = useState<ItdRecord[]>([]);

    // ========== SSE - ITD Stock Data ==========
    useEffect(() => {
        isMountedRef.current = true;

        if (itdStockSseRef.current) {
            itdStockSseRef.current.unsubscribe();
            itdStockSseRef.current = null;
        }

        const requestProps: ISseRequest = {
            url: '/api/v1/sse/stream',
            queryParams: { keyword: 'home_itd_stock', ticker },
        };

        itdStockSseRef.current = sseClient<ItdRecord[]>(
            requestProps,
            {
                onOpen: () => { },
                onData: (receivedData) => {
                    if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
                        const filtered = receivedData.filter((r) => r.ticker === ticker);
                        setItdStockData(filtered);
                    }
                },
                onError: (err) => {
                    if (isMountedRef.current) console.warn('[SSE DongTien ITD Stock] Error:', err.message);
                },
                onClose: () => { },
            },
        );

        return () => {
            isMountedRef.current = false;
            if (itdStockSseRef.current) itdStockSseRef.current.unsubscribe();
        };
    }, [ticker]);

    // ========== VSI + t0_score Chart Data Processing ==========
    const { vsiSeriesData, t0ScoreSeriesData, vsiIndexToTimestamp, vsiXAxisMax } = useMemo(() => {
        const sortedData = [...itdStockData]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (sortedData.length === 0) {
            return {
                vsiSeriesData: [] as { x: number; y: number }[],
                t0ScoreSeriesData: [] as { x: number; y: number }[],
                vsiIndexToTimestamp: new Map<number, number>(),
                vsiXAxisMax: undefined as number | undefined,
            };
        }

        const seenTimestamps = new Set<number>();
        const vsiPoints = sortedData
            .map((r) => ({
                ts: Math.floor((new Date(r.date).getTime() + 7 * 60 * 60 * 1000) / (60 * 1000)) * (60 * 1000),
                vsi: parseFloat(((r.vsi ?? 0) * 100).toFixed(1)),
                t0: parseFloat((r.t0_score ?? 0).toFixed(2)),
            }))
            .filter((p) => {
                if (seenTimestamps.has(p.ts)) return false;
                seenTimestamps.add(p.ts);
                return true;
            });

        const latestDataTs = vsiPoints.length > 0 ? vsiPoints[vsiPoints.length - 1].ts : undefined;
        const fixedTimeline = build1DTradingTimeline(latestDataTs);

        const timestampToIndex = new Map<number, number>();
        const idxToTs = new Map<number, number>();
        fixedTimeline.forEach((ts, index) => {
            timestampToIndex.set(ts, index);
            idxToTs.set(index, ts);
        });

        const maxIndex = idxToTs.size > 0 ? Math.max(...Array.from(idxToTs.keys())) : undefined;

        const seriesData = vsiPoints
            .map((p) => {
                const index = timestampToIndex.get(p.ts);
                if (index === undefined) return null;
                return { x: index, y: p.vsi };
            })
            .filter((p): p is { x: number; y: number } => p !== null);

        const t0SeriesData = vsiPoints
            .map((p) => {
                const index = timestampToIndex.get(p.ts);
                if (index === undefined) return null;
                return { x: index, y: p.t0 };
            })
            .filter((p): p is { x: number; y: number } => p !== null);

        return {
            vsiSeriesData: seriesData,
            t0ScoreSeriesData: t0SeriesData,
            vsiIndexToTimestamp: idxToTs,
            vsiXAxisMax: maxIndex,
        };
    }, [itdStockData]);

    return (
        <Box>
            <ChartSectionTitle
                title={`Dòng tiền Cổ phiếu ${ticker} trong phiên`}
                description="Theo dõi biến động dòng tiền mua/bán chủ động và chỉ số thanh khoản VSI trong ngày của cổ phiếu."
                updateTime={updateTime}
                sx={{ mb: 1 }}
            />

            {/* Chỉ số thanh khoản ITD */}
            <Box sx={{ mt: 2, mb: isMobile ? 2 : 3 }}>
                {vsiSeriesData.length > 0 ? (
                    <VsiITDStockLineChart
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
                title={`Dòng tiền Cổ phiếu ${ticker} trong tháng`}
                description="Thống kê lịch sử sức mạnh dòng tiền của cổ phiếu và độ tương quan so với thị trường chung."
                updateTime={updateTime}
                sx={{ mb: 2 }}
            />

            {/* Sức mạnh dòng tiền + Tương quan */}
            {hasData ? (
                <Box sx={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? 2 : 5,
                }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <SucManhDongTien
                            chartHeight="280px"
                            dates={dongTienDates}
                            t5ScoreData={t5ScoreData}
                            t0ScoreData={t0ScoreData}
                        />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <TuongQuanDongTien
                            chartHeight="280px"
                            dates={tuongQuanDates}
                            series={tuongQuanSeries}
                            unit="percent"
                        />
                    </Box>
                </Box>
            ) : (
                <Box sx={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? 2 : 5,
                }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <SubChartSkeleton height={280} variant="mixed" legendCount={2} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <SubChartSkeleton height={280} variant="line" legendCount={3} />
                    </Box>
                </Box>
            )}
            <ChartSectionTitle
                title={`Diễn biến xếp hạng cổ phiếu ${ticker}`}
                description="Theo dõi xếp hạng sức mạnh dòng tiền của cổ phiếu so với toàn thị trường và trong cùng ngành."
                updateTime={updateTime}
                sx={{ mb: 1 }}
            />
            {!historyLoading && rankingDates.length > 0 ? (
                <RankingLineChart
                    dates={rankingDates}
                    marketRankData={marketRankData}
                    industryRankData={industryRankData}
                    chartHeight="280px"
                />
            ) : (
                <SubChartSkeleton height={280} variant="line" legendCount={2} />
            )}
        </Box>
    );
}
