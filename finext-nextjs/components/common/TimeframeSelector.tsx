'use client';

import React from 'react';
import { ToggleButton, ToggleButtonGroup, SxProps, Theme, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize, getGlassCard } from 'theme/tokens';

// Export common TimeRange type for convenience, though component is now generic

interface TimeframeSelectorProps<T extends string> {
    value: T;
    onChange: (event: React.MouseEvent<HTMLElement>, newRange: T | null) => void;
    options: T[];
    getLabel?: (option: T) => React.ReactNode;
    sx?: SxProps<Theme>;
}

export default function TimeframeSelector<T extends string>({
    value,
    onChange,
    options,
    getLabel,
    sx
}: TimeframeSelectorProps<T>) {
    const theme = useTheme();

    const isDark = theme.palette.mode === 'dark';
    const glassStyles = getGlassCard(isDark);

    return (
        <ToggleButtonGroup
            value={value}
            exclusive
            onChange={onChange}
            size="small"
            sx={{
                display: 'flex',
                flexWrap: 'wrap',
                background: glassStyles.background,
                backdropFilter: glassStyles.backdropFilter,
                WebkitBackdropFilter: glassStyles.WebkitBackdropFilter,
                border: glassStyles.border,
                borderRadius: 2,
                overflow: 'hidden',
                // Remove all internal MUI borders and dividers
                '& .MuiToggleButtonGroup-grouped': {
                    border: 'none !important',
                    margin: '0 !important',
                    '&:not(:first-of-type)': {
                        borderLeft: 'none !important',
                        marginLeft: '0 !important',
                    },
                },
                '& .MuiToggleButton-root': {
                    color: (theme.palette as any).component?.chart?.buttonText || theme.palette.text.secondary,
                    border: 'none',
                    height: 34,
                    px: { xs: 1, sm: 1.5 },
                    fontSize: getResponsiveFontSize('sm'),
                    backgroundColor: 'transparent',
                    position: 'relative',
                    borderRadius: '0 !important',
                    transition: 'color 0.2s',
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        bottom: 4,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '60%',
                        height: '2px',
                        backgroundColor: 'transparent',
                        borderRadius: '1px',
                        transition: 'background-color 0.2s',
                    },
                    '&:hover': {
                        backgroundColor: 'transparent',
                    },
                    '&.Mui-selected': {
                        backgroundColor: 'transparent',
                        color: (theme.palette as any).component?.chart?.buttonBackgroundActive || theme.palette.primary.main,
                        '&::after': {
                            backgroundColor: (theme.palette as any).component?.chart?.buttonBackgroundActive || theme.palette.primary.main,
                        },
                        '&:hover': {
                            backgroundColor: 'transparent',
                        },
                    },
                },
                ...sx
            }}
        >
            {options.map((option) => (
                <ToggleButton key={option} value={option}>
                    {getLabel ? getLabel(option) : option}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}
