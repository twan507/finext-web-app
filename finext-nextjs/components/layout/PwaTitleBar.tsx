'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { ArrowBack, Refresh } from '@mui/icons-material';

export default function PwaTitleBar() {
    const theme = useTheme();
    const router = useRouter();
    const [isWCOVisible, setIsWCOVisible] = useState(false);
    const [canGoBack, setCanGoBack] = useState(false);

    useEffect(() => {
        const wco = (navigator as Navigator & { windowControlsOverlay?: { visible: boolean; addEventListener: (event: string, cb: () => void) => void } }).windowControlsOverlay;

        if (!wco) return;

        const update = () => {
            setIsWCOVisible(wco.visible);
        };

        update();
        wco.addEventListener('geometrychange', update);
    }, []);

    useEffect(() => {
        // history.length > 1 means there's something to go back to
        setCanGoBack(window.history.length > 1);
    }, []);

    if (!isWCOVisible) return null;

    return (
        <Box
            sx={{
                position: 'fixed',
                top: 'env(titlebar-area-y, 0px)',
                left: 'env(titlebar-area-x, 0px)',
                width: 'env(titlebar-area-width, 100%)',
                height: 'env(titlebar-area-height, 33px)',
                display: 'flex',
                alignItems: 'center',
                zIndex: theme.zIndex.modal + 10,
                bgcolor: theme.palette.background.paper,
                WebkitAppRegion: 'drag',
                userSelect: 'none',
            } as React.CSSProperties & { WebkitAppRegion: string }}
        >
            {/* Left: navigation buttons - no-drag zone */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.25,
                    px: 0.5,
                    WebkitAppRegion: 'no-drag',
                } as React.CSSProperties & { WebkitAppRegion: string }}
            >
                <IconButton
                    size="small"
                    onClick={() => router.back()}
                    disabled={!canGoBack}
                    sx={{
                        width: 28,
                        height: 28,
                        color: canGoBack ? theme.palette.text.primary : theme.palette.text.disabled,
                        '&:hover': { bgcolor: theme.palette.action.hover },
                    }}
                >
                    <ArrowBack sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton
                    size="small"
                    onClick={() => window.location.reload()}
                    sx={{
                        width: 28,
                        height: 28,
                        color: theme.palette.text.primary,
                        '&:hover': { bgcolor: theme.palette.action.hover },
                    }}
                >
                    <Refresh sx={{ fontSize: 16 }} />
                </IconButton>
            </Box>

            {/* Center: app title - drag region */}
            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Typography
                    variant="caption"
                    sx={{
                        fontWeight: 600,
                        color: theme.palette.text.secondary,
                        fontSize: '12px',
                        letterSpacing: '0.02em',
                    }}
                >
                    Finext
                </Typography>
            </Box>

            {/* Right: spacer to balance left buttons */}
            <Box sx={{ width: 68 }} />
        </Box>
    );
}
