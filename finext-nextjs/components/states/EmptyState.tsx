'use client';

import React from 'react';
import { Box, Typography, Button, useTheme, alpha } from '@mui/material';
import { Icon } from '@iconify/react';
import {
    spacing,
    borderRadius,
    shadows,
    transitions,
    fontSize,
    getResponsiveFontSize,
    iconSize
} from 'theme/tokens';

export interface EmptyStateProps {
    /** Icon to display - can be Iconify icon string or MUI icon element */
    icon?: string | React.ReactNode;
    /** Main title text */
    title: string;
    /** Optional description text */
    description?: string;
    /** Primary action button */
    action?: {
        label: string;
        onClick: () => void;
        variant?: 'contained' | 'outlined' | 'text';
    };
    /** Secondary action button */
    secondaryAction?: {
        label: string;
        onClick: () => void;
    };
    /** Size variant */
    size?: 'small' | 'medium' | 'large';
    /** Custom icon size (overrides size variant) */
    iconSize?: number;
    /** Whether to show a subtle background */
    showBackground?: boolean;
    /** Additional content below actions */
    children?: React.ReactNode;
}

const sizeConfig = {
    small: {
        iconSize: 40,
        titleVariant: 'h6' as const,
        spacing: spacing.md,
        padding: spacing.lg,
    },
    medium: {
        iconSize: 56,
        titleVariant: 'h5' as const,
        spacing: spacing.lg,
        padding: spacing.xl,
    },
    large: {
        iconSize: 72,
        titleVariant: 'h4' as const,
        spacing: spacing.xl,
        padding: spacing.xxl,
    },
};

export default function EmptyState({
    icon,
    title,
    description,
    action,
    secondaryAction,
    size = 'medium',
    iconSize: customIconSize,
    showBackground = false,
    children,
}: EmptyStateProps) {
    const theme = useTheme();
    const config = sizeConfig[size];
    const finalIconSize = customIconSize || config.iconSize;

    const renderIcon = () => {
        if (!icon) return null;

        if (typeof icon === 'string') {
            // Iconify string
            return (
                <Icon
                    icon={icon}
                    width={finalIconSize}
                    height={finalIconSize}
                    style={{ color: theme.palette.text.disabled }}
                />
            );
        }

        // React node (MUI icon or custom)
        return React.cloneElement(icon as React.ReactElement<{ sx?: object }>, {
            sx: {
                fontSize: finalIconSize,
                color: 'text.disabled',
            },
        });
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: config.padding,
                minHeight: 200,
                ...(showBackground && {
                    backgroundColor: alpha(theme.palette.primary.main, 0.02),
                    borderRadius: borderRadius.lg,
                    border: `1px dashed ${alpha(theme.palette.divider, 0.5)}`,
                }),
            }}
        >
            {/* Icon */}
            {icon && (
                <Box
                    sx={{
                        mb: config.spacing / 8, // Convert to MUI spacing units
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: finalIconSize + 24,
                        height: finalIconSize + 24,
                        borderRadius: '50%',
                        backgroundColor: alpha(theme.palette.text.disabled, 0.08),
                    }}
                >
                    {renderIcon()}
                </Box>
            )}

            {/* Title */}
            <Typography
                variant={config.titleVariant}
                sx={{
                    fontWeight: 600,
                    color: 'text.primary',
                    mb: description ? 1 : action ? 2 : 0,
                }}
            >
                {title}
            </Typography>

            {/* Description */}
            {description && (
                <Typography
                    variant="body2"
                    sx={{
                        color: 'text.secondary',
                        maxWidth: 400,
                        mb: action ? 3 : 0,
                        fontSize: getResponsiveFontSize('sm'),
                    }}
                >
                    {description}
                </Typography>
            )}

            {/* Actions */}
            {(action || secondaryAction) && (
                <Box
                    sx={{
                        display: 'flex',
                        gap: spacing.sm / 8,
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                    }}
                >
                    {action && (
                        <Button
                            variant={action.variant || 'contained'}
                            onClick={action.onClick}
                            sx={{
                                transition: transitions.button,
                            }}
                        >
                            {action.label}
                        </Button>
                    )}
                    {secondaryAction && (
                        <Button
                            variant="text"
                            onClick={secondaryAction.onClick}
                            sx={{
                                color: 'text.secondary',
                                transition: transitions.button,
                                '&:hover': {
                                    color: 'primary.main',
                                },
                            }}
                        >
                            {secondaryAction.label}
                        </Button>
                    )}
                </Box>
            )}

            {/* Additional content */}
            {children && (
                <Box sx={{ mt: config.spacing / 8 }}>
                    {children}
                </Box>
            )}
        </Box>
    );
}
