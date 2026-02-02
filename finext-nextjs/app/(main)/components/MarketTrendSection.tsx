'use client';

import { Box, Typography, useTheme, Card, Skeleton } from '@mui/material';
import Carousel, { Slide } from 'components/common/Carousel';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import { getPriceColor, getFlowColor, getVsiColor } from 'theme/colorHelpers';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export interface StockData {
    ticker: string;
    exchange: string;
    industry_name: string;
    pct_change: number;
    volume: number;
    close: number;
    vsi: number;
    t0_score: number;
    vsma5: number;
}

export interface NNStockData {
    ticker: string;
    net_value: number; // Value in base unit
    net_volume: number;
}

interface MarketTrendSectionProps {
    stockData?: StockData[];
    foreignData?: NNStockData[];
    isLoading?: boolean;
}

export default function MarketTrendSection({ stockData = [], foreignData = [], isLoading = false }: MarketTrendSectionProps) {
    const theme = useTheme();

    // Skeleton components for loading state
    const renderTableSkeleton = (title: string) => (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Skeleton variant="text" width={180} height={28} sx={{ mb: 1 }} />
            <Box sx={{ flex: 1, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '4px 0' }}><Skeleton variant="text" width={70} height={20} /></th>
                            <th style={{ textAlign: 'center', padding: '4px 25px' }}><Skeleton variant="text" width={50} height={20} /></th>
                            <th style={{ textAlign: 'center', padding: '4px 0px' }}><Skeleton variant="text" width={70} height={20} /></th>
                            <th style={{ textAlign: 'right', padding: '4px 0' }}><Skeleton variant="text" width={60} height={20} /></th>
                        </tr>
                    </thead>
                    <tbody>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <tr key={i}>
                                <td style={{ padding: '8px 0' }}><Skeleton variant="text" width={50} height={24} /></td>
                                <td style={{ padding: '8px 0', textAlign: 'center' }}><Skeleton variant="text" width={60} height={24} sx={{ mx: 'auto' }} /></td>
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

    const cardStyle = {
        bgcolor: 'background.paper',
        borderRadius: 3,
        height: '100%',
        boxShadow: 'none',
        border: 'none',
        backgroundImage: 'none',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    };

    // Helper to render slide content (data only, no Card wrapper)
    const renderStockSlide = (title: string, stocks: StockData[], color: string) => (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('lg'), fontWeight: fontWeight.semibold, mb: 1, textTransform: 'uppercase' }}>
                {title}
            </Typography>

            {/* Table Layout */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '4px 0', color: theme.palette.text.secondary, fontWeight: fontWeight.medium, border: 'none', fontSize: '0.8125rem' }}>Mã cổ phiếu</th>
                            <th style={{ textAlign: 'center', padding: '4px 25px', color: theme.palette.text.secondary, fontWeight: fontWeight.medium, border: 'none', fontSize: '0.8125rem' }}>Giá (%)</th>
                            <th style={{ textAlign: 'center', padding: '4px 0px', color: theme.palette.text.secondary, fontWeight: fontWeight.medium, border: 'none', fontSize: '0.8125rem' }}>Dòng tiền (+/-)</th>
                            <th style={{ textAlign: 'right', padding: '4px 0', color: theme.palette.text.secondary, fontWeight: fontWeight.medium, border: 'none', fontSize: '0.8125rem' }}>Thanh khoản</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stocks.map((stock) => {
                            const stockColor = getPriceColor(stock.pct_change, stock.exchange, theme);
                            return (
                                <tr key={stock.ticker}>
                                    <td style={{ padding: '8px 0', border: 'none' }}>
                                        <Link href={`/stock-analysis/${stock.ticker}`} style={{ textDecoration: 'none' }}>
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
                    </tbody>
                </table>
            </Box>
        </Box>
    );

    const renderNNSlide = (title: string, stocks: NNStockData[], color: string) => {
        const maxVal = Math.max(...stocks.map(s => Math.abs(s.net_value)));

        return (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('lg'), fontWeight: fontWeight.semibold, mb: 1, textTransform: 'uppercase' }}>
                    {title}
                </Typography>
                <Box sx={{ flex: 1, overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '4px 0', color: theme.palette.text.secondary, fontWeight: fontWeight.medium, border: 'none', fontSize: '0.8125rem', width: '22.5%' }}>Mã cổ phiếu </th>
                                <th style={{ textAlign: 'center', padding: '4px 0', border: 'none', width: '50%' }}></th>
                                <th style={{ textAlign: 'right', padding: '4px 0', color: theme.palette.text.secondary, fontWeight: fontWeight.medium, border: 'none', fontSize: '0.8125rem', width: '27.5%' }}>Giá trị giao dịch</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stocks.map((stock) => (
                                <tr key={stock.ticker}>
                                    <td style={{ padding: '8px 0', border: 'none' }}>
                                        <Link href={`/stock-analysis/${stock.ticker}`} style={{ textDecoration: 'none' }}>
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
                        </tbody>
                    </table>
                </Box>
            </Box>
        );
    };


    const renderBreadthSlide = (title: string, series: number[], labels: string[], colors: string[]) => {
        const total = series.reduce((a, b) => a + b, 0);

        const chartOptions: ApexOptions = {
            chart: {
                type: 'polarArea',
                background: 'transparent',
                toolbar: { show: false },
                fontFamily: 'inherit',
                animations: { enabled: false },
                sparkline: { enabled: false }
            },
            labels: labels,
            colors: colors,
            stroke: {
                show: false,
                width: 0
            },
            fill: {
                opacity: 1
            },
            legend: {
                show: false
            },
            dataLabels: {
                enabled: true,
                formatter: function (val: number) {
                    return val.toFixed(1) + '%';
                },
                style: {
                    fontSize: '0.75rem',
                    fontWeight: String(fontWeight.semibold),
                },
                background: {
                    enabled: true,
                    foreColor: theme.palette.text.primary,
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: 2,
                    padding: 4,
                    opacity: 1,
                    borderWidth: 0,
                },
                dropShadow: {
                    enabled: false
                },
            },
            plotOptions: {
                pie: {
                    dataLabels: {
                        offset: 0,
                        minAngleToShowLabel: 5
                    }
                },
                polarArea: {
                    rings: {
                        strokeWidth: 0
                    },
                    spokes: {
                        strokeWidth: 0
                    },
                }
            },
            yaxis: {
                show: false
            },
            tooltip: {
                enabled: false,
            }
        };

        return (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('lg'), fontWeight: fontWeight.semibold, mb: 0, textTransform: 'uppercase' }}>
                    {title}
                </Typography>
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', my: -1 }}>
                    <Box sx={{ width: '100%', maxWidth: '280px', height: '233px' }}>
                        <Chart key={theme.palette.mode} options={chartOptions} series={series} type="polarArea" height="100%" width="100%" />
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 0, flexWrap: 'wrap' }}>
                    {labels.map((label, index) => (
                        <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colors[index] }} />
                            <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.medium }}>
                                {label}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            </Box>
        );
    };

    // ===== DATA PROCESSING =====

    // 1. Stock Data (Gainers / Losers)
    // Custom Sort Score: close * pct_change * volume * vsi
    // Top Tăng: Highest Positive Score (Desc)
    // Top Giảm: Highest Negative Score (Asc)

    const getScore = (s: StockData) => {
        const vsi = s.vsi || 0;
        return s.pct_change * Math.max(vsi, 5);
    };
    const filteredStockData = stockData.filter(s => s.vsi < 5 && s.vsma5 > 500000);
    // Create a copy to sort
    const sortedByScore = [...filteredStockData].sort((a, b) => getScore(b) - getScore(a));

    // For gainers, we want the highest positive scores
    const topGainers = sortedByScore.filter(s => s.pct_change > 0).slice(0, 5);

    // For losers, we want the most negative scores (lowest values)
    // Since sortedByScore is Descending, the most negative will be at the end.
    // Or we can just sort ascending for losers.
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

    // 2. Foreign Data (Buy / Sell)
    const topNetBuy = [...foreignData].filter(x => x.net_value > 0).sort((a, b) => b.net_value - a.net_value).slice(0, 5);
    const topNetSell = [...foreignData].filter(x => x.net_value < 0).sort((a, b) => a.net_value - b.net_value).slice(0, 5);

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

    // 3b. Flow Score (t0_score)
    const flowPositive = stockData.filter(s => s.t0_score > 0).length;
    const flowNegative = stockData.filter(s => s.t0_score < 0).length;
    const flowNeutral = stockData.filter(s => s.t0_score === 0).length;

    const breadthSlides: Slide[] = [
        {
            id: 'breadth-price',
            component: renderBreadthSlide(
                "Độ rộng thị trường",
                [priceIncrease, priceUnchanged, priceDecrease],
                ['Tăng giá', 'Không đổi', 'Giảm giá'],
                [theme.palette.trend.up, theme.palette.trend.ref, theme.palette.trend.down]
            )
        },
        {
            id: 'breadth-flow',
            component: renderBreadthSlide(
                "Độ rộng dòng tiền",
                [flowPositive, flowNeutral, flowNegative],
                ['Tiền vào', 'Không đổi', 'Tiền ra'],
                [theme.palette.trend.up, theme.palette.trend.ref, theme.palette.trend.down]
            )
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

    return (
        <Box>
            <Typography sx={{ fontSize: getResponsiveFontSize('h4'), fontWeight: fontWeight.bold, mb: 2 }}>
                Diễn biến thị trường
            </Typography>

            <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                gap: { xs: 2, md: 1.5, lg: 3 },
            }}>
                {/* Column 1: Market Breadth (Donut Charts) */}
                <Card sx={cardStyle}>
                    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Carousel
                            slides={isLoading ? skeletonBreadthSlides : breadthSlides}
                            minHeight="280px"
                            autoPlayInterval={isLoading ? 0 : BREADTH_INTERVAL}
                        />
                    </Box>
                </Card>

                {/* Column 2: Top Biến Động (Gainers / Losers) */}
                <Card sx={cardStyle}>
                    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Carousel
                            slides={isLoading ? skeletonStockSlides : stockSlides}
                            minHeight="280px"
                            autoPlayInterval={isLoading ? 0 : STOCKS_INTERVAL}
                        />
                    </Box>
                </Card>

                {/* Column 3: Khối Ngoại (Buy / Sell) */}
                <Card sx={cardStyle}>
                    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Carousel
                            slides={isLoading ? skeletonForeignSlides : foreignSlides}
                            minHeight="280px"
                            autoPlayInterval={isLoading ? 0 : FOREIGN_INTERVAL}
                        />
                    </Box>
                </Card>
            </Box>
        </Box>
    );
}
