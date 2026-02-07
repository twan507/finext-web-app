'use client';

import React, { useState, useEffect } from 'react';
import { Box, Typography, Skeleton, useMediaQuery, useTheme } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Link from 'next/link';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import dynamic from 'next/dynamic';
import type { TrendChartData, TrendTimeRange } from './MarketTrendChart';

const MarketTrendChart = dynamic(
    () => import('./MarketTrendChart'),
    {
        loading: () => <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />,
        ssr: false,
    }
);

const PhaseSignalSection = dynamic(
    () => import('./PhaseSignalSection'),
    {
        loading: () => <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2, mt: 4 }} />,
        ssr: false,
    }
);

interface MarketTrendSectionProps {
    chartData: TrendChartData;
    isLoading?: boolean;
}

export default function MarketTrendSection({
    chartData,
    isLoading = false,
}: MarketTrendSectionProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [timeRange, setTimeRange] = useState<TrendTimeRange>(isMobile ? '1M' : '3M');

    useEffect(() => {
        setTimeRange(isMobile ? '1M' : '3M');
    }, [isMobile]);

    return (
        <Box>
            {/* Section Title */}
            <Box
                component={Link}
                href="/markets/trends"
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    textDecoration: 'none',
                    color: 'inherit',
                    mb: 1,
                }}
            >
                <Typography
                    className="sub-section-title"
                    sx={{
                        fontSize: getResponsiveFontSize('h4'),
                        fontWeight: fontWeight.bold,
                    }}
                >
                    Xu hướng thị trường
                </Typography>
                <ChevronRightIcon
                    sx={{
                        fontSize: getResponsiveFontSize('h4').md,
                        color: 'text.secondary',
                    }}
                />
            </Box>

            {/* Trend Chart */}
            <MarketTrendChart
                chartData={chartData}
                isLoading={isLoading}
                timeRange={timeRange}
                onTimeRangeChange={setTimeRange}
                height={345}
            />

            {/* Phase Signal (Tín hiệu) - embedded inside Xu hướng thị trường */}
            <Box sx={{ mt: 4 }}>
                <PhaseSignalSection hideTitle={false} />
            </Box>
        </Box>
    );
}
