'use client';

import React from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    LinearProgress,
    Skeleton,
    useTheme,
    alpha,
} from '@mui/material';
import {
    spacing,
    borderRadius,
    transitions,
    getResponsiveFontSize,
} from 'theme/tokens';

export type LoadingVariant =
    | 'spinner'    // Circular spinner (default)
    | 'linear'     // Linear progress bar
    | 'skeleton'   // Skeleton placeholder
    | 'dots'       // Animated dots
    | 'pulse';     // Pulsing effect

export interface LoadingStateProps {
    /** Loading variant */
    variant?: LoadingVariant;
    /** Loading message */
    message?: string;
    /** Size variant */
    size?: 'small' | 'medium' | 'large';
    /** Show overlay background */
    overlay?: boolean;
    /** Whether loading is determinate (shows progress) */
    progress?: number;
    /** Full screen loading */
    fullScreen?: boolean;
    /** Inline loading (no centering) */
    inline?: boolean;
    /** Custom height for skeleton */
    skeletonHeight?: number | string;
    /** Number of skeleton lines */
    skeletonLines?: number;
    /** Custom spinner color */
    color?: 'primary' | 'secondary' | 'inherit';
}

const sizeConfig = {
    small: {
        spinnerSize: 24,
        dotSize: 6,
        spacing: spacing.sm,
    },
    medium: {
        spinnerSize: 40,
        dotSize: 8,
        spacing: spacing.md,
    },
    large: {
        spinnerSize: 56,
        dotSize: 10,
        spacing: spacing.lg,
    },
};

// Animated dots component
function AnimatedDots({ size, color }: { size: number; color: string }) {
    return (
        <Box
            sx={{
                display: 'flex',
                gap: size / 2,
                '& > span': {
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    backgroundColor: color,
                    animation: 'dotPulse 1.4s ease-in-out infinite both',
                    '&:nth-of-type(1)': { animationDelay: '-0.32s' },
                    '&:nth-of-type(2)': { animationDelay: '-0.16s' },
                    '&:nth-of-type(3)': { animationDelay: '0s' },
                },
                '@keyframes dotPulse': {
                    '0%, 80%, 100%': {
                        transform: 'scale(0)',
                        opacity: 0.5,
                    },
                    '40%': {
                        transform: 'scale(1)',
                        opacity: 1,
                    },
                },
            }}
        >
            <span />
            <span />
            <span />
        </Box>
    );
}

// Pulse effect component
function PulseEffect({ size }: { size: number }) {
    const theme = useTheme();
    return (
        <Box
            sx={{
                position: 'relative',
                width: size,
                height: size,
                '& > span': {
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    backgroundColor: theme.palette.primary.main,
                    animation: 'pulseRing 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    '&:nth-of-type(2)': { animationDelay: '0.5s' },
                },
                '@keyframes pulseRing': {
                    '0%': {
                        transform: 'scale(0.5)',
                        opacity: 0.8,
                    },
                    '100%': {
                        transform: 'scale(1.5)',
                        opacity: 0,
                    },
                },
            }}
        >
            <span />
            <span />
            <Box
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: size * 0.4,
                    height: size * 0.4,
                    borderRadius: '50%',
                    backgroundColor: theme.palette.primary.main,
                }}
            />
        </Box>
    );
}

// Skeleton lines component
function SkeletonLines({
    lines,
    height,
}: {
    lines: number;
    height: number | string;
}) {
    return (
        <Box sx={{ width: '100%' }}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    variant="rectangular"
                    height={height}
                    sx={{
                        mb: i < lines - 1 ? 1 : 0,
                        borderRadius: borderRadius.sm,
                        // Last line is shorter
                        width: i === lines - 1 ? '60%' : '100%',
                    }}
                />
            ))}
        </Box>
    );
}

export default function LoadingState({
    variant = 'spinner',
    message,
    size = 'medium',
    overlay = false,
    progress,
    fullScreen = false,
    inline = false,
    skeletonHeight = 20,
    skeletonLines = 3,
    color = 'primary',
}: LoadingStateProps) {
    const theme = useTheme();
    const config = sizeConfig[size];
    const isDeterminate = progress !== undefined;

    const renderLoader = () => {
        switch (variant) {
            case 'linear':
                return (
                    <Box sx={{ width: '100%', maxWidth: 300 }}>
                        <LinearProgress
                            variant={isDeterminate ? 'determinate' : 'indeterminate'}
                            value={progress}
                            color={color}
                            sx={{ borderRadius: borderRadius.full }}
                        />
                        {isDeterminate && (
                            <Typography
                                variant="caption"
                                sx={{
                                    display: 'block',
                                    textAlign: 'center',
                                    mt: 1,
                                    color: 'text.secondary',
                                }}
                            >
                                {Math.round(progress)}%
                            </Typography>
                        )}
                    </Box>
                );

            case 'skeleton':
                return (
                    <SkeletonLines lines={skeletonLines} height={skeletonHeight} />
                );

            case 'dots':
                return (
                    <AnimatedDots
                        size={config.dotSize}
                        color={theme.palette.primary.main}
                    />
                );

            case 'pulse':
                return <PulseEffect size={config.spinnerSize} />;

            case 'spinner':
            default:
                return (
                    <CircularProgress
                        size={config.spinnerSize}
                        color={color}
                        variant={isDeterminate ? 'determinate' : 'indeterminate'}
                        value={progress}
                    />
                );
        }
    };

    const content = (
        <Box
            sx={{
                display: 'flex',
                flexDirection: inline ? 'row' : 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: config.spacing / 8,
                ...(variant === 'skeleton' && { width: '100%' }),
            }}
        >
            {renderLoader()}
            {message && variant !== 'skeleton' && (
                <Typography
                    variant="body2"
                    sx={{
                        color: 'text.secondary',
                        fontSize: getResponsiveFontSize('sm'),
                        ...(inline && { ml: 1 }),
                    }}
                >
                    {message}
                </Typography>
            )}
        </Box>
    );

    // Full screen loading
    if (fullScreen) {
        return (
            <Box
                sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: overlay
                        ? alpha(theme.palette.background.default, 0.9)
                        : theme.palette.background.default,
                    zIndex: theme.zIndex.modal + 1,
                    backdropFilter: overlay ? 'blur(4px)' : 'none',
                }}
            >
                {content}
            </Box>
        );
    }

    // Overlay loading
    if (overlay) {
        return (
            <Box
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: alpha(theme.palette.background.default, 0.8),
                    backdropFilter: 'blur(2px)',
                    borderRadius: 'inherit',
                    zIndex: 1,
                }}
            >
                {content}
            </Box>
        );
    }

    // Inline loading
    if (inline) {
        return content;
    }

    // Centered loading (default)
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: variant === 'skeleton' ? 'auto' : 200,
                width: '100%',
                padding: config.spacing,
            }}
        >
            {content}
        </Box>
    );
}
