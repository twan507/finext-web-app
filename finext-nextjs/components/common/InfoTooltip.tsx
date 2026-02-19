'use client';

import React from 'react';
import { Tooltip as MuiTooltip, Typography, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';

interface InfoTooltipProps {
    /** Nội dung hiển thị khi hover */
    title: string;
    /** Element trigger (mặc định là icon ⓘ) */
    children?: React.ReactElement;
    /** Vị trí tooltip */
    placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
    /** Max width tooltip */
    maxWidth?: number;
}

/**
 * Custom tooltip component không viền, nền solid, đồng bộ design tokens.
 * Mặc định render icon ⓘ làm trigger.
 *
 * @example
 * <InfoTooltip title="Giải thích chi tiết..." />
 * <InfoTooltip title="Custom trigger" placement="bottom">
 *   <IconButton><HelpIcon /></IconButton>
 * </InfoTooltip>
 */
export default function InfoTooltip({
    title,
    children,
    placement = 'top',
    maxWidth = 240,
}: InfoTooltipProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const defaultTrigger = (
        <Typography
            component="span"
            sx={{
                fontSize: getResponsiveFontSize('xxs'),
                color: theme.palette.text.disabled,
                lineHeight: 1,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                transition: 'color 0.15s ease',
                '&:hover': {
                    color: theme.palette.primary.main,
                },
            }}
        >
            ⓘ
        </Typography>
    );

    return (
        <MuiTooltip
            title={title}
            placement={placement}
            arrow={false}
            enterDelay={200}
            leaveDelay={100}
            slotProps={{
                tooltip: {
                    sx: {
                        bgcolor: isDark ? 'rgba(30, 30, 35, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        color: theme.palette.text.primary,
                        fontSize: getResponsiveFontSize('xs'),
                        fontWeight: fontWeight.medium,
                        lineHeight: 1.5,
                        px: 1.5,
                        py: 1,
                        maxWidth,
                        borderRadius: `${borderRadius.sm}px`,
                        border: 'none',
                        boxShadow: isDark
                            ? '0 4px 16px rgba(0, 0, 0, 0.5)'
                            : '0 4px 16px rgba(0, 0, 0, 0.12)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                    },
                },
            }}
        >
            {children || defaultTrigger}
        </MuiTooltip>
    );
}
