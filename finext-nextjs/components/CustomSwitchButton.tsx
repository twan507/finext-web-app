'use client';

import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';

interface CustomSwitchButtonProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    description?: string;
    disabled?: boolean;
    icon?: React.ReactNode;
    variant?: 'default' | 'card' | 'unified';
    size?: 'small' | 'medium' | 'large';
    onClick?: () => void;
    // New styling props
    showIcon?: boolean;
    fullWidth?: boolean;
    borderRadius?: number;
    padding?: number | string;
    backgroundColor?: 'transparent' | 'subtle' | 'elevated';
    borderStyle?: 'none' | 'subtle' | 'prominent';
}

const CustomSwitchButton: React.FC<CustomSwitchButtonProps> = ({
    checked,
    onChange,
    label,
    description,
    disabled = false,
    icon,
    variant = 'default',
    size = 'medium',
    onClick,
    showIcon = true,
    fullWidth = false,
    borderRadius = 2,
    padding,
    backgroundColor = 'subtle',
    borderStyle = 'subtle'
}) => {
    const theme = useTheme();

    const handleClick = () => {
        if (disabled) return;
        if (onClick) {
            onClick();
        } else {
            onChange(!checked);
        }
    };    // Size configurations
    const sizeConfig = {
        small: {
            switchWidth: 40,
            switchHeight: 20,
            thumbSize: 16,
            thumbOffset: 2,
            thumbActivePos: 22,
            padding: padding || 1,
            iconSize: 36, // Tăng kích thước container để có thêm padding
            labelVariant: 'body2' as const,
            descriptionVariant: 'caption' as const
        },
        medium: {
            switchWidth: 44,
            switchHeight: 22,
            thumbSize: 18,
            thumbOffset: 2,
            thumbActivePos: 24,
            padding: padding || 1.5,
            iconSize: 40, // Tăng kích thước container
            labelVariant: 'body1' as const,
            descriptionVariant: 'body2' as const
        },
        large: {
            switchWidth: 48,
            switchHeight: 24,
            thumbSize: 20,
            thumbOffset: 2,
            thumbActivePos: 26,
            padding: padding || 2,
            iconSize: 44, // Tăng kích thước container
            labelVariant: 'h6' as const,
            descriptionVariant: 'body2' as const
        }
    };

    const config = sizeConfig[size];

    // Background color configurations
    const getBgColor = (isChecked: boolean, bgType: typeof backgroundColor) => {
        if (bgType === 'transparent') return 'transparent';

        if (bgType === 'elevated') {
            return isChecked
                ? (theme.palette.mode === 'dark'
                    ? 'rgba(144, 202, 249, 0.20)'
                    : 'rgba(25, 118, 210, 0.12)')
                : (theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.04)');
        }

        // subtle (default)
        return isChecked
            ? (theme.palette.mode === 'dark'
                ? 'rgba(144, 202, 249, 0.16)'
                : 'rgba(25, 118, 210, 0.08)')
            : (theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(0, 0, 0, 0.02)');
    };

    // Border configurations
    const getBorderStyle = (isChecked: boolean, style: typeof borderStyle) => {
        if (style === 'none') return 'none';

        const borderWidth = style === 'prominent' ? '2px' : '1px';
        const borderColor = isChecked
            ? theme.palette.primary.main
            : (theme.palette.mode === 'dark'
                ? (style === 'prominent' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.08)')
                : (style === 'prominent' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(0, 0, 0, 0.08)'));

        return `${borderWidth} solid ${borderColor}`;
    };

    // Hover effects
    const getHoverBgColor = (isChecked: boolean, bgType: typeof backgroundColor) => {
        if (bgType === 'transparent') {
            return theme.palette.action.hover;
        }

        if (bgType === 'elevated') {
            return isChecked
                ? (theme.palette.mode === 'dark'
                    ? 'rgba(144, 202, 249, 0.28)'
                    : 'rgba(25, 118, 210, 0.16)')
                : (theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'rgba(0, 0, 0, 0.06)');
        }

        return isChecked
            ? (theme.palette.mode === 'dark'
                ? 'rgba(144, 202, 249, 0.24)'
                : 'rgba(25, 118, 210, 0.12)')
            : (theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(0, 0, 0, 0.04)');
    };

    const getHoverBorderColor = (isChecked: boolean, style: typeof borderStyle) => {
        if (style === 'none') return 'transparent';

        return isChecked
            ? theme.palette.primary.main
            : (theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.2)'
                : 'rgba(0, 0, 0, 0.2)');
    };

    // Icon color configurations - UPDATED to fix the gray color issue
    const getIconColors = (isChecked: boolean, bgType: typeof backgroundColor) => {
        if (isChecked) {
            return {
                bgColor: theme.palette.primary.main,
                iconColor: theme.palette.primary.contrastText
            };
        } else {
            // When unchecked, use gray colors
            return {
                bgColor: backgroundColor === 'transparent'
                    ? (theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.12)'
                        : 'rgba(0, 0, 0, 0.12)')
                    : (theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.08)'),
                iconColor: theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.5)'
                    : 'rgba(0, 0, 0, 0.5)'
            };
        }
    };

    // Common switch indicator
    const switchIndicator = (
        <Box
            sx={{
                position: 'relative',
                width: config.switchWidth,
                height: config.switchHeight,
                borderRadius: config.switchHeight / 2,
                bgcolor: checked
                    ? theme.palette.primary.main
                    : (theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.2)'
                        : 'rgba(0, 0, 0, 0.2)'),
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: config.thumbOffset,
                    left: checked ? config.thumbActivePos : config.thumbOffset,
                    width: config.thumbSize,
                    height: config.thumbSize,
                    borderRadius: '50%',
                    bgcolor: 'white',
                    boxShadow: theme.palette.mode === 'dark'
                        ? '0 2px 4px rgba(0, 0, 0, 0.5)'
                        : '0 2px 4px rgba(0, 0, 0, 0.2)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }
            }}
        />
    );

    // Unified variant (same style for both activation and features)
    if (variant === 'unified') {
        const iconColors = getIconColors(checked, backgroundColor);

        return (
            <Box
                onClick={handleClick}
                sx={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: showIcon && icon ? 2 : 1,
                    p: config.padding,
                    borderRadius: borderRadius,
                    bgcolor: getBgColor(checked, backgroundColor),
                    border: getBorderStyle(checked, borderStyle),
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    width: fullWidth ? '100%' : 'auto',
                    '&:hover': !disabled ? {
                        bgcolor: getHoverBgColor(checked, backgroundColor),
                        borderColor: getHoverBorderColor(checked, borderStyle),
                        transform: backgroundColor !== 'transparent' ? 'translateY(-1px)' : 'none',
                        boxShadow: backgroundColor !== 'transparent'
                            ? (theme.palette.mode === 'dark'
                                ? '0 4px 12px rgba(0, 0, 0, 0.4)'
                                : '0 4px 12px rgba(0, 0, 0, 0.1)')
                            : 'none',
                    } : {},
                    '&:active': !disabled ? {
                        transform: 'translateY(0px)',
                        boxShadow: backgroundColor !== 'transparent'
                            ? (theme.palette.mode === 'dark'
                                ? '0 2px 6px rgba(0, 0, 0, 0.4)'
                                : '0 2px 6px rgba(0, 0, 0, 0.1)')
                            : 'none',
                    } : {},
                    opacity: disabled ? 0.6 : 1,
                }}
            >
                {/* Icon (optional) */}
                {showIcon && icon && (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: config.iconSize,
                            height: config.iconSize,
                            borderRadius: '50%',
                            bgcolor: iconColors.bgColor,
                            color: iconColors.iconColor,
                            transition: 'all 0.2s ease-in-out',
                        }}
                    >
                        {icon}
                    </Box>
                )}

                {/* Content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>                    {label && (
                    <Typography
                        variant={config.labelVariant}
                        fontWeight={checked ? "600" : "500"}
                        sx={{
                            color: checked
                                ? theme.palette.primary.main
                                : 'text.primary',
                            transition: 'color 0.2s ease'
                        }}
                    >
                        {label}
                    </Typography>
                )}
                    {description && (
                        <Typography
                            variant={config.descriptionVariant}
                            sx={{
                                color: checked
                                    ? theme.palette.primary.main
                                    : 'text.secondary',
                                transition: 'color 0.2s ease',
                                opacity: 0.8,
                                mt: label ? 0.5 : 0
                            }}
                        >
                            {description}
                        </Typography>
                    )}
                </Box>

                {/* Switch indicator */}
                {switchIndicator}
            </Box>
        );
    }

    // Legacy variants for backward compatibility
    if (variant === 'card') {
        return (
            <Box
                onClick={handleClick}
                sx={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: config.padding,
                    borderRadius: borderRadius,
                    bgcolor: getBgColor(checked, backgroundColor),
                    border: getBorderStyle(checked, borderStyle),
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': !disabled ? {
                        bgcolor: getHoverBgColor(checked, backgroundColor),
                        borderColor: getHoverBorderColor(checked, borderStyle),
                        transform: 'translateY(-1px)',
                        boxShadow: theme.palette.mode === 'dark'
                            ? '0 4px 12px rgba(0, 0, 0, 0.4)'
                            : '0 4px 12px rgba(0, 0, 0, 0.1)',
                    } : {},
                    '&:active': !disabled ? {
                        transform: 'translateY(0px)',
                        boxShadow: theme.palette.mode === 'dark'
                            ? '0 2px 6px rgba(0, 0, 0, 0.4)'
                            : '0 2px 6px rgba(0, 0, 0, 0.1)',
                    } : {},
                    opacity: disabled ? 0.6 : 1,
                }}
            >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    {label && (
                        <Typography
                            variant={config.labelVariant}
                            fontWeight={checked ? "600" : "500"}
                            noWrap
                            sx={{
                                color: checked
                                    ? theme.palette.primary.main
                                    : 'text.primary',
                                transition: 'color 0.2s ease'
                            }}
                        >
                            {label}
                        </Typography>
                    )}
                    {description && (
                        <Typography
                            variant={config.descriptionVariant}
                            noWrap
                            sx={{
                                color: checked
                                    ? theme.palette.primary.main
                                    : 'text.secondary',
                                transition: 'color 0.2s ease',
                                opacity: 0.8
                            }}
                        >
                            {description}
                        </Typography>
                    )}
                </Box>
                {switchIndicator}
            </Box>
        );
    }

    // Default variant
    const iconColors = getIconColors(checked, backgroundColor);

    return (
        <Box
            onClick={handleClick}
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: config.padding,
                borderRadius: borderRadius,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                    bgcolor: theme.palette.action.hover,
                },
                opacity: disabled ? 0.6 : 1,
            }}
        >
            {showIcon && icon && (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: config.iconSize,
                        height: config.iconSize,
                        borderRadius: '50%',
                        bgcolor: iconColors.bgColor,
                        color: iconColors.iconColor,
                        transition: 'all 0.2s ease-in-out',
                    }}
                >
                    {icon}
                </Box>
            )}

            <Box sx={{ flex: 1 }}>
                {label && (
                    <Typography
                        variant={config.labelVariant}
                        fontWeight="medium"
                        sx={{
                            color: checked
                                ? theme.palette.primary.main
                                : 'text.primary',
                            transition: 'color 0.2s ease',
                        }}
                    >
                        {label}
                    </Typography>
                )}
                {description && (
                    <Typography
                        variant={config.descriptionVariant}
                        sx={{
                            color: 'text.secondary',
                            mt: 0.5,
                        }}
                    >
                        {description}
                    </Typography>
                )}
            </Box>

            {switchIndicator}
        </Box>
    );
};

export default CustomSwitchButton;
