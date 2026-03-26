'use client';

import { useMemo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import { getVsiColor } from 'theme/colorHelpers';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

interface VsiGaugeChartProps {
    /** Last VSI value as percentage (0–150+), e.g. 78.06 */
    value: number | null;
    chartHeight?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getVsiLabel(vsiRaw: number): string {
    if (vsiRaw < 0.6) return 'Rất thấp';
    if (vsiRaw < 0.9) return 'Thấp';
    if (vsiRaw < 1.2) return 'Trung bình';
    if (vsiRaw < 1.5) return 'Cao';
    return 'Rất cao';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VsiGaugeChart({ value, chartHeight = '250px' }: VsiGaugeChartProps) {
    const theme = useTheme();

    const displayValue = value ?? 0;
    const vsiRaw = displayValue / 100;
    const arcColor = getVsiColor(vsiRaw, theme);
    const label = getVsiLabel(vsiRaw);

    const trackColor = theme.palette.mode === 'dark'
        ? 'rgba(255,255,255,0.12)'
        : 'rgba(0,0,0,0.10)';

    const chartOptions: ApexOptions = useMemo(() => ({
        chart: {
            type: 'radialBar',
            background: 'transparent',
            toolbar: { show: false },
            fontFamily: 'inherit',
            animations: { enabled: true, speed: 500 },
            // Sparkline removes all internal padding — arc fills full SVG area
            sparkline: { enabled: true },
        },
        plotOptions: {
            radialBar: {
                startAngle: -100,
                endAngle: 100,
                hollow: {
                    size: '60%',
                    background: 'transparent',
                },
                track: {
                    background: trackColor,
                    strokeWidth: '100%',
                    margin: 0,
                },
                dataLabels: {
                    name: { show: false },
                    value: { show: false },
                },
            },
        },
        fill: {
            type: 'solid',
            colors: [arcColor],
        },
        stroke: { lineCap: 'round' },
        labels: ['Chỉ số thanh khoản'],
        tooltip: { enabled: false },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [theme, arcColor, trackColor]);

    const series = useMemo(() => [parseFloat(displayValue.toFixed(2))], [displayValue]);

    return (
        <Box sx={{ width: '100%', height: chartHeight, position: 'relative', overflow: 'hidden' }}>
            {/* Render chart larger than container — overflow: hidden crops the empty bottom.
                The arc (200° semicircle) only uses the top ~60% of the SVG square,
                so rendering at 150% height makes the arc fill the visible area. */}
            <Box
                sx={{
                    position: 'absolute',
                    top: -20,
                    left: '-5%',
                    width: '109%',
                    height: '140%',
                }}
            >
                <Chart
                    options={chartOptions}
                    series={series}
                    type="radialBar"
                    height="100%"
                    width="100%"
                />
            </Box>

            {/* Percentage — overlaid in hollow center */}
            <Box
                sx={{
                    position: 'absolute',
                    top: '52%',
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                }}
            >
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('h4'),
                        fontWeight: fontWeight.bold,
                        color: arcColor,
                        lineHeight: 1,
                    }}
                >
                    {value !== null ? `${displayValue.toFixed(2)}%` : '—'}
                </Typography>
            </Box>

            {/* Level badge */}
            <Box
                sx={{
                    bottom: '4%',
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    position: 'absolute',
                }}
            >
                <Box
                    sx={{
                        py: 1,
                        borderRadius: 1.5,
                        backgroundColor: arcColor,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 180,
                    }}
                >
                    <Typography
                        sx={{
                            fontSize: getResponsiveFontSize('lg').md,
                            fontWeight: fontWeight.semibold,
                            color: '#fff',
                            letterSpacing: '0.04em',
                        }}
                    >
                        {value !== null ? label : '—'}
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
}
