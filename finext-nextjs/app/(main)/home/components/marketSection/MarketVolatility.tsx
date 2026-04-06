'use client';

import { Box, Typography, useTheme, Card, Skeleton, useMediaQuery } from '@mui/material';
import Carousel, { Slide } from 'components/common/Carousel';
import { getResponsiveFontSize, fontWeight, transitions, getGlassCard, getGlassHighlight, getGlassEdgeLight } from 'theme/tokens';
import { getPriceColor, getFlowColor, getVsiColor } from 'theme/colorHelpers';
import Link from 'next/link';
import BreadthPolarChart from './BreadthPolarChart';
import FlowBarChart from './FlowBarChart';

export interface StockData {
    ticker: string;
    exchange: string;
    industry_name: string;
    category_name?: string;
    marketcap_name?: string;
    diff?: number;
    pct_change: number;
    volume: number;
    trading_value: number;
    close: number;
    vsi: number;
    t0_score: number;
    t5_score?: number;
    vsma5: number;
    top100?: number;
}

export interface NNStockData {
    ticker: string;
    net_value: number; // Value in base unit
    net_volume: number;
}

interface MarketVolatilityProps {
    stockData?: StockData[];
    foreignData?: NNStockData[];
    isLoading?: boolean;
}

export default function MarketVolatility({ stockData = [], foreignData = [], isLoading = false }: MarketVolatilityProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isXsWidth = useMediaQuery(theme.breakpoints.only('xs'));
    const chartHeight = isXsWidth ? '251.5px' : '250px';

    // Skeleton components for loading state
    const renderTableSkeleton = (title: string) => (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Skeleton variant="text" width={180} height={28} sx={{ mb: 2 }} />
            <Box sx={{ flex: 1, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '4px 0' }}><Skeleton variant="text" width={70} height={20} /></th>
                            <th style={{ textAlign: 'center', padding: '4px 10px' }}><Skeleton variant="text" width={45} height={20} /></th>
                            <th style={{ textAlign: 'center', padding: '4px 10px' }}><Skeleton variant="text" width={50} height={20} /></th>
                            <th style={{ textAlign: 'center', padding: '4px 0px' }}><Skeleton variant="text" width={70} height={20} /></th>
                            <th style={{ textAlign: 'right', padding: '4px 0' }}><Skeleton variant="text" width={60} height={20} /></th>
                        </tr>
                    </thead>
                    <tbody>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <tr key={i}>
                                <td style={{ padding: '8px 0' }}><Skeleton variant="text" width={50} height={24} /></td>
                                <td style={{ padding: '8px 0', textAlign: 'center' }}><Skeleton variant="text" width={45} height={24} sx={{ mx: 'auto' }} /></td>
                                <td style={{ padding: '8px 0', textAlign: 'center' }}><Skeleton variant="text" width={50} height={24} sx={{ mx: 'auto' }} /></td>
                                <td style={{ padding: '8px 0', textAlign: 'center' }}><Skeleton variant="text" width={40} height={24} sx={{ mx: 'auto' }} /></td>
                                <td style={{ padding: '8px 0', textAlign: 'right' }}><Skeleton variant="text" width={55} height={24} sx={{ ml: 'auto' }} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Box>
        </Box>
    );

    const renderBreadthSkeleton = () => (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Skeleton variant="text" width={160} height={28} sx={{ mb: 1 }} />
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
                <Skeleton variant="circular" width={160} height={160} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2, pt: 1 }}>
                {[1, 2, 3].map((i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Skeleton variant="circular" width={10} height={10} />
                        <Skeleton variant="text" width={50} height={16} />
                    </Box>
                ))}
            </Box>
        </Box>
    );

    const renderNNSkeleton = () => (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Skeleton variant="text" width={200} height={28} sx={{ mb: 1 }} />
            <Box sx={{ flex: 1, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '4px 0', width: '22.5%' }}><Skeleton variant="text" width={70} height={20} /></th>
                            <th style={{ textAlign: 'center', padding: '4px 0', width: '50%' }}></th>
                            <th style={{ textAlign: 'right', padding: '4px 0', width: '27.5%' }}><Skeleton variant="text" width={100} height={20} sx={{ ml: 'auto' }} /></th>
                        </tr>
                    </thead>
                    <tbody>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <tr key={i}>
                                <td style={{ padding: '8px 0' }}><Skeleton variant="text" width={50} height={24} /></td>
                                <td style={{ padding: '8px 0' }}>
                                    <Skeleton variant="rounded" width={`${Math.random() * 50 + 30}%`} height={16} sx={{ borderRadius: 1 }} />
                                </td>
                                <td style={{ padding: '8px 0', textAlign: 'right' }}><Skeleton variant="text" width={60} height={24} sx={{ ml: 'auto' }} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Box>
        </Box>
    );

    const isDark = theme.palette.mode === 'dark';

    const cardStyle = {
        borderRadius: 3,
        height: '100%',
        backgroundImage: 'none',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative' as const,
        ...getGlassCard(isDark),
        '&::before': getGlassHighlight(isDark),
        '&::after': getGlassEdgeLight(isDark),
    };

    // Helper to render slide content (data only, no Card wrapper)
    const FIXED_ROW_COUNT = 5;

    const renderStockSlide = (title: string, stocks: StockData[], color: string) => {
        const emptyRowCount = Math.max(0, FIXED_ROW_COUNT - stocks.length);
        return (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('lg'), fontWeight: fontWeight.semibold, mb: 1, textTransform: 'uppercase' }}>
                    {title}
                </Typography>

                {/* Table Layout */}
                <Box sx={{ flex: 1, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '4px 0', color: theme.palette.text.secondary, fontWeight: fontWeight.medium, border: 'none', fontSize: '0.8125rem' }}>Mã cổ phiếu</th>
                                <th style={{ textAlign: 'center', padding: '4px 15px', color: theme.palette.text.secondary, fontWeight: fontWeight.medium, border: 'none', fontSize: '0.8125rem' }}>Giá</th>
                                <th style={{ textAlign: 'center', padding: '4px 10px', color: theme.palette.text.secondary, fontWeight: fontWeight.medium, border: 'none', fontSize: '0.8125rem' }}>Biến động</th>
                                <th style={{ textAlign: 'center', padding: '4px 0px', color: theme.palette.text.secondary, fontWeight: fontWeight.medium, border: 'none', fontSize: '0.8125rem' }}>Dòng tiền</th>
                                <th style={{ textAlign: 'right', padding: '4px 0', color: theme.palette.text.secondary, fontWeight: fontWeight.medium, border: 'none', fontSize: '0.8125rem' }}>Thanh khoản</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stocks.map((stock, index) => {
                                const stockColor = getPriceColor(stock.pct_change, stock.exchange, theme);
                                return (
                                    <tr key={`${stock.ticker}-${index}`}>
                                        <td style={{ padding: '8px 0', border: 'none' }}>
                                            <Link href={`/stocks/${stock.ticker}`} style={{ textDecoration: 'none' }}>
                                                <Typography
                                                    sx={{
                                                        fontSize: getResponsiveFontSize('sm'),
                                                        fontWeight: fontWeight.semibold,
                                                        color: 'text.primary',
                                                        '&:hover': {
                                                            color: 'primary.main',
                                                            cursor: 'pointer'
                                                        }
                                                    }}
                                                >
                                                    {stock.ticker}
                                                </Typography>
                                            </Link>
                                        </td>
                                        <td style={{ padding: '8px 0', textAlign: 'center', border: 'none' }}>
                                            <Typography color="text.primary" sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.medium }}>
                                                {stock.close.toFixed(1)}
                                            </Typography>
                                        </td>
                                        <td style={{ padding: '8px 0', textAlign: 'center', border: 'none' }}>
                                            <Typography color={stockColor} sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.medium, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                                {(stock.pct_change * 100).toFixed(2)}%
                                            </Typography>
                                        </td>
                                        <td style={{ padding: '8px 0', textAlign: 'center', border: 'none' }}>
                                            <Typography color={getFlowColor(stock.t0_score, theme)} sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.medium, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                                {stock.t0_score > 0 ? '+' : ''}{(stock.t0_score).toFixed(1)}
                                            </Typography>
                                        </td>
                                        <td style={{ padding: '8px 0', textAlign: 'right', border: 'none' }}>
                                            <Typography color={stock.vsi ? getVsiColor(stock.vsi, theme) : 'text.secondary'} sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.medium }}>
                                                {stock.vsi ? `${(stock.vsi * 100).toFixed(2)}%` : '-'}
                                            </Typography>
                                        </td>
                                    </tr>
                                );
                            })}
                            {/* Placeholder rows to always maintain 5 rows */}
                            {Array.from({ length: emptyRowCount }).map((_, i) => (
                                <tr key={`empty-${i}`}>
                                    <td style={{ padding: '8px 0', border: 'none' }}>
                                        <Typography sx={{ fontSize: getResponsiveFontSize('sm'), visibility: 'hidden' }}>&nbsp;</Typography>
                                    </td>
                                    <td style={{ padding: '8px 0', border: 'none' }}>&nbsp;</td>
                                    <td style={{ padding: '8px 0', border: 'none' }}>&nbsp;</td>
                                    <td style={{ padding: '8px 0', border: 'none' }}>&nbsp;</td>
                                    <td style={{ padding: '8px 0', border: 'none' }}>&nbsp;</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Box>
            </Box>
        );
    };

    const renderNNSlide = (title: string, stocks: NNStockData[], color: string) => {
        const maxVal = stocks.length > 0 ? Math.max(...stocks.map(s => Math.abs(s.net_value))) : 1;
        const emptyRowCount = Math.max(0, FIXED_ROW_COUNT - stocks.length);

        return (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('lg'), fontWeight: fontWeight.semibold, mb: 1, textTransform: 'uppercase' }}>
                    {title}
                </Typography>
                <Box sx={{ flex: 1, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '4px 0', color: theme.palette.text.secondary, fontWeight: fontWeight.medium, border: 'none', fontSize: '0.8125rem', width: '22.5%' }}>Mã cổ phiếu </th>
                                <th style={{ textAlign: 'center', padding: '4px 0', border: 'none', width: '50%' }}></th>
                                <th style={{ textAlign: 'right', padding: '4px 0', color: theme.palette.text.secondary, fontWeight: fontWeight.medium, border: 'none', fontSize: '0.8125rem', width: '27.5%' }}>Giá trị giao dịch</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stocks.map((stock, index) => (
                                <tr key={`${stock.ticker}-${index}`}>
                                    <td style={{ padding: '8px 0', border: 'none' }}>
                                        <Link href={`/stocks/${stock.ticker}`} style={{ textDecoration: 'none' }}>
                                            <Typography
                                                sx={{
                                                    fontSize: getResponsiveFontSize('sm'),
                                                    fontWeight: fontWeight.semibold,
                                                    color: 'text.primary',
                                                    '&:hover': {
                                                        color: 'primary.main',
                                                        cursor: 'pointer'
                                                    }
                                                }}
                                            >
                                                {stock.ticker}
                                            </Typography>
                                        </Link>
                                    </td>
                                    <td style={{ padding: '8px 0', border: 'none', verticalAlign: 'middle' }}>
                                        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center' }}>
                                            <Box sx={{
                                                width: `${Math.max((Math.abs(stock.net_value) / maxVal) * 100, 1)}%`,
                                                height: 16,
                                                bgcolor: color,
                                                borderRadius: 1,
                                                my: 0.5
                                            }} />
                                        </Box>
                                    </td>
                                    <td style={{ padding: '8px 0', textAlign: 'right', border: 'none' }}>
                                        <Typography color={color} sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.medium }}>
                                            {stock.net_value.toFixed(2)}T
                                        </Typography>
                                    </td>
                                </tr>
                            ))}
                            {/* Placeholder rows to always maintain 5 rows */}
                            {Array.from({ length: emptyRowCount }).map((_, i) => (
                                <tr key={`empty-nn-${i}`}>
                                    <td style={{ padding: '8px 0', border: 'none' }}>
                                        <Typography sx={{ fontSize: getResponsiveFontSize('sm'), visibility: 'hidden' }}>&nbsp;</Typography>
                                    </td>
                                    <td style={{ padding: '8px 0', border: 'none' }}>&nbsp;</td>
                                    <td style={{ padding: '8px 0', border: 'none' }}>&nbsp;</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Box>
            </Box>
        );
    };




    // ===== DATA PROCESSING =====

    // 1. Stock Data (Gainers / Losers)
    // Filter: vsi < 5 (thanh khoản tương đối < 500%) và vsma5 > 500,000
    // Score: pct_change * min(vsi, 2) — cap vsi tối đa 200% để tránh cổ phiếu thanh khoản đột biến chi phối

    const getScore = (s: StockData) => {
        const vsi = Math.min(s.vsi || 0, 2);
        return s.pct_change * vsi;
    };

    // Dedupe by ticker (SSE can send duplicate records), keep last occurrence (most recent data)
    const deduped = stockData.reduce<Record<string, StockData>>((acc, s) => {
        acc[s.ticker] = s;
        return acc;
    }, {});
    const filteredStockData = Object.values(deduped).filter(s => (s.vsi || 0) < 5 && (s.vsma5 || 0) > 500000);

    // For gainers: positive pct_change, sorted by score descending
    const topGainers = [...filteredStockData]
        .filter(s => s.pct_change > 0)
        .sort((a, b) => getScore(b) - getScore(a))
        .slice(0, 5);

    // For losers: negative pct_change, sorted by score ascending (most negative first)
    const topLosers = [...filteredStockData]
        .filter(s => s.pct_change < 0)
        .sort((a, b) => getScore(a) - getScore(b))
        .slice(0, 5);

    const stockSlides: Slide[] = [
        {
            id: 'top-gainers',
            component: renderStockSlide("Top Cổ Phiếu Tăng Giá", topGainers, theme.palette.trend.up)
        },
        {
            id: 'top-losers',
            component: renderStockSlide("Top Cổ Phiếu Giảm Giá", topLosers, theme.palette.trend.down)
        },
    ];

    // 2. Foreign Data (Buy / Sell) - dedupe by ticker
    const dedupedForeign = foreignData.reduce<Record<string, NNStockData>>((acc, s) => {
        acc[s.ticker] = s;
        return acc;
    }, {});
    const uniqueForeignData = Object.values(dedupedForeign);
    const topNetBuy = [...uniqueForeignData].filter(x => x.net_value > 0).sort((a, b) => b.net_value - a.net_value).slice(0, 5);
    const topNetSell = [...uniqueForeignData].filter(x => x.net_value < 0).sort((a, b) => a.net_value - b.net_value).slice(0, 5);

    const foreignSlides: Slide[] = [
        {
            id: 'net-buy',
            component: renderNNSlide("Top Khối Ngoại Mua Ròng", topNetBuy, theme.palette.trend.up)
        },
        {
            id: 'net-sell',
            component: renderNNSlide("Top Khối Ngoại Bán Ròng", topNetSell, theme.palette.trend.down)
        }
    ];

    // 3. Market Breadth Data
    // 3a. Price Change (pct_change)
    const priceIncrease = stockData.filter(s => s.pct_change > 0).length;
    const priceDecrease = stockData.filter(s => s.pct_change < 0).length;
    const priceUnchanged = stockData.filter(s => s.pct_change === 0).length;

    // 3b. Flow Distribution (trading_value grouped by t0_score)
    const flowIn = stockData.filter(s => s.t0_score > 0).reduce((sum, s) => sum + (s.trading_value || 0), 0);
    const flowOut = stockData.filter(s => s.t0_score < 0).reduce((sum, s) => sum + (s.trading_value || 0), 0);
    const flowNeutral = stockData.filter(s => s.t0_score === 0).reduce((sum, s) => sum + (s.trading_value || 0), 0);

    const breadthSlides: Slide[] = [
        {
            id: 'breadth-price',
            component: <BreadthPolarChart
                title="Độ rộng thị trường"
                series={[priceIncrease, priceUnchanged, priceDecrease]}
                labels={['Tăng giá', 'Không đổi', 'Giảm giá']}
                colors={[theme.palette.trend.up, theme.palette.trend.ref, theme.palette.trend.down]}
                chartHeight={chartHeight}
            />
        },
        {
            id: 'flow-distribution',
            component: <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('lg'), fontWeight: fontWeight.semibold, mb: 0, textTransform: 'uppercase' }}>
                    Phân bổ dòng tiền
                </Typography>
                <FlowBarChart
                    flowIn={flowIn}
                    flowOut={flowOut}
                    flowNeutral={flowNeutral}
                    chartHeight={chartHeight}
                    isLoading={isLoading}
                />
            </Box>
        }
    ];

    const BREADTH_INTERVAL = 12000;
    const STOCKS_INTERVAL = 10000;
    const FOREIGN_INTERVAL = 8000;

    // Skeleton slides for loading state
    const skeletonBreadthSlides: Slide[] = [
        { id: 'skeleton-breadth', component: renderBreadthSkeleton() }
    ];

    const skeletonStockSlides: Slide[] = [
        { id: 'skeleton-stock', component: renderTableSkeleton('Loading...') }
    ];

    const skeletonForeignSlides: Slide[] = [
        { id: 'skeleton-foreign', component: renderNNSkeleton() }
    ];

    // Mobile: all 6 slides in one carousel
    const allSlides: Slide[] = [...breadthSlides, ...stockSlides, ...foreignSlides];
    const allSkeletonSlides: Slide[] = [
        { id: 'skeleton-all', component: renderBreadthSkeleton() }
    ];

    return (
        <Box>
            <Typography sx={{ fontSize: getResponsiveFontSize('h4'), fontWeight: fontWeight.bold, mb: 2 }}>
                Diễn biến thị trường
            </Typography>

            {/* Mobile: Single carousel with all 6 slides */}
            {isMobile ? (
                <Card sx={cardStyle}>
                    <Box sx={{ px: 2, pt: 2, pb: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Carousel
                            slides={isLoading ? allSkeletonSlides : allSlides}
                            minHeight="auto"
                            height="100%"
                            autoPlayInterval={isLoading ? 0 : STOCKS_INTERVAL}
                        />
                    </Box>
                </Card>
            ) : (
                /* Desktop: 3 columns */
                <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: { md: 1.5, lg: 3 },
                }}>
                    {/* Column 1: Market Breadth (Donut Charts) */}
                    <Card sx={cardStyle}>
                        <Box sx={{ px: 2, pt: 2, pb: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Carousel
                                slides={isLoading ? skeletonBreadthSlides : breadthSlides}
                                minHeight="auto"
                                height="100%"
                                autoPlayInterval={isLoading ? 0 : BREADTH_INTERVAL}
                            />
                        </Box>
                    </Card>

                    {/* Column 2: Top Biến Động (Gainers / Losers) */}
                    <Card sx={cardStyle}>
                        <Box sx={{ px: 2, pt: 2, pb: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Carousel
                                slides={isLoading ? skeletonStockSlides : stockSlides}
                                minHeight="auto"
                                height="100%"
                                autoPlayInterval={isLoading ? 0 : STOCKS_INTERVAL}
                            />
                        </Box>
                    </Card>

                    {/* Column 3: Khối Ngoại (Buy / Sell) */}
                    <Card sx={cardStyle}>
                        <Box sx={{ px: 2, pt: 2, pb: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <Carousel
                                slides={isLoading ? skeletonForeignSlides : foreignSlides}
                                minHeight="auto"
                                height="100%"
                                autoPlayInterval={isLoading ? 0 : FOREIGN_INTERVAL}
                            />
                        </Box>
                    </Card>
                </Box>
            )}
        </Box>
    );
}
