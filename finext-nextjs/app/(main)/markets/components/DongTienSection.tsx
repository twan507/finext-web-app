'use client';

import { useState, useMemo } from 'react';
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import TimeframeSelector from 'components/common/TimeframeSelector';
import type { RawMarketData } from '../../components/marketSection/MarketIndexChart';
import DongTienStackedBarChart from './DongTienSection/DongTienStackedBarChart';
import DongTienLineChart from './DongTienSection/DongTienLineChart';

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

    return (
        <Box sx={{ py: 3 }}>
            <Typography
                color="text.secondary"
                sx={{
                    fontSize: getResponsiveFontSize('md'),
                    fontWeight: fontWeight.semibold,
                    mb: 0,
                    textTransform: 'uppercase',
                }}
            >
                Tương quan biến động giá và dòng tiền
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <TimeframeSelector
                    value={timeRange}
                    onChange={handleTimeRangeChange}
                    options={['1W', '1M', '3M', '6M', '1Y']}
                    sx={{ my: 1, display: 'inline-flex', width: 'fit-content' }}
                />
            </Box>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? 2 : 3,
                }}
            >
                <Box sx={{ flex: 2, minWidth: 0 }}>
                    <DongTienStackedBarChart dates={barDates} series={barSeries} />
                </Box>
                <Box sx={{ flex: 3, minWidth: 0 }}>
                    <DongTienLineChart dates={lineDates} series={lineSeries} />
                </Box>
            </Box>
        </Box>
    );
}
