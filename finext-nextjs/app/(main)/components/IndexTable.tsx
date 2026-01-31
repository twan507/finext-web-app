'use client';

import { useEffect, useState, useRef } from 'react';
import { Box, Typography, Skeleton, useTheme, useMediaQuery, Theme } from '@mui/material';
import { transitions, getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';

interface RawMarketData {
    ticker: string;
    ticker_name?: string;
    date: string;
    close: number;
    volume: number;
    diff?: number;
    pct_change?: number;
}

// Type cho today data từ SSE
type TodayAllIndexesData = Record<string, RawMarketData[]>;

interface IndexRowProps {
    ticker: string;
    isSelected: boolean;
    onClick: () => void;
    isLast: boolean;
    todayData: RawMarketData[] | undefined;
}

// Helper outside component needs theme access, so move inside or assume theme is available in context/closure if needed.
// But easier to just instantiate theme inside or pass it.
// Actually `getChangeColor` is used inside component too.
// Let's refactor it to accept theme or use the hex codes that match the tokens if we can't access theme here easily (which we can't outside hook).
// BETTER: Move `getChangeColor` inside component or use a hook wrapper.
// HOWEVER, let's keep it simple and just use the component logic.

const getChangeColor = (value: number | null, theme: Theme): string => {
    if (value == null) return theme.palette.trend.ref;
    // Nếu biến động nằm trong khoảng ±0.005% thì tô màu vàng (ref)
    if (Math.abs(value) <= 0.005) return theme.palette.trend.ref;
    return value > 0 ? theme.palette.trend.up : theme.palette.trend.down;
};

// Component cho từng row - nhận data từ props (SSE today)
function IndexRow({ ticker, isSelected, onClick, isLast, todayData }: IndexRowProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'));

    // Responsive font size
    const cellFontSize = getResponsiveFontSize('sm');

    const [tickerName, setTickerName] = useState<string>(ticker);
    const [price, setPrice] = useState<number | null>(null);
    const [diff, setDiff] = useState<number | null>(null);
    const [pctChange, setPctChange] = useState<number | null>(null);
    const [flashType, setFlashType] = useState<'up' | 'down' | null>(null);

    const prevPriceRef = useRef<number | null>(null);

    useEffect(() => {
        if (todayData && Array.isArray(todayData) && todayData.length > 0) {
            const sorted = [...todayData].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );
            const lastRecord = sorted[sorted.length - 1];

            if (lastRecord) {
                const newPrice = lastRecord.close;

                // Xác định flash type
                if (prevPriceRef.current != null && newPrice !== prevPriceRef.current) {
                    setFlashType(newPrice > prevPriceRef.current ? 'up' : 'down');
                    // Clear flash sau 500ms
                    setTimeout(() => setFlashType(null), 500);
                }

                setTickerName(lastRecord.ticker_name || ticker);
                setPrice(newPrice);
                setDiff(lastRecord.diff ?? null);
                setPctChange(lastRecord.pct_change != null ? lastRecord.pct_change * 100 : null);

                prevPriceRef.current = newPrice;
            }
        }
    }, [todayData, ticker]);

    const formatPrice = (num: number | null): string => {
        if (num == null) return '--';
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatDiff = (num: number | null): string => {
        if (num == null) return '--';
        const prefix = num > 0 ? '+' : '';
        return `${prefix}${num.toFixed(2)}`;
    };

    const formatPct = (num: number | null): string => {
        if (num == null) return '--%';
        return `${num.toFixed(2)}%`;
    };

    const changeColor = getChangeColor(pctChange, theme);
    const dividerColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const isLoading = !todayData || todayData.length === 0;

    // Responsive padding
    const rowPadding = isMobile ? { px: 1, py: 1.25 } : { px: 1.5, py: 1.5 };

    if (isLoading && price == null) {
        return (
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: '1.8fr 1fr 0.8fr 0.8fr',
                gap: 1,
                ...rowPadding,
                borderBottom: isLast ? 'none' : `1px solid ${dividerColor}`
            }}>
                <Skeleton variant="text" width="80%" height={isMobile ? 18 : 20} />
                <Skeleton variant="text" width="70%" height={isMobile ? 18 : 20} sx={{ ml: 'auto' }} />
                <Skeleton variant="text" width="60%" height={isMobile ? 18 : 20} sx={{ ml: 'auto' }} />
                <Skeleton variant="text" width="60%" height={isMobile ? 18 : 20} sx={{ ml: 'auto' }} />
            </Box>
        );
    }

    return (
        <Box
            onClick={onClick}
            sx={{
                display: 'grid',
                gridTemplateColumns: '1.8fr 1fr 0.8fr 0.8fr',
                gap: isMobile ? 0.5 : 1,
                ...rowPadding,
                cursor: 'pointer',
                transition: transitions.colors,
                borderBottom: isLast ? 'none' : `1px solid ${dividerColor}`,
                bgcolor: isSelected
                    ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)')
                    : 'transparent',
                '&:hover': {
                    bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
                },
                // Flash animation
                animation: flashType ? `flash-${flashType} 0.5s ease` : 'none',
                '@keyframes flash-up': {
                    '0%': { bgcolor: `${theme.palette.trend.up}40` }, // 25% opacity
                    '100%': { bgcolor: isSelected ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') : 'transparent' }
                },
                '@keyframes flash-down': {
                    '0%': { bgcolor: `${theme.palette.trend.down}40` }, // 25% opacity
                    '100%': { bgcolor: isSelected ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') : 'transparent' }
                }
            }}
        >
            {/* Tên index */}
            <Typography sx={{
                fontSize: cellFontSize,
                fontWeight: isSelected ? fontWeight.semibold : fontWeight.medium,
                color: 'text.primary',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }}>
                {tickerName}
            </Typography>

            {/* Giá */}
            <Typography sx={{
                fontSize: cellFontSize,
                fontWeight: fontWeight.semibold,
                color: 'text.primary',
                textAlign: 'right'
            }}>
                {formatPrice(price)}
            </Typography>

            {/* Biến động điểm */}
            <Typography sx={{
                fontSize: cellFontSize,
                fontWeight: fontWeight.semibold,
                color: changeColor,
                textAlign: 'right'
            }}>
                {formatDiff(diff)}
            </Typography>

            {/* Biến động % */}
            <Typography sx={{
                fontSize: cellFontSize,
                fontWeight: fontWeight.semibold,
                color: changeColor,
                textAlign: 'right'
            }}>
                {formatPct(pctChange)}
            </Typography>
        </Box>
    );
}

// Main component
interface IndexTableProps {
    selectedTicker: string;
    onTickerChange: (ticker: string) => void;
    indexList: string[];
    todayAllData: TodayAllIndexesData;
}

export default function IndexTable({ selectedTicker, onTickerChange, indexList, todayAllData }: IndexTableProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return (
        <Box sx={{
            overflow: 'hidden',
            borderRadius: `${borderRadius.md}px`,
            // border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            // bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'
        }}>
            {/* Rows */}
            {indexList.map((ticker, index) => (
                <IndexRow
                    key={ticker}
                    ticker={ticker}
                    isSelected={ticker === selectedTicker}
                    onClick={() => onTickerChange(ticker)}
                    isLast={index === indexList.length - 1}
                    todayData={todayAllData[ticker]}
                />
            ))}
        </Box>
    );
}
