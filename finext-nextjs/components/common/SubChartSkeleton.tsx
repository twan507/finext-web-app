'use client';

import React from 'react';
import { Box, Skeleton, useTheme, keyframes } from '@mui/material';

// ── Animations ───────────────────────────────────────────────────────────────

const shimmer = keyframes`
  0% { opacity: 0.4; }
  50% { opacity: 0.7; }
  100% { opacity: 0.4; }
`;

const drawLine = keyframes`
  0% { stroke-dashoffset: 600; }
  100% { stroke-dashoffset: 0; }
`;

// ── Pre-computed random data for consistent renders ──────────────────────────

// Smooth wave paths for line chart skeleton (pre-generated)
const WAVE_PATH_1 = 'M0,55 C15,50 30,42 50,45 C70,48 85,35 110,40 C135,45 155,30 180,35 C205,40 225,25 250,30 C275,35 295,22 320,28 C345,34 365,20 390,25 C415,30 435,18 460,22 C485,26 500,20 520,24';
const WAVE_PATH_2 = 'M0,70 C20,65 40,72 60,68 C80,64 100,75 120,70 C140,65 160,55 185,60 C210,65 230,50 255,55 C280,60 300,48 325,52 C350,56 370,42 395,48 C420,54 440,40 465,45 C490,50 510,38 520,42';
const WAVE_PATH_3 = 'M0,40 C18,35 35,45 55,42 C75,39 95,50 115,48 C135,46 155,38 180,42 C205,46 225,35 250,38 C275,41 295,30 320,35 C345,40 365,28 390,32 C415,36 440,26 465,30 C490,34 510,25 520,28';

// Random bar heights for mixed chart
const BAR_HEIGHTS = [35, 55, 25, 65, 45, 30, 60, 40, 50, 20, 55, 35, 70, 40, 25, 50, 60, 30, 45, 55];

// ── Types ────────────────────────────────────────────────────────────────────

