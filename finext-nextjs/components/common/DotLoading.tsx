'use client';

import React from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';

interface DotLoadingProps {
    /** Dot size in px (default: 7) */
    size?: number;
    /** Gap between dots in px (default: 6) */
    gap?: number;
    /** Custom color — defaults to primary.main */
    color?: string;
    /** Container sx overrides */
    sx?: SxProps<Theme>;
}

export default function DotLoading({ size = 7, gap = 6, color, sx }: DotLoadingProps) {
    return (
        <Box
            sx={{
                display: 'flex',
                gap: `${gap}px`,
                '& > span': {
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    bgcolor: color ?? 'primary.main',
                    animation: 'dotBounce 1.4s ease-in-out infinite both',
                },
                '& > span:nth-of-type(1)': { animationDelay: '-0.32s' },
                '& > span:nth-of-type(2)': { animationDelay: '-0.16s' },
                '& > span:nth-of-type(3)': { animationDelay: '0s' },
                '& > span:nth-of-type(4)': { animationDelay: '0.16s' },
                '@keyframes dotBounce': {
                    '0%, 80%, 100%': { transform: 'scale(0.4)', opacity: 0.4 },
                    '40%': { transform: 'scale(1)', opacity: 1 },
                },
                ...sx,
            }}
        >
            <span />
            <span />
            <span />
            <span />
        </Box>
    );
}
