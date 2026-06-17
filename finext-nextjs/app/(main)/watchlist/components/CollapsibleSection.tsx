'use client';

import React, { useEffect, useState } from 'react';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { fontWeight, getResponsiveFontSize } from 'theme/tokens';

interface Props {
    title: string;
    storageKey: string;       // key localStorage để nhớ trạng thái collapse
    defaultOpen?: boolean;
    headerRight?: React.ReactNode;
    children: React.ReactNode;
}

export default function CollapsibleSection({ title, storageKey, defaultOpen = true, headerRight, children }: Props) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [open, setOpen] = useState(defaultOpen);

    // Đọc trạng thái đã lưu SAU khi mount (tránh hydration mismatch giữa server/client)
    useEffect(() => {
        const v = localStorage.getItem(storageKey);
        if (v !== null) setOpen(v === '1');
    }, [storageKey]);

    const toggle = () => {
        setOpen(prev => {
            const next = !prev;
            localStorage.setItem(storageKey, next ? '1' : '0');
            return next;
        });
    };

    const divider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    return (
        <Box sx={{ mb: 2 }}>
            {/* Header — click cả thanh để toggle */}
            <Box
                onClick={toggle}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    py: 0.5,
                    cursor: 'pointer',
                    borderBottom: `1px solid ${divider}`,
                    userSelect: 'none',
                }}
            >
                <IconButton size="small" sx={{ color: 'text.disabled', p: 0.25, flexShrink: 0, '&:hover': { color: 'text.secondary' } }}>
                    {open ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
                </IconButton>
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        fontWeight: fontWeight.bold,
                        color: 'text.primary',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        flex: 1,
                        minWidth: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {title}
                </Typography>
                {headerRight}
            </Box>

            {/* Body */}
            <Box sx={{ display: open ? 'block' : 'none', pt: 1.5 }}>
                {children}
            </Box>
        </Box>
    );
}
