'use client';

import { useMemo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import InfoTooltip from 'components/common/InfoTooltip';

interface FinratiosRecord {
    date: string;
    ticker: string;
    ticker_name?: string;
    ryd11?: number;
    ryd21?: number;
    ryd25?: number;
    ryd26?: number;
    ryd14?: number;
    ryd7?: number;
    ryq76?: number;
    ryd28?: number;
    ryd30?: number;
}

const finratio_info_map: Record<string, { label: string; tooltip: string }> = {
    'ryd11': { label: 'Vốn hóa', tooltip: 'Tổng giá trị thị trường của ngành (tỷ đồng)' },
    'ryd21': { label: 'P/E', tooltip: 'Giá cổ phiếu / Lợi nhuận trên mỗi cổ phiếu' },
    'ryd25': { label: 'P/B', tooltip: 'Giá / Giá trị sổ sách trên mỗi cổ phiếu' },
    'ryd26': { label: 'P/S', tooltip: 'Giá / Doanh thu trên mỗi cổ phiếu' },
    'ryd14': { label: 'EPS', tooltip: 'Lợi nhuận trên mỗi cổ phiếu (đồng)' },
    'ryd7': { label: 'BVPS', tooltip: 'Giá trị sổ sách trên mỗi cổ phiếu (đồng)' },
    'ryq76': { label: 'PEG', tooltip: 'P/E / Tốc độ tăng trưởng lợi nhuận. < 1 = đang bị định giá thấp' },
    'ryd30': { label: 'EV/EBITDA', tooltip: 'Giá trị doanh nghiệp / EBITDA. Dùng so sánh cross-industry' },
};

const RATIO_KEYS = ['ryd11', 'ryd21', 'ryd25', 'ryd26', 'ryd14', 'ryd7', 'ryq76', 'ryd30'] as const;

function formatValue(key: string, value: number | undefined | null): string {
    if (value == null) return '—';
    switch (key) {
        case 'ryd11':
            return `${Math.round(value).toLocaleString('en-US')} Tỷ`;
        case 'ryd21':
        case 'ryd25':
        case 'ryd26':
        case 'ryq76':
        case 'ryd28':
        case 'ryd30':
            return value.toFixed(2);
        case 'ryd14':
        case 'ryd7':
            return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        default:
            return String(value);
    }
}

interface FinRatiosTableProps {
    data: FinratiosRecord[];
    isLoading?: boolean;
}

export default function FinRatiosTable({ data, isLoading }: FinRatiosTableProps) {
    const theme = useTheme();

    const EXCLUDED_TICKERS = ['FNXINDEX'];

    // Get latest record for each ticker
    const latestByTicker = useMemo(() => {
        const map = new Map<string, FinratiosRecord>();
        data.forEach(record => {
            if (!map.has(record.ticker) && !EXCLUDED_TICKERS.includes(record.ticker)) {
                map.set(record.ticker, record);
            }
        });
        return map;
    }, [data]);

    const rows = useMemo(() => {
        return Array.from(latestByTicker.values()).sort((a, b) => {
            const nameA = a.ticker_name || a.ticker;
            const nameB = b.ticker_name || b.ticker;
            return nameA.localeCompare(nameB);
        });
    }, [latestByTicker]);

    if (isLoading) {
        return (
            <Box sx={{ py: 2 }}>
                <Typography color="text.secondary">Đang tải dữ liệu...</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ overflowX: 'auto' }}>
            <Typography
                color="text.secondary"
                sx={{
                    fontSize: getResponsiveFontSize('lg'),
                    fontWeight: fontWeight.semibold,
                    mb: 2,
                    textTransform: 'uppercase',
                }}
            >
                Chỉ số định giá ngành
            </Typography>

            <Box sx={{ minWidth: 800 }}>
                {/* Header */}
                <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: '220px repeat(8, 1fr)',
                    gap: 0,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    pb: 1,
                }}>
                    <Box />
                    {RATIO_KEYS.map((key) => (
                        <Box key={key} sx={{ textAlign: 'right', pr: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                <Typography sx={{
                                    fontSize: getResponsiveFontSize('xs'),
                                    color: theme.palette.text.secondary,
                                    fontWeight: fontWeight.medium,
                                }}>
                                    {finratio_info_map[key].label}
                                </Typography>
                                <InfoTooltip title={finratio_info_map[key].tooltip} />
                            </Box>
                        </Box>
                    ))}
                </Box>

                {/* Rows */}
                {rows.map((row) => (
                    <Box key={row.ticker} sx={{
                        display: 'grid',
                        gridTemplateColumns: '220px repeat(8, 1fr)',
                        gap: 0,
                        py: 1,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        '&:last-child': { borderBottom: 'none' },
                    }}>
                        <Typography sx={{
                            fontSize: getResponsiveFontSize('sm'),
                            fontWeight: fontWeight.medium,
                            color: theme.palette.text.primary,
                            pr: 2,
                        }}>
                            {row.ticker_name || row.ticker}
                        </Typography>
                        {RATIO_KEYS.map((key) => (
                            <Typography key={key} sx={{
                                fontSize: getResponsiveFontSize('sm'),
                                // fontWeight: fontWeight.medium,
                                color: theme.palette.text.primary,
                                textAlign: 'right',
                                pr: 1,
                            }}>
                                {formatValue(key, row[key as keyof FinratiosRecord] as number)}
                            </Typography>
                        ))}
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
