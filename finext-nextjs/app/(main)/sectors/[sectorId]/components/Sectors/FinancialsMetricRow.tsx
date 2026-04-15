'use client';

import { Box, Typography, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import FinancialsSvgSparkline from './FinancialsSvgSparkline';
import type { ProcessedMetric } from './financials-config';

interface FinancialsMetricRowProps {
    metric: ProcessedMetric;
    isFocused: boolean;
    onFocus: () => void;
}

export default function FinancialsMetricRow({ metric, isFocused, onFocus }: FinancialsMetricRowProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const deltaColors = {
        success: theme.palette.success.main,
        error: theme.palette.error.main,
        neutral: theme.palette.text.disabled,
    };

    const sparklineColor = isFocused
        ? theme.palette.primary.main
        : isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)';

    return (
        <Box
            onClick={onFocus}
            sx={{
                display: 'grid',
                gridTemplateColumns: '16px 1fr 100px 100px 84px 104px',
                columnGap: 1,
                alignItems: 'center',
                py: 0.625,
                px: 0.5,
                cursor: 'pointer',
                borderRadius: '4px',
                bgcolor: isFocused
                    ? isDark ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.07)'
                    : 'transparent',
                '&:hover': {
                    bgcolor: isDark ? 'rgba(139,92,246,0.07)' : 'rgba(139,92,246,0.04)',
                },
                transition: 'background-color 0.12s ease',
            }}
        >
            {/* Focus marker */}
            <Typography
                sx={{
                    fontSize: '11px',
                    lineHeight: 1,
                    color: theme.palette.primary.main,
                    userSelect: 'none',
                }}
            >
                {isFocused ? '▸' : ''}
            </Typography>

            {/* Metric name */}
            <Typography
                sx={{
                    fontSize: getResponsiveFontSize('xs'),
                    color: isFocused ? theme.palette.text.primary : theme.palette.text.secondary,
                    fontWeight: isFocused ? fontWeight.medium : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    pr: 1,
                }}
            >
                {metric.name}
            </Typography>

            {/* Value */}
            <Typography
                sx={{
                    fontSize: getResponsiveFontSize('sm'),
                    fontWeight: fontWeight.semibold,
                    color: theme.palette.text.primary,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    fontFamily: 'monospace',
                }}
            >
                {metric.displayValue}
            </Typography>

            {/* Delta */}
            <Typography
                sx={{
                    fontSize: getResponsiveFontSize('sm'),
                    fontWeight: fontWeight.medium,
                    color: deltaColors[metric.deltaColor],
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    fontFamily: 'monospace',
                }}
            >
                {metric.displayDelta}
            </Typography>

            {/* Sparkline SVG */}
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <FinancialsSvgSparkline
                    values={metric.sparklineValues}
                    width={68}
                    height={18}
                    color={sparklineColor}
                />
            </Box>

            {/* Min–Max */}
            <Typography
                sx={{
                    fontSize: getResponsiveFontSize('xs'),
                    color: theme.palette.text.disabled,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                }}
            >
                {metric.displayMin}–{metric.displayMax}
            </Typography>
        </Box>
    );
}
