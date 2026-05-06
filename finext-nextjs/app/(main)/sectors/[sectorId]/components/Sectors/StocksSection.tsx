'use client';

import { useMemo } from 'react';
import { Box } from '@mui/material';
import dynamic from 'next/dynamic';

import SectorStockTable, { SectorStockRowData } from '../SectorStockTable';
import { StockData } from 'app/(main)/home/components/marketSection/MarketVolatility';
import ChartSectionTitle from 'components/common/ChartSectionTitle';
import { useMarketUpdateTime } from 'hooks/useMarketUpdateTime';

const UniTreeMap = dynamic(() => import('components/common/UniTreeMap'), { ssr: false });

interface StocksSectionProps {
    ticker: string;
    indexName: string;
    stockData: StockData[];
}

export default function StocksSection({
    ticker,
    indexName,
    stockData,
}: StocksSectionProps) {
    const updateTime = useMarketUpdateTime();
    // Filter stocks by this sector's industry_name
    const filteredStocks: StockData[] = useMemo(() => {
        if (stockData.length === 0) return [];
        return stockData
            .filter(s => {
                const industryName = s.industry_name || '';
                return industryName.toUpperCase() === ticker || industryName.toUpperCase() === indexName.toUpperCase();
            })
            .sort((a, b) => (b.trading_value || 0) - (a.trading_value || 0));
    }, [stockData, ticker, indexName]);

    const sectorStocks: SectorStockRowData[] = useMemo(() =>
        filteredStocks.slice(0, 10).map(s => ({
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
        })),
        [filteredStocks]);

    return (
        <Box>
            <ChartSectionTitle
                title={`Cổ phiếu nổi bật ngành ${indexName}`}
                description="Danh sách các cổ phiếu có giá trị giao dịch cao nhất trong ngành."
                updateTime={updateTime}
                sx={{ mb: 1 }}
            />
            <SectorStockTable
                data={sectorStocks}
                isLoading={stockData.length === 0}
                skeletonRows={10}
            />
            <Box sx={{ mt: 4 }}>
                <ChartSectionTitle
                    title={`Bản đồ ngành ${indexName}`}
                    description="Bản đồ thể hiện biến động giá và giá trị giao dịch của các cổ phiếu trong ngành."
                    updateTime={updateTime}
                    sx={{ mb: 1 }}
                />
                <UniTreeMap
                    data={filteredStocks}
                    chartHeight="550px"
                    seriesName={indexName}
                />
            </Box>
        </Box>
    );
}
