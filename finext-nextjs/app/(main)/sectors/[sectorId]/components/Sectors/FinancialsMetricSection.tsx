'use client';

import { Box, Divider, Typography, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import FinancialsMetricRow from './FinancialsMetricRow';
import { FINANCIALS_GRID_COLUMNS, FINANCIALS_GRID_MIN_WIDTH, type ProcessedMetric } from './financials-config';

interface FinancialsMetricSectionProps {
    title: string;
    metrics: ProcessedMetric[];
    focusedKey: string;
    onFocusChange: (key: string) => void;
    mode: 'Q' | 'Y';
}

export default function FinancialsMetricSection({
    title,
    metrics,
    focusedKey,
    onFocusChange,
    mode,
}: FinancialsMetricSectionProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const deltaLabel = mode === 'Q' ? 'Δ QoQ' : 'Δ YoY';

    return (
        <Box sx={{ mb: 2.5 }}>
            {/* Section title */}
            <Typography
                sx={{
                    fontSize: getResponsiveFontSize('xs'),
                    fontWeight: fontWeight.semibold,
                    color: theme.palette.text.secondary,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    mb: 0.5,
                    pl: 0.5,
                }}
            >
                {title}
            </Typography>

            <Divider sx={{ mb: 0.25, opacity: 0.3 }} />

            {/* Chạm min-width → trượt ngang (header + rows cuộn cùng nhau) */}
            <Box
                sx={{
                    overflowX: 'auto',
                    '&::-webkit-scrollbar': { height: 6 },
                    '&::-webkit-scrollbar-track': { background: 'transparent' },
                    '&::-webkit-scrollbar-thumb': { background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)', borderRadius: 3 },
                    '&::-webkit-scrollbar-thumb:hover': { background: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' },
                }}
            >
                <Box sx={{ minWidth: FINANCIALS_GRID_MIN_WIDTH }}>
                    {/* Column headers */}
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: FINANCIALS_GRID_COLUMNS,
                            columnGap: 1,
                            alignItems: 'center',
                            px: 0.5,
                            pb: 0.5,
                        }}
                    >
                        <Box />
                        <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: theme.palette.text.disabled }}>Chỉ số</Typography>
                        <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: theme.palette.text.disabled, textAlign: 'right' }}>Giá trị</Typography>
                        <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: theme.palette.text.disabled, textAlign: 'right' }}>{deltaLabel}</Typography>
                        <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: theme.palette.text.disabled, textAlign: 'right' }}>Xu hướng</Typography>
                        <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: theme.palette.text.disabled, textAlign: 'right' }}>Min / Max</Typography>
                    </Box>

                    {/* Rows */}
                    {metrics.map((metric) => (
                        <FinancialsMetricRow
                            key={metric.key}
                            metric={metric}
                            isFocused={metric.key === focusedKey}
                            onFocus={() => onFocusChange(metric.key)}
                        />
                    ))}
                </Box>
            </Box>
        </Box>
    );
}
