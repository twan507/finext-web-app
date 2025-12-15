'use client';

import { useEffect, useState, useRef } from 'react';
import { Box, Typography, Skeleton, useTheme } from '@mui/material';
import { fontSize } from 'theme/tokens';

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

const getChangeColor = (value: number | null): string => {
    if (value == null || Math.abs(value) < 0.0001) return '#eab308';
    return value > 0 ? '#22c55e' : '#ef4444';
};

// Component cho từng row - nhận data từ props (SSE today)
function IndexRow({ ticker, isSelected, onClick, isLast, todayData }: IndexRowProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

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

    const changeColor = getChangeColor(pctChange);
    const dividerColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const isLoading = !todayData || todayData.length === 0;

    if (isLoading && price == null) {
        return (
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: '1.8fr 1fr 0.8fr 0.8fr',
                gap: 1,
                px: 1.5,
                py: 1.5,
                borderBottom: isLast ? 'none' : `1px solid ${dividerColor}`
            }}>
                <Skeleton variant="text" width="80%" height={20} />
                <Skeleton variant="text" width="70%" height={20} sx={{ ml: 'auto' }} />
                <Skeleton variant="text" width="60%" height={20} sx={{ ml: 'auto' }} />
                <Skeleton variant="text" width="60%" height={20} sx={{ ml: 'auto' }} />
            </Box>
        );
    }

    return (
        <Box
            onClick={onClick}
            sx={{
                display: 'grid',
                gridTemplateColumns: '1.8fr 1fr 0.8fr 0.8fr',
                gap: 1,
                px: 1.5,
                py: 1.5,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
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
                    '0%': { bgcolor: 'rgba(34, 197, 94, 0.25)' },
                    '100%': { bgcolor: isSelected ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') : 'transparent' }
                },
                '@keyframes flash-down': {
                    '0%': { bgcolor: 'rgba(239, 68, 68, 0.25)' },
                    '100%': { bgcolor: isSelected ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') : 'transparent' }
                }
            }}
        >
            {/* Tên index */}
            <Typography sx={{
                fontSize: fontSize.tableCell.tablet,
                fontWeight: isSelected ? 600 : 500,
                color: 'text.primary',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }}>
                {tickerName}
            </Typography>

            {/* Giá */}
            <Typography sx={{
                fontSize: fontSize.tableCell.tablet,
                fontWeight: 600,
                color: 'text.primary',
                textAlign: 'right'
            }}>
                {formatPrice(price)}
            </Typography>

            {/* Biến động điểm */}
            <Typography sx={{
                fontSize: fontSize.tableCell.tablet,
                fontWeight: 500,
                color: changeColor,
                textAlign: 'right'
            }}>
                {formatDiff(diff)}
            </Typography>

            {/* Biến động % */}
            <Typography sx={{
                fontSize: fontSize.tableCell.tablet,
                fontWeight: 500,
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
    return (
        <Box sx={{ overflow: 'hidden' }}>
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
