'use client';

import { Box, Divider, Typography, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import StockFinancialsMetricRow from './StockFinancialsMetricRow';
import type { ProcessedMetric } from './stock-financials-config';

interface Props {
    title: string;
    metrics: ProcessedMetric[];
    focusedKey: string;
    onFocusChange: (key: string) => void;
    mode: 'Q' | 'Y';
}

export default function StockFinancialsMetricSection({ title, metrics, focusedKey, onFocusChange, mode }: Props) {
    const theme = useTheme();
    const deltaLabel = mode === 'Q' ? 'Δ QoQ' : 'Δ YoY';

    return (
        <Box sx={{ mb: 2.5 }}>
            <Typography sx={{
                fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold,
                color: theme.palette.text.secondary, letterSpacing: '0.08em', textTransform: 'uppercase',
                mb: 0.5, pl: 0.5,
            }}>
                {title}
            </Typography>

            <Divider sx={{ mb: 0.25, opacity: 0.3 }} />

            {/* Column headers */}
            <Box sx={{
                display: 'grid', gridTemplateColumns: '16px 1fr repeat(4, minmax(min-content, 150px))',
                columnGap: 1, alignItems: 'center', px: 0.5, pb: 0.5,
            }}>
                <Box />
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: theme.palette.text.disabled }}>Chỉ số</Typography>
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: theme.palette.text.disabled, textAlign: 'right' }}>Giá trị</Typography>
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: theme.palette.text.disabled, textAlign: 'right' }}>{deltaLabel}</Typography>
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: theme.palette.text.disabled, textAlign: 'right' }}>Xu hướng</Typography>
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: theme.palette.text.disabled, textAlign: 'right' }}>Min / Max</Typography>
            </Box>

            {metrics.map((metric) => (
                <StockFinancialsMetricRow
                    key={metric.key}
                    metric={metric}
                    isFocused={metric.key === focusedKey}
                    onFocus={() => onFocusChange(metric.key)}
                />
            ))}
        </Box>
    );
}
