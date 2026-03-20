'use client';

import { Box, Typography, useTheme, alpha, Skeleton } from '@mui/material';
import { getResponsiveFontSize, fontWeight, borderRadius, durations, easings, transitions, getGlassCard } from 'theme/tokens';
import type { RawMarketData } from '../../../../components/marketSection/MarketIndexChart';

interface DongTienSectionProps {
    ticker: string;
    indexName: string;
    todayAllData: Record<string, RawMarketData[]>;
    histLineTicker: RawMarketData[];
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

// Dummy chart component
function DummyChart({ title, height = 300 }: { title: string; height?: number }) {
    const theme = useTheme();

    return (
        <Box sx={{
            ...getGlassCard(theme.palette.mode === 'dark'),
            p: 2,
            borderRadius: `${borderRadius.lg}px`,
            minHeight: height,
        }}>
            <Typography sx={{
                fontSize: getResponsiveFontSize('md'),
                fontWeight: fontWeight.semibold,
                mb: 2,
            }}>
                {title}
            </Typography>
            <Box sx={{
                height: height - 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                borderRadius: `${borderRadius.md}px`,
            }}>
                <Typography color="text.secondary">
                    [Chart: {title}]
                </Typography>
            </Box>
        </Box>
    );
}

export default function DongTienSection({
    ticker,
    indexName,
    todayAllData,
    histLineTicker,
}: DongTienSectionProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    // Calculate data
    const todayForTicker = todayAllData[ticker] || [];
    const todayArr: RawMarketData[] = todayForTicker.length > 0 ? [todayForTicker[todayForTicker.length - 1]] : [];
    const merged = mergeData(histLineTicker, todayArr);

    const dateLabels = merged.map(d => {
        const date = new Date(d.date);
        const dd = date.getDate().toString().padStart(2, '0');
        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${dd}-${mm}`;
    });

    const t5ScoreData = merged.map(d => parseFloat(((d as any)?.t5_score ?? 0).toFixed(2)));
    const t0ScoreData = merged.map(d => parseFloat(((d as any)?.t0_score ?? 0).toFixed(2)));

    const tuongQuanSeries = [
        { name: `% Dòng tiền`, data: buildCumsum(merged, d => ((d as any)?.t0_score ?? 0) / 1000) },
        { name: `% Giá`, data: buildCumsum(merged, d => d.pct_change || 0) },
    ];

    const hasData = merged.length > 0;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Sức mạnh dòng tiền */}
            <Box>
                <Typography color="text.secondary" sx={{
                    fontSize: getResponsiveFontSize('lg'),
                    fontWeight: fontWeight.semibold,
                    textTransform: 'uppercase',
                    mb: 1,
                }}>
                    Sức mạnh dòng tiền
                </Typography>
                {hasData ? (
                    <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        <Box sx={{ flex: 1, minWidth: 300 }}>
                            <DummyChart title="T5 Score" height={280} />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 300 }}>
                            <DummyChart title="T0 Score" height={280} />
                        </Box>
                    </Box>
                ) : (
                    <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 2 }} />
                )}
            </Box>

            {/* Tương quan */}
            <Box>
                <Typography color="text.secondary" sx={{
                    fontSize: getResponsiveFontSize('lg'),
                    fontWeight: fontWeight.semibold,
                    textTransform: 'uppercase',
                    mb: 1,
                }}>
                    Tương quan
                </Typography>
                {hasData ? (
                    <DummyChart title="Tương quan với VNINDEX" height={300} />
                ) : (
                    <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
                )}
            </Box>

            {/* Cấu trúc sóng */}
            <Box>
                <Typography color="text.secondary" sx={{
                    fontSize: getResponsiveFontSize('lg'),
                    fontWeight: fontWeight.semibold,
                    textTransform: 'uppercase',
                    mb: 1,
                }}>
                    Cấu trúc sóng
                </Typography>
                <DummyChart title="Cấu trúc sóng" height={300} />
            </Box>
        </Box>
    );
}
