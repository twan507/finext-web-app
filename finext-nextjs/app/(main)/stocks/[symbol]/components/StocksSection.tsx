'use client';

import { Box, Typography, useTheme, alpha } from '@mui/material';
import { getResponsiveFontSize, fontWeight, borderRadius, getGlassCard } from 'theme/tokens';
import type { StockData } from '../../../components/marketSection/MarketVolatility';

interface StocksSectionProps {
    ticker: string;
    indexName: string;
    stockData: StockData[];
}

export default function StocksSection({ ticker, indexName, stockData }: StocksSectionProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return (
        <Box>
            <Box sx={{
                ...getGlassCard(isDark),
                p: 2,
                borderRadius: `${borderRadius.lg}px`,
            }}>
                <Typography sx={{
                    fontSize: getResponsiveFontSize('lg'),
                    fontWeight: fontWeight.semibold,
                    mb: 2,
                }}>
                    Danh sách cổ phiếu
                </Typography>
                <Box sx={{
                    minHeight: 200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                    borderRadius: `${borderRadius.md}px`,
                    py: 6,
                }}>
                    <Typography color="text.secondary">
                        [Danh sách cổ phiếu liên quan đến {indexName}]
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
}
