'use client';

import React from 'react';
import { Box, IconButton, Tooltip, useTheme } from '@mui/material';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import { getGlassCard } from 'theme/tokens';

interface PanZoomToggleProps {
    enabled: boolean;
    onClick: () => void;
}

export default function PanZoomToggle({ enabled, onClick }: PanZoomToggleProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const colors = (theme.palette as any).component?.chart;

    const activeColor = colors?.buttonBackgroundActive || theme.palette.primary.main;
    const textColor = colors?.buttonText || theme.palette.text.secondary;

    return (
        <Tooltip title={enabled ? 'Tắt kéo/thu phóng' : 'Bật kéo/thu phóng'} arrow>
            <Box sx={{
                ...(() => {
                    const g = getGlassCard(isDark);
                    return { background: g.background, backdropFilter: g.backdropFilter, WebkitBackdropFilter: g.WebkitBackdropFilter, border: g.border };
                })(),
                borderRadius: 2,
                display: 'flex',
            }}>
                <IconButton
                    onClick={onClick}
                    size="small"
                    disableRipple
                    disableFocusRipple
                    sx={{
                        color: enabled ? activeColor : textColor,
                        backgroundColor: 'transparent !important',
                        borderRadius: 2,
                        height: 34,
                        width: 34,
                    }}
                >
                    <OpenWithIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Box>
        </Tooltip>
    );
}
