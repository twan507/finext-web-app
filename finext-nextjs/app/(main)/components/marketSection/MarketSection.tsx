'use client';

import { useRouter } from 'next/navigation';

import { Dispatch, SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import { Box, Typography, Skeleton, useTheme, useMediaQuery } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import type { RawMarketData, ChartData, TimeRange } from './MarketIndexChart';
import IndexTable from './IndexTable';
import IndexDetailPanel from './IndexDetailPanel';

import {
    getResponsiveFontSize,
    fontWeight,
    transitions,
} from 'theme/tokens';

// Lazy load heavy chart component
const MarketIndexChart = dynamic(
    () => import('./MarketIndexChart').then(mod => ({ default: mod.default })),
    {
        loading: () => <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />,
        ssr: false
    }
);

// ========== INDEX LISTS ==========
const MAIN_INDEXES = ['VNINDEX', 'VN30', 'HNXINDEX', 'UPINDEX'];
const DERIVATIVE_INDEXES = ['VN30F1M', 'VN30F2M', 'VN100F1M', 'VN100F2M'];
const FINEXT_INDEXES = ['FNXINDEX', 'LARGECAP', 'MIDCAP', 'SMALLCAP'];
const MOBILE_INDEXES = ['VNINDEX', 'HNXINDEX', 'UPINDEX', 'FNXINDEX', 'LARGECAP', 'MIDCAP', 'SMALLCAP', 'VN30', 'VN30F1M'];


// Type cho SSE data
type IndexDataByTicker = Record<string, RawMarketData[]>;

// Tab type cho bảng index
type IndexTabType = 'main' | 'derivative' | 'finext';

// ========== PROPS INTERFACE ==========
interface MarketSectionProps {
    ticker: string;
    indexName: string;
    eodData: ChartData;
    intradayData: ChartData;
    isLoading: boolean;
    error: string | null;
    timeRange: TimeRange;
    onTimeRangeChange: Dispatch<SetStateAction<TimeRange>>;
    indexTab: IndexTabType;
    onIndexTabChange: Dispatch<SetStateAction<IndexTabType>>;
    onTickerChange: (newTicker: string) => void;
    todayAllData: IndexDataByTicker;
}

// ========== INDEX TABLES SECTION (Single merged table on mobile, Row on desktop) ==========
function IndexTablesSection({ ticker, onTickerChange, todayAllData }: {
    ticker: string;
    onTickerChange: (t: string) => void;
    todayAllData: IndexDataByTicker;
}) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const titleSx = {
        fontSize: getResponsiveFontSize('md'),
        fontWeight: fontWeight.semibold,
        color: theme.palette.text.primary,
        ml: 1,
        mb: 1.5,
        pb: 1,
        borderBottom: `2px solid ${theme.palette.primary.main}`,
        display: 'inline-block',
    };

    const tables = [
        { id: 'coso', title: 'Cơ sở', list: MAIN_INDEXES },
        { id: 'phaisinh', title: 'Phái sinh', list: DERIVATIVE_INDEXES },
        { id: 'finext', title: 'Finext', list: FINEXT_INDEXES },
    ];

    // Mobile: gộp tất cả chỉ số thành 1 bảng duy nhất, bỏ tiêu đề
    if (isMobile) {
        return (
            <Box sx={{ mt: 3 }}>
                <IndexTable
                    selectedTicker={ticker}
                    onTickerChange={onTickerChange}
                    indexList={MOBILE_INDEXES}
                    todayAllData={todayAllData}
                />
            </Box>
        );
    }

    // Desktop: 3 cột riêng biệt với tiêu đề
    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 3,
            mt: 3,
            overflowX: 'auto',
            '&::-webkit-scrollbar': { display: 'none' },
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
        }}>
            {tables.map((t) => (
                <Box key={t.id} sx={{ width: 330, flexShrink: 0 }}>
                    <Typography sx={titleSx}>{t.title}</Typography>
                    <IndexTable
                        selectedTicker={ticker}
                        onTickerChange={onTickerChange}
                        indexList={t.list}
                        todayAllData={todayAllData}
                    />
                </Box>
            ))}
        </Box>
    );
}

// ========== MAIN COMPONENT ==========
export default function MarketSection({
    ticker,
    indexName,
    eodData,
    intradayData,
    isLoading,
    error,
    timeRange,
    onTimeRangeChange,
    indexTab,
    onIndexTabChange,
    onTickerChange,
    todayAllData,
}: MarketSectionProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const router = useRouter();

    return (

        <Box>
            {/* Title - Thị trường (clickable) */}
            <Box
                onClick={() => router.push('/markets')}
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    mb: 2,
                }}
            >
                <Typography variant="h1" sx={{ fontSize: getResponsiveFontSize('h1') }}>
                    Thị trường
                </Typography>
                <ChevronRightIcon sx={{ fontSize: getResponsiveFontSize('h2'), mt: 1, color: theme.palette.text.secondary }} />
            </Box>

            {/* ========== TOP SECTION: Chart + Detail Panel ========== */}
            <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: { xs: 2, md: 3 },
            }}>
                {/* Left: Chart */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <MarketIndexChart
                        key={ticker}
                        symbol={ticker}
                        title={`Chỉ số ${indexName}`}
                        eodData={eodData}
                        intradayData={intradayData}
                        isLoading={isLoading}
                        error={error}
                        timeRange={timeRange}
                        onTimeRangeChange={onTimeRangeChange}
                    />
                </Box>

                {/* Right: Index Detail Panel */}
                <Box sx={{
                    width: { xs: '100%', md: 340 },
                    flexShrink: 0,
                }}>
                    <IndexDetailPanel indexName={indexName} todayData={todayAllData[ticker] || []} />
                </Box>
            </Box>

            {/* ========== BOTTOM SECTION: 3 Index Tables ========== */}
            <IndexTablesSection
                ticker={ticker}
                onTickerChange={onTickerChange}
                todayAllData={todayAllData}
            />
        </Box>
    );
}
