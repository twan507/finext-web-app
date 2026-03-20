'use client';

import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';

import SectorStockTable, { SectorStockRowData } from '../SectorStockTable';
import { StockData } from 'app/(main)/components/marketSection/MarketVolatility';

interface StocksSectionProps {
    ticker: string;
    indexName: string;
    stockData: StockData[];
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    const { getResponsiveFontSize, fontWeight } = require('theme/tokens');
    return (
        <Typography
            color="text.secondary"
            sx={{
                fontSize: getResponsiveFontSize('lg'),
                fontWeight: fontWeight.semibold,
                textTransform: 'uppercase',
                mb: 1,
            }}
        >
            {children}
        </Typography>
    );
}

export default function StocksSection({
    ticker,
    indexName,
    stockData,
}: StocksSectionProps) {
    // Filter stocks by this sector's industry_name
    const sectorStocks: SectorStockRowData[] = useMemo(() => {
        if (stockData.length === 0) return [];

        return stockData
            .filter(s => {
                // Match by industry_name (sector ticker_name)
                const industryName = s.industry_name || '';
                return industryName.toUpperCase() === ticker || industryName.toUpperCase() === indexName.toUpperCase();
            })
            .sort((a, b) => (b.trading_value || 0) - (a.trading_value || 0))
            .map(s => ({
                ticker: s.ticker,
                exchange: s.exchange,
                close: s.close,
                diff: s.diff,
                pct_change: s.pct_change,
                industry_name: s.industry_name,
                category_name: s.category_name,
                marketcap_name: s.marketcap_name,
                t0_score: s.t0_score,
                t5_score: s.t5_score,
                vsi: s.vsi,
            }));
    }, [stockData, ticker, indexName]);

    return (
        <Box>
            <Box sx={{ mb: 2 }}><SectionTitle>DANH SÁCH CỔ PHIẾU</SectionTitle></Box>
            <SectorStockTable
                data={sectorStocks}
                isLoading={stockData.length === 0}
                skeletonRows={10}
            />
        </Box>
    );
}
