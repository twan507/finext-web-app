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
            // Push arc upward so the ±110° arc ends don't get clipped at bottom
            offsetY: 15,
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
                // Text rendered as overlay JSX for precise positioning
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
        <Box sx={{ width: '100%', height: chartHeight, position: 'relative' }}>
            {/* Arc chart fills the full container */}
            <Chart
                options={chartOptions}
                series={series}
                type="radialBar"
                height={chartHeight}
                width="100%"
            />

            {/* Percentage — overlaid in hollow center.
                bottom % compensates for chart.offsetY: -28 shifting arc upward. */}
            <Box
                sx={{
                    position: 'absolute',
                    bottom: '34%',
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                }}
            >
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('xxl'),
                        fontWeight: fontWeight.bold,
                        color: arcColor,
                        lineHeight: 1,
                    }}
                >
                    {value !== null ? `${displayValue.toFixed(2)}%` : '—'}
                </Typography>
            </Box>

            {/* Level badge — sits just below the arc end points */}
            <Box
                sx={{
                    position: 'absolute',
                    bottom: '6%',
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                }}
            >
                <Box
                    sx={{
                        py: 0.75,
                        borderRadius: 1.5,
                        backgroundColor: arcColor,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 150,
                    }}
                >
                    <Typography
                        sx={{
                            fontSize: getResponsiveFontSize('md'),
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