interface SubChartSkeletonProps {
    /** Height of the skeleton container */
    height: number | string;
    /** Visual variant */
    variant?: 'line' | 'mixed' | 'trend';
    /** Number of legend items to show */
    legendCount?: number;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SubChartSkeleton({
    height,
    variant = 'line',
    legendCount = 2,
}: SubChartSkeletonProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    // Skeleton colors
    const lineColor1 = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    const lineColor2 = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
    const lineColor3 = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
    const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
    const barColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
    const textColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const legendDotColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';

    const numericHeight = typeof height === 'number' ? height : parseInt(height as string) || 280;
    const chartAreaTop = 36; // Space for legend
    const chartAreaBottom = 24; // Space for x-axis labels
    const chartHeight = numericHeight - chartAreaTop - chartAreaBottom;

    return (
        <Box
            sx={{
                width: '100%',
                height,
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 2,
            }}
        >
            {/* ── Legend skeleton ── */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 2,
                    pt: 0.5,
                    pb: 0.5,
                    height: chartAreaTop,
                    alignItems: 'center',
                }}
            >
                {Array.from({ length: legendCount }).map((_, i) => (
                    <Box
                        key={i}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                        }}
                    >
                        <Box
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: legendDotColor,
                            }}
                        />
                        <Skeleton
                            variant="text"
                            width={60 + i * 15}
                            height={12}
                            animation="wave"
                            sx={{ bgcolor: textColor, borderRadius: 0.5 }}
                        />
                    </Box>
                ))}
            </Box>

            {/* ── Chart area ── */}
            <Box
                sx={{
                    position: 'relative',
                    height: chartHeight,
                    mx: 0.5,
                }}
            >
                {/* Grid lines (horizontal) */}
                <Box sx={{ position: 'absolute', inset: 0 }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                        <Box
                            key={i}
                            sx={{
                                position: 'absolute',
                                left: 0,
                                right: 48,
                                top: `${(i / 4) * 100}%`,
                                height: '1px',
                                bgcolor: gridColor,
                            }}
                        />
                    ))}
                </Box>

                {/* SVG wave lines */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 48,
                        bottom: 0,
                        animation: `${shimmer} 2.5s ease-in-out infinite`,
                    }}
                >
                    <svg
                        width="100%"
                        height="100%"
                        viewBox="0 0 520 100"
                        preserveAspectRatio="none"
                        style={{ display: 'block' }}
                    >
                        {/* Primary line */}
                        <path
                            d={WAVE_PATH_1}
                            fill="none"
                            stroke={lineColor1}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            style={{
                                strokeDasharray: 600,
                                animation: `${drawLine} 2s ease-out forwards`,
                            }}
                        />
                        {/* Secondary line */}
                        <path
                            d={WAVE_PATH_2}
                            fill="none"
                            stroke={lineColor2}
                            strokeWidth="2"
                            strokeLinecap="round"
                            style={{
                                strokeDasharray: 600,
                                animation: `${drawLine} 2.3s ease-out forwards`,
                                animationDelay: '0.2s',
                            }}
                        />
                        {/* Third line (for 3-series charts) */}
                        {(variant === 'line' && legendCount >= 3) && (
                            <path
                                d={WAVE_PATH_3}
                                fill="none"
                                stroke={lineColor3}
                                strokeWidth="2"
                                strokeLinecap="round"
                                style={{
                                    strokeDasharray: 600,
                                    animation: `${drawLine} 2.6s ease-out forwards`,
                                    animationDelay: '0.4s',
                                }}
                            />
                        )}

                        {/* Zero reference line (dashed) for trend variant */}
                        {variant === 'trend' && (
                            <line
                                x1="0" y1="50" x2="520" y2="50"
                                stroke={gridColor}
                                strokeWidth="1.5"
                                strokeDasharray="6 4"
                            />
                        )}
                    </svg>
                </Box>

                {/* Bar columns for mixed variant */}
                {variant === 'mixed' && (
                    <Box
                        sx={{
                            position: 'absolute',
                            left: 0,
                            right: 48,
                            bottom: 0,
                            height: '100%',
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: '3px',
                            px: 1,
                            animation: `${shimmer} 2.5s ease-in-out infinite`,
                            animationDelay: '0.4s',
                        }}
                    >
                        {BAR_HEIGHTS.map((h, i) => (
                            <Box
                                key={i}
                                sx={{
                                    flex: 1,
                                    height: `${h}%`,
                                    bgcolor: barColor,
                                    borderRadius: '2px 2px 0 0',
                                    minWidth: '4px',
                                }}
                            />
                        ))}
                    </Box>
                )}

                {/* Right y-axis labels */}
                <Box
                    sx={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 44,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        py: 0.5,
                    }}
                >
                    {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton
                            key={i}
                            variant="text"
                            width={32}
                            height={10}
                            animation="wave"
                            sx={{ bgcolor: textColor, borderRadius: 0.5, ml: 'auto' }}
                        />
                    ))}
                </Box>

                {/* Loading dots overlay */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: 'calc(50% - 24px)',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            gap: '5px',
                            '& > span': {
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                bgcolor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                                animation: 'subChartDotBounce 1.4s ease-in-out infinite both',
                            },
                            '& > span:nth-of-type(1)': { animationDelay: '-0.32s' },
                            '& > span:nth-of-type(2)': { animationDelay: '-0.16s' },
                            '& > span:nth-of-type(3)': { animationDelay: '0s' },
                            '@keyframes subChartDotBounce': {
                                '0%, 80%, 100%': { transform: 'scale(0.4)', opacity: 0.3 },
                                '40%': { transform: 'scale(1)', opacity: 0.8 },
                            },
                        }}
                    >
                        <span />
                        <span />
                        <span />
                    </Box>
                </Box>
            </Box>

            {/* ── X-axis labels ── */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-around',
                    alignItems: 'center',
                    height: chartAreaBottom,
                    px: 1,
                    mr: '48px',
                }}
            >
                {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton
                        key={i}
                        variant="text"
                        width={28}
                        height={10}
                        animation="wave"
                        sx={{ bgcolor: textColor, borderRadius: 0.5 }}
                    />
                ))}
            </Box>
        </Box>
    );
}
