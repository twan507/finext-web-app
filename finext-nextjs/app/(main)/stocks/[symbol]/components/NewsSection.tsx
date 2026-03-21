'use client';

import { Box, Typography, useTheme, alpha } from '@mui/material';
import { getResponsiveFontSize, fontWeight, borderRadius, getGlassCard } from 'theme/tokens';

interface NewsSectionProps {
    ticker: string;
}

export default function NewsSection({ ticker }: NewsSectionProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return (
        <Box>
            <Box sx={{
                ...getGlassCard(isDark),
                p: 2,
                borderRadius: `${borderRadius.lg}px`,
            }}>
                <Typography sx={{
                    fontSize: getResponsiveFontSize('lg'),
                    fontWeight: fontWeight.semibold,
                    mb: 2,
                }}>
                    Tin tức
                </Typography>
                <Box sx={{
                    minHeight: 200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                    borderRadius: `${borderRadius.md}px`,
                    py: 6,
                }}>
                    <Typography color="text.secondary">
                        [Tin tức liên quan đến {ticker}]
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
}
