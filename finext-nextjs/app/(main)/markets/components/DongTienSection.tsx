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
import DienBienDongTien from './DongTienSection/DienBienDongTien';

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y';

type IndexDataByTicker = Record<string, RawMarketData[]>;

interface DongTienSectionProps {
    histIndexData: IndexDataByTicker;
    todayAllData: IndexDataByTicker;
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



export default function DongTienSection({ histIndexData, todayAllData }: DongTienSectionProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
    const [timeRange, setTimeRange] = useState<TimeRange>('1M');

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
    const { lineDates, lineSeries } = useMemo(() => {
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
        };
    }, [vnMerged, fnxMerged, timeRange]);

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

    // ========== Chart 4: Diễn biến dòng tiền — t5_score last 20 sessions ==========
    const categoryHistQueries20 = useQueries({
        queries: categoryTickers.map(ticker => ({
            queryKey: ['markets', 'hist_index', ticker, 20],
            queryFn: async () => {
                const response = await apiClient<RawMarketData[]>({
                    url: '/api/v1/sse/rest/home_hist_index',
                    method: 'GET',
                    queryParams: { ticker, limit: 20 },
                    requireAuth: false,
                });
                return response.data || [];
            },
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
        })),
    });

    const { nhomCpLineDates, nhomCpLineSeries } = useMemo(() => {
        const LINE_SESSIONS = 20;

        // Find the ticker with the most data to use as reference for dates
        let refMerged: RawMarketData[] = [];
        categoryTickers.forEach((ticker, idx) => {
            const hist = categoryHistQueries20[idx]?.data || [];
            const today = todayAllData[ticker] || [];
            const merged = mergeData(hist, today).slice(-LINE_SESSIONS);
            if (merged.length > refMerged.length) refMerged = merged;
        });

        const dateLabels = refMerged.map(d => {
            const date = new Date(d.date);
            const dd = date.getDate().toString().padStart(2, '0');
            const mm = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${dd}/${mm}`;
        });

        const series = categoryTickers.map((ticker, idx) => {
            const hist = categoryHistQueries20[idx]?.data || [];
            const today = todayAllData[ticker] || [];
            const merged = mergeData(hist, today).slice(-LINE_SESSIONS);
            const name = (merged.length > 0 && merged[0].ticker_name) ? merged[0].ticker_name : ticker;
            const data = merged.map(d => parseFloat(((d as any).t5_score ?? 0).toFixed(2)));
            return { name, data };
        });

        return { nhomCpLineDates: dateLabels, nhomCpLineSeries: series };
    }, [categoryTickers, categoryHistQueries20, todayAllData]);

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

    // ========== MC Chart 4: Diễn biến dòng tiền — t5_score last 20 sessions ==========
    const mcHistQueries20 = useQueries({
        queries: mcTickers.map(ticker => ({
            queryKey: ['markets', 'hist_index_mc', ticker, 20],
            queryFn: async () => {
                const response = await apiClient<RawMarketData[]>({
                    url: '/api/v1/sse/rest/home_hist_index',
                    method: 'GET',
                    queryParams: { ticker, limit: 20 },
                    requireAuth: false,
                });
                return response.data || [];
            },
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
        })),
    });

    const { mcLineDates, mcLineSeries } = useMemo(() => {
        const LINE_SESSIONS = 20;

        let refMerged: RawMarketData[] = [];
        mcTickers.forEach((ticker, idx) => {
            const hist = mcHistQueries20[idx]?.data || [];
            const today = todayAllData[ticker] || [];
            const merged = mergeData(hist, today).slice(-LINE_SESSIONS);
            if (merged.length > refMerged.length) refMerged = merged;
        });

        const dateLabels = refMerged.map(d => {
            const date = new Date(d.date);
            const dd = date.getDate().toString().padStart(2, '0');
            const mm = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${dd}/${mm}`;
        });

        const series = mcTickers.map((ticker, idx) => {
            const hist = mcHistQueries20[idx]?.data || [];
            const today = todayAllData[ticker] || [];
            const merged = mergeData(hist, today).slice(-LINE_SESSIONS);
            const name = (merged.length > 0 && merged[0].ticker_name) ? merged[0].ticker_name : ticker;
            const data = merged.map(d => parseFloat(((d as any).t5_score ?? 0).toFixed(2)));
            return { name, data };
        });

        return { mcLineDates: dateLabels, mcLineSeries: series };
    }, [mcTickers, mcHistQueries20, todayAllData]);

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
                        options={['1W', '1M', '3M', '6M', '1Y']}
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
                            options={['1W', '1M', '3M', '6M', '1Y']}
                            sx={{ display: 'inline-flex', width: 'fit-content' }}
                        />
                    </Box>
                )}
                <Box sx={{ flex: 3, minWidth: 0 }}>
                    <DongTienLineChart dates={lineDates} series={lineSeries} />
                </Box>
            </Box>

            {/* ========== DÒNG TIỀN NHÓM CỔ PHIẾU ========== */}
            <Typography
                color="text.secondary"
                sx={{
                    fontSize: getResponsiveFontSize('lg'),
                    fontWeight: fontWeight.semibold,
                    mt: 4,
                    mb: 1,
                    textTransform: 'uppercase',
                }}
            >
                Dòng tiền nhóm cổ phiếu
            </Typography>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',                    // Mobile (< 768px): 1 cột
                        md: '1fr 1fr',                // Tablet (768px – 1199px): 2×2
                        lg: '25% 15% 25% 35%',       // Desktop (≥ 1200px): 4 cột
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
                <Box sx={{ minWidth: 0, ...(!isTablet && { mr: 2 }) }}>
                    <ChiSoThanhKhoan
                        title="Chỉ số thanh khoản"
                        categories={nhomCpCategories}
                        series={nhomCpBar2Series}
                        unit="percent"
                    />
                </Box>
                <Box sx={{ minWidth: 0, ...(!isTablet && { mr: 2 }) }}>
                    <DongTienTrongTuan
                        title="Dòng tiền trong tuần"
                        categories={nhomCpCategories}
                        daySeriesData={nhomCpStackedData}
                        unit="number"
                    />
                </Box>
                <Box sx={{ minWidth: 0, ...(!isTablet && { mr: 6 }) }}>
                    <DienBienDongTien
                        title="Diễn biến dòng tiền"
                        dates={nhomCpLineDates}
                        series={nhomCpLineSeries}
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
                    mb: 1,
                    textTransform: 'uppercase',
                }}
            >
                Dòng tiền nhóm vốn hoá
            </Typography>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',                    // Mobile (<768px): 1 cột
                        md: '1fr 1fr',                // Tablet (768px – 1199px): 2×2
                        lg: '25% 15% 25% 35%',       // Desktop (≥ 1200px): 4 cột
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
                <Box sx={{ minWidth: 0, ...(!isTablet && { mr: 2 }) }}>
                    <ChiSoThanhKhoan
                        title="Chỉ số thanh khoản"
                        categories={mcCategories}
                        series={mcBar2Series}
                        unit="percent"
                    />
                </Box>
                <Box sx={{ minWidth: 0, ...(!isTablet && { mr: 2 }) }}>
                    <DongTienTrongTuan
                        title="Dòng tiền trong tuần"
                        categories={mcCategories}
                        daySeriesData={mcStackedData}
                        unit="number"
                    />
                </Box>
                <Box sx={{ minWidth: 0, ...(!isTablet && { mr: 6 }) }}>
                    <DienBienDongTien
                        title="Diễn biến dòng tiền"
                        dates={mcLineDates}
                        series={mcLineSeries}
                        unit="number"
                    />
                </Box>
            </Box>
        </Box>
    );
}
