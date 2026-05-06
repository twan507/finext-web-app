'use client';

import { useMemo } from 'react';
import { Box, Typography, useTheme, Card, useMediaQuery } from '@mui/material';
import Carousel, { Slide } from 'components/common/Carousel';
import {
    getResponsiveFontSize,
    fontWeight,
    getGlassCard,
    getGlassHighlight,
    getGlassEdgeLight,
} from 'theme/tokens';

import GroupStockTable, { GroupStockRowData }
    from '../../../groups/[groupId]/components/GroupStockTable';
import type { StockData } from '../marketSection/MarketVolatility';

const SCORE_VSI_CAP = 2;
const TOP_N = 10;
const CAROUSEL_INTERVAL = 20000;

interface FeaturedStocksSectionProps {
    stockData?: StockData[];
    isLoading?: boolean;
}

function toRowData(s: StockData): GroupStockRowData {
    return {
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
    };
}

export default function FeaturedStocksSection({
    stockData = [],
    isLoading = false,
}: FeaturedStocksSectionProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const cardStyle = {
        borderRadius: 3,
        backgroundImage: 'none',
        overflow: 'hidden',
        position: 'relative' as const,
        ...getGlassCard(isDark),
        '&::before': getGlassHighlight(isDark),
        '&::after': getGlassEdgeLight(isDark),
    };

    const { topInflow, topOutflow } = useMemo(() => {
        if (stockData.length === 0) {
            return { topInflow: [], topOutflow: [] };
        }

        const deduped = stockData.reduce<Record<string, StockData>>((acc, s) => {
            acc[s.ticker] = s;
            return acc;
        }, {});

        const filtered = Object.values(deduped).filter(
            (s) => (s.vsi || 0) < 5 && (s.vsma5 || 0) > 500_000
        );

        const getScore = (s: StockData) =>
            (s.t0_score || 0) * Math.min(s.vsi || 0, SCORE_VSI_CAP);

        const inflow = [...filtered]
            .sort((a, b) => getScore(b) - getScore(a))
            .slice(0, TOP_N)
            .map(toRowData);

        const outflow = [...filtered]
            .sort((a, b) => getScore(a) - getScore(b))
            .slice(0, TOP_N)
            .map(toRowData);

        return { topInflow: inflow, topOutflow: outflow };
    }, [stockData]);

    const renderSlide = (
        title: string,
        color: string,
        data: GroupStockRowData[],
        loading: boolean
    ) => (
        <Box>
            <Typography
                sx={{
                    fontSize: getResponsiveFontSize('lg'),
                    fontWeight: fontWeight.semibold,
                    color,
                    mb: 1,
                    textTransform: 'uppercase',
                }}
            >
                {title}
            </Typography>
            <GroupStockTable
                data={data}
                isLoading={loading}
                skeletonRows={TOP_N}
            />
        </Box>
    );

    const slides: Slide[] = [
        {
            id: 'top-inflow',
            component: renderSlide(
                'Top dòng tiền vào mạnh',
                theme.palette.trend.up,
                topInflow,
                isLoading
            ),
        },
        {
            id: 'top-outflow',
            component: renderSlide(
                'Top dòng tiền ra mạnh',
                theme.palette.trend.down,
                topOutflow,
                isLoading
            ),
        },
    ];

    return (
        <Card sx={cardStyle}>
            <Box sx={{ px: 2, pt: 2, pb: 1 }}>
                <Carousel
                    slides={slides}
                    autoPlayInterval={isLoading ? 0 : CAROUSEL_INTERVAL}
                    minHeight="auto"
                    height="100%"
                />
            </Box>
        </Card>
    );
}
