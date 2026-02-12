'use client';

import { useMemo } from 'react';
import { Box, Typography, useTheme, Card, useMediaQuery, Skeleton } from '@mui/material';
import Carousel, { Slide } from 'components/common/Carousel';
import { getResponsiveFontSize, fontWeight, getGlassCard, getGlassHighlight, getGlassEdgeLight } from 'theme/tokens';
import { getPriceColor, getFlowColor, getVsiColor } from 'theme/colorHelpers';
import Link from 'next/link';

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

interface IndustryStocksSectionProps {
    stockData?: StockData[];
    isLoading?: boolean;
}

// Group stocks by industry and get top gainers
interface IndustryGroup {
    industryName: string;
    stocks: StockData[];
}

export default function IndustryStocksSection({ stockData = [], isLoading = false }: IndustryStocksSectionProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

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

    // Skeleton component for loading state
    const renderIndustrySkeleton = () => (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Skeleton variant="text" width={150} height={28} sx={{ mb: 1 }} />
            <Box sx={{ flex: 1, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '4px 0' }}><Skeleton variant="text" width={45} height={20} /></th>
                            <th style={{ textAlign: 'center', padding: '4px 10px' }}><Skeleton variant="text" width={40} height={20} /></th>
                            <th style={{ textAlign: 'center', padding: '4px 10px' }}><Skeleton variant="text" width={50} height={20} /></th>
                            <th style={{ textAlign: 'center', padding: '4px 0px' }}><Skeleton variant="text" width={60} height={20} /></th>
                            <th style={{ textAlign: 'right', padding: '4px 0' }}><Skeleton variant="text" width={65} height={20} /></th>
                        </tr>
                    </thead>
                    <tbody>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <tr key={i}>
                                <td style={{ padding: '8px 0' }}><Skeleton variant="text" width={45} height={24} /></td>
                                <td style={{ padding: '8px 0', textAlign: 'center' }}><Skeleton variant="text" width={40} height={24} sx={{ mx: 'auto' }} /></td>
                                <td style={{ padding: '8px 0', textAlign: 'center' }}><Skeleton variant="text" width={50} height={24} sx={{ mx: 'auto' }} /></td>
                                <td style={{ padding: '8px 0', textAlign: 'center' }}><Skeleton variant="text" width={35} height={24} sx={{ mx: 'auto' }} /></td>
                                <td style={{ padding: '8px 0', textAlign: 'right' }}><Skeleton variant="text" width={55} height={24} sx={{ ml: 'auto' }} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Box>
        </Box>
    );

    // Skeleton slides for loading state
    const skeletonSlides: Slide[] = [
        { id: 'skeleton-1', component: renderIndustrySkeleton() }
    ];

    // Group stocks by industry and get top 5 gainers for each
    const industryGroups = useMemo(() => {
        if (!stockData || stockData.length === 0) return [];

        // Helper function to calculate score (same as MarketTrendSection)
        const getScore = (s: StockData) => {
            const vsi = s.vsi || 0;
            return s.pct_change * Math.max(vsi, 5);
        };

        // Group by industry_name
        const groupMap = new Map<string, StockData[]>();

        stockData.forEach(stock => {
            const industry = stock.industry_name || 'Khác';
            if (!groupMap.has(industry)) {
                groupMap.set(industry, []);
            }
            groupMap.get(industry)!.push(stock);
        });

        // Convert to array and sort each group by score desc, take top 5
        const groups: IndustryGroup[] = [];
        groupMap.forEach((stocks, industryName) => {
            // Filter stocks with good volume and vsi, then sort by score
            const filteredStocks = stocks
                .filter(s => s.vsi < 5 && s.vsma5 > 100000) // Same filter as MarketTrendSection
                .sort((a, b) => getScore(b) - getScore(a)) // Sort by score descending
                .slice(0, 5);

            if (filteredStocks.length > 0) {
                groups.push({
                    industryName,
                    stocks: filteredStocks
                });
            }
        });

        // Sort industries alphabetically by name
        groups.sort((a, b) => a.industryName.localeCompare(b.industryName, 'vi'));

        return groups;
    }, [stockData]);

    // Render slide content for a single industry
    const renderIndustrySlide = (group: IndustryGroup) => (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Link href={`/industry/${encodeURIComponent(group.industryName)}`} style={{ textDecoration: 'none' }}>
                <Typography
                    color="text.secondary"
                    sx={{
                        fontSize: getResponsiveFontSize('lg'),
                        fontWeight: fontWeight.semibold,
                        mb: 1,
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        '&:hover': {
                            color: 'text.primary',
                            cursor: 'pointer'
                        }
                    }}
                >
                    {group.industryName}
                </Typography>
            </Link>

            {/* Table Layout */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
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
                        {group.stocks.map((stock) => {
                            const stockColor = getPriceColor(stock.pct_change, stock.exchange, theme);
                            return (
                                <tr key={stock.ticker}>
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
                    </tbody>
                </table>
            </Box>
        </Box>
    );

    // Split industries into 3 columns (6 industries each)
    const column1Industries = industryGroups.slice(0, 8);
    const column2Industries = industryGroups.slice(8, 16);
    const column3Industries = industryGroups.slice(16, 24);

    // Create slides for each column
    const column1Slides: Slide[] = column1Industries.map(group => ({
        id: `col1-${group.industryName}`,
        component: renderIndustrySlide(group)
    }));

    const column2Slides: Slide[] = column2Industries.map(group => ({
        id: `col2-${group.industryName}`,
        component: renderIndustrySlide(group)
    }));

    const column3Slides: Slide[] = column3Industries.map(group => ({
        id: `col3-${group.industryName}`,
        component: renderIndustrySlide(group)
    }));

    // Mobile: all 18 industries in one carousel
    const allSlides: Slide[] = industryGroups.slice(0, 24).map(group => ({
        id: `all-${group.industryName}`,
        component: renderIndustrySlide(group)
    }));

    // Auto-play intervals (staggered for visual variety)
    const COLUMN1_INTERVAL = 8000;
    const COLUMN2_INTERVAL = 9000;
    const COLUMN3_INTERVAL = 10000;

    // Don't render if no data and not loading
    if (industryGroups.length === 0 && !isLoading) {
        return null;
    }

    return (
        <Box>
            <Typography sx={{ fontSize: getResponsiveFontSize('h4'), fontWeight: fontWeight.bold, mb: 2 }}>
                Cổ phiếu nổi bật
            </Typography>

            {/* Mobile: Single carousel with all 18 industries */}
            {isMobile ? (
                <Card sx={cardStyle}>
                    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Carousel
                            slides={isLoading ? skeletonSlides : allSlides}
                            minHeight="280px"
                            autoPlayInterval={isLoading ? 0 : COLUMN1_INTERVAL}
                        />
                    </Box>
                </Card>
            ) : (
                /* Desktop: 3 columns with 6 industries each */
                <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: { md: 1.5, lg: 3 },
                }}>
                    {/* Column 1 */}
                    {(isLoading || column1Slides.length > 0) && (
                        <Card sx={cardStyle}>
                            <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <Carousel
                                    slides={isLoading ? skeletonSlides : column1Slides}
                                    minHeight="280px"
                                    autoPlayInterval={isLoading ? 0 : COLUMN1_INTERVAL}
                                />
                            </Box>
                        </Card>
                    )}

                    {/* Column 2 */}
                    {(isLoading || column2Slides.length > 0) && (
                        <Card sx={cardStyle}>
                            <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <Carousel
                                    slides={isLoading ? skeletonSlides : column2Slides}
                                    minHeight="280px"
                                    autoPlayInterval={isLoading ? 0 : COLUMN2_INTERVAL}
                                />
                            </Box>
                        </Card>
                    )}

                    {/* Column 3 */}
                    {(isLoading || column3Slides.length > 0) && (
                        <Card sx={cardStyle}>
                            <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <Carousel
                                    slides={isLoading ? skeletonSlides : column3Slides}
                                    minHeight="280px"
                                    autoPlayInterval={isLoading ? 0 : COLUMN3_INTERVAL}
                                />
                            </Box>
                        </Card>
                    )}
                </Box>
            )}
        </Box>
    );
}
