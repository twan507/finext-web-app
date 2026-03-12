'use client';

import { useState, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import TimeframeSelector from 'components/common/TimeframeSelector';
import type { RawMarketData } from '../../components/marketSection/MarketIndexChart';
import { apiClient } from 'services/apiClient';
import DongTienStackedBarChart from './DongTienSection/TuongQuanBarChart';
import DongTienLineChart from './DongTienSection/TuongQuanLineChart';
import DongTienTrongPhien from './DongTienSection/DongTienTrongPhien';
import ChiSoThanhKhoan from './DongTienSection/ChiSoThanhKhoan';
import DongTienTrongTuan from './DongTienSection/DongTienTrongTuan';
import PhanBoDongTien from './DongTienSection/PhanBoDongTien';

type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';

type IndexDataByTicker = Record<string, RawMarketData[]>;

interface DongTienSectionProps {
    histIndexData: IndexDataByTicker;
    todayAllData: IndexDataByTicker;
    itdAllData?: IndexDataByTicker;
}

/**
 * Merge hist + today data for a ticker, sort by date.
 */
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
 * Get number of trading sessions for a given time range.
 */
function getSessionCount(range: TimeRange): number {
    switch (range) {
        case '1W': return 5;
        case '1M': return 20;
        case '3M': return 60;
        case '6M': return 120;
        case '1Y': return 240;
        default: return 240;
    }
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
 * Build raw per-day values (non-cumulative) for stacked bar chart.
 */
function buildRawValues(data: RawMarketData[], fieldExtractor: (d: RawMarketData) => number): number[] {
    return data.map(d => {
        const raw = fieldExtractor(d);
        const val = Math.abs(raw) < 1 ? raw * 100 : raw;
        return parseFloat(val.toFixed(2));
    });
}

/**
 * Build a fixed 1D trading timeline: 09:00–11:30 + 13:00–15:00 (skip lunch break).
 * Returns array of UTC timestamps at minute resolution.
 */
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


export default function DongTienSection({ histIndexData, todayAllData, itdAllData = {} }: DongTienSectionProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
    const [timeRange, setTimeRange] = useState<TimeRange>('1D');

    const handleTimeRangeChange = (_event: React.MouseEvent<HTMLElement>, newRange: TimeRange | null) => {
        if (newRange !== null) setTimeRange(newRange);
    };

    // ========== DATA PROCESSING ==========
    // Merged data (shared base for both charts)
    const { vnMerged, fnxMerged } = useMemo(() => {
        const vnHist = histIndexData['VNINDEX'] || [];
        const vnToday = todayAllData['VNINDEX'] || [];
        const fnxHist = histIndexData['FNXINDEX'] || [];
        const fnxToday = todayAllData['FNXINDEX'] || [];

        return {
            vnMerged: mergeData(vnHist, vnToday),
            fnxMerged: mergeData(fnxHist, fnxToday),
        };
    }, [histIndexData, todayAllData]);

    // Stacked bar chart: always last 5 sessions (T-4 to T-0), independent of timeRange
    const { barDates, barSeries } = useMemo(() => {
        const BAR_SESSIONS = 5;
        const vnSlice = vnMerged.slice(-BAR_SESSIONS);
        const fnxSlice = fnxMerged.slice(-BAR_SESSIONS);

        const refData = vnSlice.length > 0 ? vnSlice : fnxSlice;
        const dateLabels = refData.map(d => {
            const date = new Date(d.date);
            const dd = date.getDate().toString().padStart(2, '0');
            const mm = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${dd}/${mm}`;
        });

        return {
            barDates: dateLabels,
            barSeries: [
                { name: 'VNINDEX', data: buildRawValues(vnSlice, d => d.pct_change || 0) },
                { name: 'FNXINDEX', data: buildRawValues(fnxSlice, d => d.pct_change || 0) },
                { name: 'Dòng tiền', data: buildRawValues(fnxSlice, d => ((d as any).t0_score || 0) / 1000) },
            ],
        };
    }, [vnMerged, fnxMerged]);

    // Line chart: filtered by selected timeRange
    const { lineDates, lineSeries, itdSeries, indexToTimestamp, xAxisMax } = useMemo(() => {
        // ========== 1D MODE: ITD data, numeric x-axis ==========
        if (timeRange === '1D') {
            const vnItd = itdAllData['VNINDEX'] || [];
            const fnxItd = itdAllData['FNXINDEX'] || [];

            // Sort and deduplicate by minute-normalized timestamp
            const processItd = (items: RawMarketData[]) => {
                const sorted = [...items]
                    .filter(item => item.date)
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                const seen = new Set<number>();
                return sorted
                    .map(item => ({
                        ts: Math.floor((new Date(item.date).getTime() + 7 * 60 * 60 * 1000) / (60 * 1000)) * (60 * 1000),
                        item,
                    }))
                    .filter(p => {
                        if (seen.has(p.ts)) return false;
                        seen.add(p.ts);
                        return true;
                    });
            };

            const vnProcessed = processItd(vnItd);
            const fnxProcessed = processItd(fnxItd);

            // Build fixed trading timeline (09:00-11:30 + 13:00-15:00)
            const allDataTs = [...vnProcessed.map(p => p.ts), ...fnxProcessed.map(p => p.ts)];
            const latestDataTs = allDataTs.length > 0 ? Math.max(...allDataTs) : undefined;
            const fixedTimeline = build1DTradingTimeline(latestDataTs);

            // Map timestamp → sequential index
            const timestampToIndex = new Map<number, number>();
            const idxToTs = new Map<number, number>();
            fixedTimeline.forEach((ts, index) => {
                timestampToIndex.set(ts, index);
                idxToTs.set(index, ts);
            });

            const maxIndex = idxToTs.size > 0 ? Math.max(...Array.from(idxToTs.keys())) : undefined;

            const toPercentValue = (val?: number): number => {
                const raw = val || 0;
                return Math.abs(raw) < 1 ? raw * 100 : raw;
            };

            // Build {x, y}[] series aligned to fixed timeline
            const buildItdXYSeries = (
                processed: { ts: number; item: RawMarketData }[],
                extractor: (item: RawMarketData) => number
            ): { x: number; y: number }[] => {
                return processed
                    .map(p => {
                        const index = timestampToIndex.get(p.ts);
                        if (index === undefined) return null;
                        return { x: index, y: parseFloat(extractor(p.item).toFixed(2)) };
                    })
                    .filter((p): p is { x: number; y: number } => p !== null)
                    .sort((a, b) => a.x - b.x);
            };

            return {
                lineDates: [] as string[],
                lineSeries: [] as { name: string; data: number[] }[],
                itdSeries: [
                    { name: 'VNINDEX', data: buildItdXYSeries(vnProcessed, d => toPercentValue(d.pct_change)) },
                    { name: 'FNXINDEX', data: buildItdXYSeries(fnxProcessed, d => toPercentValue(d.pct_change)) },
                    { name: 'Dòng tiền', data: buildItdXYSeries(fnxProcessed, d => toPercentValue(((d as any).t0_score || 0) / 1000)) },
                ],
                indexToTimestamp: idxToTs,
                xAxisMax: maxIndex,
            };
        }

        // ========== HISTORY MODE: cumsum ==========
        const sessions = getSessionCount(timeRange);
        const vnFiltered = vnMerged.slice(-sessions);
        const fnxFiltered = fnxMerged.slice(-sessions);

        const refData = vnFiltered.length > 0 ? vnFiltered : fnxFiltered;
        const dateLabels = refData.map(d => {
            const date = new Date(d.date);
            const dd = date.getDate().toString().padStart(2, '0');
            const mm = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${dd}/${mm}`;
        });

        return {
            lineDates: dateLabels,
            lineSeries: [
                { name: 'VNINDEX', data: buildCumsum(vnFiltered, d => d.pct_change || 0) },
                { name: 'FNXINDEX', data: buildCumsum(fnxFiltered, d => d.pct_change || 0) },
                { name: 'Dòng tiền', data: buildCumsum(fnxFiltered, d => ((d as any).t0_score || 0) / 1000) },
            ],
            itdSeries: undefined as undefined,
            indexToTimestamp: undefined as undefined,
            xAxisMax: undefined as undefined,
        };
    }, [vnMerged, fnxMerged, timeRange, itdAllData, isMobile]);

    // ========== NHÓM CỔ PHIẾU: chart 1 & 2 from todayAllData ==========
    const categoryTickers = useMemo(() => {
        const tickers: string[] = [];
        for (const [t, records] of Object.entries(todayAllData)) {
            if (records.length > 0 && (records[0] as any).type === 'category') {
                tickers.push(t);
            }
        }
        return tickers;
    }, [todayAllData]);

    const nhomCpCategories = useMemo(() =>
        categoryTickers.map(t => {
            const r = todayAllData[t];
            return (r && r.length > 0 && r[0].ticker_name) ? r[0].ticker_name : t;
        }),
        [categoryTickers, todayAllData]);

    const nhomCpBar1Series = useMemo(() => [{
        name: 'Dòng tiền trong phiên',
        data: categoryTickers.map(t => {
            const r = todayAllData[t] || [];
            const latest = r.length > 0 ? r[r.length - 1] : null;
            return parseFloat(((latest as any)?.t0_score ?? 0).toFixed(1));
        }),
    }], [categoryTickers, todayAllData]);

    const nhomCpBar2Series = useMemo(() => [{
        name: 'Chỉ số thanh khoản',
        data: categoryTickers.map(t => {
            const r = todayAllData[t] || [];
            const latest = r.length > 0 ? r[r.length - 1] : null;
            return parseFloat((((latest as any)?.vsi ?? 0) * 100).toFixed(1));
        }),
    }], [categoryTickers, todayAllData]);


    // ========== Chart 3: Dòng tiền trong tuần — t0_score last 5 sessions ==========
    const categoryHistQueries = useQueries({
        queries: categoryTickers.map(ticker => ({
            queryKey: ['markets', 'hist_index', ticker, 5],
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

    const nhomCpStackedData = useMemo(() => {
        const BAR_SESSIONS = 5;
        const dayLabels = ['T-4', 'T-3', 'T-2', 'T-1', 'T-0'];

        return dayLabels.map((dayLabel, dayIdx) => {
            const data = categoryTickers.map((ticker, tickerIdx) => {
                const hist = categoryHistQueries[tickerIdx]?.data || [];
                const today = todayAllData[ticker] || [];
                const merged = mergeData(hist, today);
                const slice = merged.slice(-BAR_SESSIONS);
                if (dayIdx < slice.length) {
                    return parseFloat(((slice[dayIdx] as any)?.t0_score ?? 0).toFixed(1));
                }
                return 0;
            });
            return { dayLabel, data };
        });
    }, [categoryTickers, categoryHistQueries, todayAllData]);

    // ========== Chart 4: Phân bổ dòng tiền — breadth_in, breadth_out, breadth_neu ==========
    const nhomCpFlowData = useMemo(() =>
        categoryTickers.map(t => {
            const r = todayAllData[t] || [];
            const latest = r.length > 0 ? r[r.length - 1] : null;
            return {
                flowIn: (latest as any)?.breadth_in ?? 0,
                flowOut: (latest as any)?.breadth_out ?? 0,
                flowNeutral: (latest as any)?.breadth_neu ?? 0,
            };
        }),
        [categoryTickers, todayAllData],
    );

    // ========== NHÓM VỐN HOÁ: chart 1 & 2 from todayAllData ==========
    const mcTickers = useMemo(() => {
        const tickers: string[] = [];
        for (const [t, records] of Object.entries(todayAllData)) {
            if (records.length > 0 && (records[0] as any).type === 'marketcap') {
                tickers.push(t);
            }
        }
        return tickers;
    }, [todayAllData]);

    const mcCategories = useMemo(() =>
        mcTickers.map(t => {
            const r = todayAllData[t];
            return (r && r.length > 0 && r[0].ticker_name) ? r[0].ticker_name : t;
        }),
        [mcTickers, todayAllData]);

    const mcBar1Series = useMemo(() => [{
        name: 'Dòng tiền trong phiên',
        data: mcTickers.map(t => {
            const r = todayAllData[t] || [];
            const latest = r.length > 0 ? r[r.length - 1] : null;
            return parseFloat(((latest as any)?.t0_score ?? 0).toFixed(1));
        }),
    }], [mcTickers, todayAllData]);

    const mcBar2Series = useMemo(() => [{
        name: 'Chỉ số thanh khoản',
        data: mcTickers.map(t => {
            const r = todayAllData[t] || [];
            const latest = r.length > 0 ? r[r.length - 1] : null;
            return parseFloat((((latest as any)?.vsi ?? 0) * 100).toFixed(1));
        }),
    }], [mcTickers, todayAllData]);

    // ========== MC Chart 3: Dòng tiền trong tuần — t0_score last 5 sessions ==========
    const mcHistQueries = useQueries({
        queries: mcTickers.map(ticker => ({
            queryKey: ['markets', 'hist_index_mc', ticker, 5],
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

    const mcStackedData = useMemo(() => {
        const BAR_SESSIONS = 5;
        const dayLabels = ['T-4', 'T-3', 'T-2', 'T-1', 'T-0'];

        return dayLabels.map((dayLabel, dayIdx) => {
            const data = mcTickers.map((ticker, tickerIdx) => {
                const hist = mcHistQueries[tickerIdx]?.data || [];
                const today = todayAllData[ticker] || [];
                const merged = mergeData(hist, today);
                const slice = merged.slice(-BAR_SESSIONS);
                if (dayIdx < slice.length) {
                    return parseFloat(((slice[dayIdx] as any)?.t0_score ?? 0).toFixed(1));
                }
                return 0;
            });
            return { dayLabel, data };
        });
    }, [mcTickers, mcHistQueries, todayAllData]);

    // ========== MC Chart 4: Phân bổ dòng tiền — breadth_in, breadth_out, breadth_neu ==========
    const mcFlowData = useMemo(() =>
        mcTickers.map(t => {
            const r = todayAllData[t] || [];
            const latest = r.length > 0 ? r[r.length - 1] : null;
            return {
                flowIn: (latest as any)?.breadth_in ?? 0,
                flowOut: (latest as any)?.breadth_out ?? 0,
                flowNeutral: (latest as any)?.breadth_neu ?? 0,
            };
        }),
        [mcTickers, todayAllData],
    );

    return (
        <Box sx={{ py: 3 }}>
            <Typography
                color="text.secondary"
                sx={{
                    fontSize: getResponsiveFontSize('lg'),
                    fontWeight: fontWeight.semibold,
                    mb: 0,
                    textTransform: 'uppercase',
                }}
            >
                Tương quan biến động giá và dòng tiền
            </Typography>
            {!isMobile && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <TimeframeSelector
                        value={timeRange}
                        onChange={handleTimeRangeChange}
                        options={['1D', '1W', '1M', '3M', '6M', '1Y']}
                        sx={{ my: 1, display: 'inline-flex', width: 'fit-content' }}
                    />
                </Box>
            )}
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? 2 : 5,
                }}
            >
                <Box sx={{ flex: 2, minWidth: 0, ...(isMobile && { mt: 2 }) }}>
                    <DongTienStackedBarChart dates={barDates} series={barSeries} />
                </Box>
                {isMobile && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <TimeframeSelector
                            value={timeRange}
                            onChange={handleTimeRangeChange}
                            options={['1D', '1W', '1M', '3M', '6M', '1Y']}
                            sx={{ display: 'inline-flex', width: 'fit-content' }}
                        />
                    </Box>
                )}
                <Box sx={{ flex: 3, minWidth: 0 }}>
                    {timeRange === '1D' ? (
                        <DongTienLineChart
                            mode="itd"
                            itdSeries={itdSeries!}
                            indexToTimestamp={indexToTimestamp!}
                            xAxisMax={xAxisMax}
                        />
                    ) : (
                        <DongTienLineChart dates={lineDates} series={lineSeries} />
                    )}
                </Box>
            </Box>

            {/* ========== DÒNG TIỀN NHÓM CỔ PHIẾU ========== */}
            <Typography
                color="text.secondary"
                sx={{
                    fontSize: getResponsiveFontSize('lg'),
                    fontWeight: fontWeight.semibold,
                    mt: 4,
                    mb: 3,
                    textTransform: 'uppercase',
                }}
            >
                Nhóm dòng tiền
            </Typography>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',                    // Mobile (< 768px): 1 cột
                        md: '1fr 1fr',                // Tablet (768px – 1199px): 2×2
                        lg: '3fr 2fr 2fr 3fr',       // Desktop (≥ 1200px): 4 cột
                    },
                    gap: 2,
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <DongTienTrongPhien
                        title="Dòng tiền trong phiên"
                        categories={nhomCpCategories}
                        series={nhomCpBar1Series}
                        unit="number"
                    />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <ChiSoThanhKhoan
                        title="Chỉ số thanh khoản"
                        categories={nhomCpCategories}
                        series={nhomCpBar2Series}
                        unit="percent"
                    />
                </Box>
                <Box sx={{ minWidth: 0, ...(!isTablet && { ml: -2 }) }}>
                    <PhanBoDongTien
                        title="Phân bổ dòng tiền"
                        categories={nhomCpCategories}
                        flowData={nhomCpFlowData}
                    />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <DongTienTrongTuan
                        title="Dòng tiền trong tuần"
                        categories={nhomCpCategories}
                        daySeriesData={nhomCpStackedData}
                        unit="number"
                    />
                </Box>
            </Box>

            {/* ========== DÒNG TIỀN NHÓM VỐN HOÁ ========== */}
            <Typography
                color="text.secondary"
                sx={{
                    fontSize: getResponsiveFontSize('lg'),
                    fontWeight: fontWeight.semibold,
                    mt: 4,
                    mb: 3,
                    textTransform: 'uppercase',
                }}
            >
                Nhóm vốn hoá
            </Typography>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',                    // Mobile (<768px): 1 cột
                        md: '1fr 1fr',                // Tablet (768px – 1199px): 2×2
                        lg: '3fr 2fr 2fr 3fr',       // Desktop (≥ 1200px): 4 cột
                    },
                    gap: 2,
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <DongTienTrongPhien
                        title="Dòng tiền trong phiên"
                        categories={mcCategories}
                        series={mcBar1Series}
                        unit="number"
                    />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <ChiSoThanhKhoan
                        title="Chỉ số thanh khoản"
                        categories={mcCategories}
                        series={mcBar2Series}
                        unit="percent"
                    />
                </Box>
                <Box sx={{ minWidth: 0, ...(!isTablet && { ml: -2 }) }}>
                    <PhanBoDongTien
                        title="Phân bổ dòng tiền"
                        categories={mcCategories}
                        flowData={mcFlowData}
                    />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <DongTienTrongTuan
                        title="Dòng tiền trong tuần"
                        categories={mcCategories}
                        daySeriesData={mcStackedData}
                        unit="number"
                    />
                </Box>
            </Box>
        </Box>
    );
}
