'use client';

import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

export default function WatchlistPanel() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    return (
        <Box
            sx={{
                width: 300,
                height: '100%',
                borderLeft: 1,
                borderColor: 'divider',
                backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(8px)',
                p: 2,
                overflowY: 'auto',
            }}
        >
            <Typography
                sx={{
                    fontSize: getResponsiveFontSize('md'),
                    fontWeight: fontWeight.semibold,
                    color: 'text.primary',
                    mb: 2,
                }}
            >
                Watchlist
            </Typography>
            <Typography
                sx={{
                    fontSize: getResponsiveFontSize('sm'),
                    color: 'text.secondary',
                }}
            >
                Nội dung đang được phát triển...
            </Typography>
        </Box>
    );
}
