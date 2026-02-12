'use client';

import { Box, Typography, FormControl, Select, MenuItem, SelectChangeEvent, useTheme } from '@mui/material';
import { useRouter } from 'next/navigation';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MarketIndexChart, { ChartData, TimeRange } from './MarketIndexChart';
import IndexTable from './IndexTable';
import { getResponsiveFontSize, getGlassCard } from 'theme/tokens';
import { RawMarketData } from './MarketIndexChart';

// Tab type cho bảng index
type IndexTabType = 'main' | 'derivative' | 'finext';

// List 1: Main Indexes
const MAIN_INDEXES = [
    'VNINDEX',
    'VN30',
    'VNXALL',
    'HNXINDEX',
    'HNX30',
    'UPINDEX',
];

// List 2: Derivatives (Phái sinh)
const DERIVATIVE_INDEXES = [
    'VN30F1M',
    'VN30F2M',
    'VN30F1Q',
    'VN30F2Q',
    'VN100F1M',
    'VN100F2M',
    'VN100F1Q',
    'VN100F2Q',
];

// List 3: Special Indexes
const FINEXT_INDEXES = [
    'FNXINDEX',
    'FNX100',
    'LARGECAP',
    'MIDCAP',
    'SMALLCAP',
    'VUOTTROI',
    'ONDINH',
    'SUKIEN',
];

// Map tab -> index list
const INDEX_TAB_MAP: Record<IndexTabType, string[]> = {
    main: MAIN_INDEXES,
    derivative: DERIVATIVE_INDEXES,
    finext: FINEXT_INDEXES,
};

// Type cho home_today_index response (grouped by ticker)
type IndexDataByTicker = Record<string, RawMarketData[]>;

interface MarketSectionProps {
    ticker: string;
    indexName: string;
    eodData: ChartData;
    intradayData: ChartData;
    isLoading: boolean;
    error: string | null;
    timeRange: TimeRange;
    onTimeRangeChange: (range: TimeRange) => void;
    indexTab: IndexTabType;
    onIndexTabChange: (tab: IndexTabType) => void;
    onTickerChange: (ticker: string) => void;
    todayAllData: IndexDataByTicker;
}

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
    const router = useRouter();

    const isDark = theme.palette.mode === 'dark';
    const glassStyles = (() => {
        const g = getGlassCard(isDark);
        return { background: g.background, backdropFilter: g.backdropFilter, WebkitBackdropFilter: g.WebkitBackdropFilter, border: g.border };
    })();

    // Colors for dropdown
    const dropdownColors = {
        background: theme.palette.component.chart.buttonBackground,
        text: theme.palette.text.primary,
        textActive: theme.palette.component.chart.buttonBackgroundActive,
    };

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

            {/* Main Content: Chart + Table */}
            <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: { xs: 2, md: 3 },
            }}>
                {/* Chart */}
                <Box sx={{ flex: 1, minWidth: 0, width: { xs: '100%', md: 'auto' } }}>
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

                {/* Index Table */}
                <Box sx={{
                    width: { xs: '100%', md: 320, lg: 400 },
                    flexShrink: 0,
                    mt: { xs: 0, md: 12.5 },
                }}>
                    {/* Dropdown chọn nhóm chỉ số - căn phải */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                        <FormControl size="small">
                            <Select
                                value={indexTab}
                                onChange={(e: SelectChangeEvent) => onIndexTabChange(e.target.value as IndexTabType)}
                                sx={{
                                    fontSize: getResponsiveFontSize('md'),
                                    borderRadius: 2,
                                    ...glassStyles,
                                    color: dropdownColors.text,
                                    height: { xs: 34, md: 33 },
                                    '& .MuiSelect-select': {
                                        py: 0,
                                        px: 1.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                    },
                                    '& .MuiOutlinedInput-notchedOutline': {
                                        border: 'none',
                                    },
                                    '&:hover': {
                                        opacity: 0.8,
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                        border: 'none',
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                        border: 'none',
                                    },
                                    '& .MuiSelect-icon': {
                                        color: dropdownColors.text,
                                    },
                                }}
                                MenuProps={{
                                    PaperProps: {
                                        sx: {
                                            backgroundColor: isDark
                                                ? 'rgba(30, 30, 30, 0.95)'
                                                : 'rgba(255, 255, 255, 0.95)',
                                            backdropFilter: 'blur(20px)',
                                            WebkitBackdropFilter: 'blur(20px)',
                                            backgroundImage: 'none',
                                            border: isDark
                                                ? '1px solid rgba(255, 255, 255, 0.1)'
                                                : '1px solid rgba(0, 0, 0, 0.08)',
                                            boxShadow: isDark
                                                ? '0 8px 32px rgba(0, 0, 0, 0.4)'
                                                : '0 8px 32px rgba(31, 38, 135, 0.1)',
                                            borderRadius: 2,
                                            '& .MuiList-root': {
                                                py: 0.5,
                                            },
                                            '& .MuiMenuItem-root': {
                                                fontSize: getResponsiveFontSize('md'),
                                                color: dropdownColors.text,
                                                backgroundColor: 'transparent !important',
                                                '&:hover': {
                                                    backgroundColor: 'transparent !important',
                                                },
                                                '&.Mui-selected': {
                                                    backgroundColor: 'transparent !important',
                                                    color: dropdownColors.textActive,
                                                },
                                                '&.Mui-selected:hover': {
                                                    backgroundColor: 'transparent !important',
                                                },
                                                '&.Mui-focusVisible': {
                                                    backgroundColor: 'transparent !important',
                                                },
                                            },
                                        },
                                    },
                                }}
                            >
                                <MenuItem value="main">Chỉ số thị trường</MenuItem>
                                <MenuItem value="finext">Chỉ số Finext</MenuItem>
                                <MenuItem value="derivative">Chỉ số phái sinh</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>

                    <IndexTable
                        selectedTicker={ticker}
                        onTickerChange={onTickerChange}
                        indexList={INDEX_TAB_MAP[indexTab]}
                        todayAllData={todayAllData}
                    />
                </Box>
            </Box>
        </Box>
    );
}

