// finext-nextjs/app/admin/promotions/components/ModernSwitch.tsx
'use client';

import React from 'react';
import { Box, Typography, Switch, useTheme } from '@mui/material';
import { colorTokens } from 'theme/tokens';

interface ModernSwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description?: string;
    disabled?: boolean;
    icon?: React.ReactNode;
}

const ModernSwitch: React.FC<ModernSwitchProps> = ({
    checked,
    onChange,
    label,
    description,
    disabled = false,
    icon
}) => {
    const theme = useTheme();
    const componentColors = theme.palette.mode === 'light'
        ? colorTokens.lightComponentColors
        : colorTokens.darkComponentColors;

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                backgroundColor: checked
                    ? theme.palette.mode === 'light'
                        ? 'rgba(25, 118, 210, 0.04)'
                        : 'rgba(144, 202, 249, 0.08)'
                    : 'transparent',
                transition: 'all 0.2s ease-in-out',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                '&:hover': {
                    backgroundColor: disabled ? undefined : checked
                        ? theme.palette.mode === 'light'
                            ? 'rgba(25, 118, 210, 0.08)'
                            : 'rgba(144, 202, 249, 0.12)'
                        : theme.palette.mode === 'light'
                            ? 'rgba(0, 0, 0, 0.04)'
                            : 'rgba(255, 255, 255, 0.04)',
                    borderColor: checked ? theme.palette.primary.main : theme.palette.divider,
                },
            }}
            onClick={() => !disabled && onChange(!checked)}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                {icon && (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            backgroundColor: checked
                                ? theme.palette.primary.main
                                : theme.palette.mode === 'light'
                                    ? 'rgba(0, 0, 0, 0.06)'
                                    : 'rgba(255, 255, 255, 0.06)',
                            color: checked
                                ? theme.palette.primary.contrastText
                                : theme.palette.text.secondary,
                            transition: 'all 0.2s ease-in-out',
                        }}
                    >
                        {icon}
                    </Box>
                )}
                <Box sx={{ flex: 1 }}>
                    <Typography
                        variant="body1"
                        sx={{
                            fontWeight: 500,
                            color: checked ? theme.palette.primary.main : theme.palette.text.primary,
                            transition: 'color 0.2s ease-in-out',
                        }}
                    >
                        {label}
                    </Typography>
                    {description && (
                        <Typography
                            variant="body2"
                            sx={{
                                color: theme.palette.text.secondary,
                                mt: 0.5,
                            }}
                        >
                            {description}
                        </Typography>
                    )}
                </Box>
            </Box>
            <Switch
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                disabled={disabled}
                sx={{
                    '& .MuiSwitch-switchBase': {
                        '&.Mui-checked': {
                            color: theme.palette.primary.main,
                            '& + .MuiSwitch-track': {
                                backgroundColor: theme.palette.primary.main,
                                opacity: 0.5,
                            },
                        },
                    },
                    '& .MuiSwitch-track': {
                        borderRadius: 12,
                        backgroundColor: theme.palette.mode === 'light' ? '#E0E0E0' : '#424242',
                        opacity: 1,
                        transition: 'all 0.2s ease-in-out',
                    },
                    '& .MuiSwitch-thumb': {
                        borderRadius: '50%',
                        width: 20,
                        height: 20,
                        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
                        transition: 'all 0.2s ease-in-out',
                    },
                }}
            />
        </Box>
    );
};

export default ModernSwitch;
