'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Box, Typography, Skeleton, useTheme, useMediaQuery } from '@mui/material';
import { RawMarketData } from 'app/(main)/components/marketSection/MarketIndexChart';
import MarketTrendChart, { RawTrendData, transformTrendData, TrendChartData, TrendTimeRange } from 'app/(main)/markets/components/TinHieuSecion/MarketTrendChart';
import TuongQuanDongTien from 'app/(main)/groups/components/TuongQuanDongTien';


const SucManhDongTien = dynamic(
    () => import('../SucManhDongTien'),
    { ssr: false }
);



interface DongTienSectionProps {
    ticker: string;
    indexName: string;
    todayAllData: Record<string, RawMarketData[]>;
    histLineTicker: RawMarketData[];
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

function SectionTitle({ children }: { children: React.ReactNode }) {
    const { getResponsiveFontSize, fontWeight } = require('theme/tokens');
    return (
        <Typography
            color="text.secondary"
            sx={{
                fontSize: getResponsiveFontSize('lg'),
                fontWeight: fontWeight.semibold,
                textTransform: 'uppercase',
                mb: 1,
            }}
        >
            {children}
        </Typography>
    );
}

export default function DongTienSection({
    ticker,
    indexName,
    todayAllData,
    histLineTicker,
    histLineVNINDEX,
    historyTrendData,
    trendTodayData,
    historyTrendLoading,
}: DongTienSectionProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [trendTimeRange, setTrendTimeRange] = useState<TrendTimeRange>(isMobile ? '1M' : '3M');

    useEffect(() => {
        setTrendTimeRange(isMobile ? '1M' : '3M');
    }, [isMobile]);

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
            <SectionTitle>Diễn biến dòng tiền</SectionTitle>
            <Box sx={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: isMobile ? 2 : 5,
                mt: 2
            }}>
                {/* Left: Sức mạnh dòng tiền */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <SucManhDongTien
                        title=""
                        chartHeight="300px"
                        dates={dongTienDates}
                        t5ScoreData={t5ScoreData}
                        t0ScoreData={t0ScoreData}
                    />
                </Box>

                {/* Right: Tương quan */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <TuongQuanDongTien
                        chartHeight="300px"
                        dates={tuongQuanDates}
                        series={tuongQuanSeries}
                        unit="percent"
                    />
                </Box>
            </Box>

            {/* Bottom: Cấu trúc sóng */}
            <Box sx={{ mt: 3 }}>
                <SectionTitle>Cấu trúc xu hướng</SectionTitle>
                <MarketTrendChart
                    chartData={trendChartData}
                    isLoading={isTrendLoading}
                    timeRange={trendTimeRange}
                    onTimeRangeChange={setTrendTimeRange}
                    height={345}
                />
            </Box>
        </Box>
    );
}
