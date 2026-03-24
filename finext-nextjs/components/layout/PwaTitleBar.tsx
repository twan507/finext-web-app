'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { ArrowBack, Refresh } from '@mui/icons-material';

export default function PwaTitleBar() {
    const theme = useTheme();
    const router = useRouter();
    const [isWCOVisible, setIsWCOVisible] = useState(false);
    const [canGoBack, setCanGoBack] = useState(false);
    const [pageTitle, setPageTitle] = useState('');

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
        setCanGoBack(window.history.length > 1);
    }, []);

    useEffect(() => {
        const readTitle = () => {
            let title = document.title;
            if (title.endsWith(' | Finext')) title = title.slice(0, -' | Finext'.length);
            setPageTitle(title);
        };

        readTitle();

        const titleEl = document.querySelector('title');
        const observer = new MutationObserver(readTitle);
        if (titleEl) observer.observe(titleEl, { childList: true, subtree: true, characterData: true });

        return () => observer.disconnect();
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
                backgroundColor: theme.palette.component.appBar.background,
                WebkitAppRegion: 'drag',
                userSelect: 'none',
            } as React.CSSProperties & { WebkitAppRegion: string }}
        >
            {/* Left: logo + navigation buttons - no-drag zone */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.25,
                    px: 0.75,
                    WebkitAppRegion: 'no-drag',
                } as React.CSSProperties & { WebkitAppRegion: string }}
            >
                <Image
                    src="/finext-icon-color.png"
                    alt="Finext"
                    width={20}
                    height={20}
                    style={{ borderRadius: 4 }}
                />
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

            {/* Center: page title - drag region */}
            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {pageTitle && (
                    <Typography
                        variant="caption"
                        sx={{
                            fontWeight: 600,
                            color: theme.palette.text.secondary,
                            fontSize: '12px',
                            letterSpacing: '0.02em',
                        }}
                    >
                        {pageTitle}
                    </Typography>
                )}
            </Box>

            {/* Right: spacer to balance left side */}
            <Box sx={{ width: 80 }} />
        </Box>
    );
}
