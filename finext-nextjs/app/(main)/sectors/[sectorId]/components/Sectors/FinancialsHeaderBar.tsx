'use client';

import { Box, Typography, useTheme, alpha } from '@mui/material';
import { getResponsiveFontSize, fontWeight, transitions } from 'theme/tokens';
import { formatPeriodLabel } from './financials-config';

interface FinancialsHeaderBarProps {
    industryName: string;
    period: string;
    mode: 'Q' | 'Y';
    onModeChange: (mode: 'Q' | 'Y') => void;
}

export default function FinancialsHeaderBar({
    industryName,
    period,
    mode,
    onModeChange,
}: FinancialsHeaderBarProps) {
    const theme = useTheme();

    const periodDisplay = period ? formatPeriodLabel(period) : '—';

    return (
        <Box sx={{ mb: 2.5 }}>
            {/* Row 1: title + Y/Q toggle */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('lg'),
                        fontWeight: fontWeight.semibold,
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                    }}
                >
                    Chỉ số tài chính ngành {industryName}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {(['Q', 'Y'] as const).map((m) => (
                        <Box
                            key={m}
                            component="button"
                            onClick={() => onModeChange(m)}
                            sx={{
                                px: 1.25,
                                py: 0.375,
                                fontSize: getResponsiveFontSize('xs'),
                                fontWeight: fontWeight.semibold,
                                fontFamily: 'inherit',
                                cursor: 'pointer',
                                border: '1px solid',
                                borderColor: mode === m
                                    ? theme.palette.primary.main
                                    : alpha(theme.palette.divider, 0.5),
                                borderRadius: '4px',
                                bgcolor: mode === m
                                    ? alpha(theme.palette.primary.main, 0.12)
                                    : 'transparent',
                                color: mode === m
                                    ? theme.palette.primary.main
                                    : theme.palette.text.secondary,
                                transition: transitions.colors,
                                '&:hover': {
                                    borderColor: theme.palette.primary.main,
                                    color: theme.palette.primary.main,
                                },
                            }}
                        >
                            {m === 'Q' ? 'Quý' : 'Năm'}
                        </Box>
                    ))}
                </Box>
            </Box>

            {/* Row 2: period */}
            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', mt: 0.5 }}>
                Kỳ: {periodDisplay}
            </Typography>
        </Box>
    );
}
