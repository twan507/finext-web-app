'use client';

import { Box, Typography, useTheme, alpha } from '@mui/material';
import { Icon } from '@iconify/react';
import { getResponsiveFontSize, fontWeight, borderRadius, durations, easings } from 'theme/tokens';
import { TABLE_VIEWS, type TableViewKey } from '../screenerConfig';

interface TableViewSelectorProps {
    activeView: TableViewKey;
    onViewChange: (view: TableViewKey) => void;
    onOpenColumnCustomizer: () => void;
}

const VIEW_KEYS: TableViewKey[] = ['overview', 'technical', 'cashflow', 'zones', 'custom'];

export default function TableViewSelector({ activeView, onViewChange, onOpenColumnCustomizer }: TableViewSelectorProps) {
    const theme = useTheme();

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            {/* View tabs — left side */}
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', fontWeight: fontWeight.medium, mr: 0.5 }}>
                    Bảng:
                </Typography>
                {VIEW_KEYS.map(key => {
                    const view = TABLE_VIEWS[key];
                    const active = activeView === key;

                    return (
                        <Box
                            key={key}
                            component="button"
                            onClick={() => onViewChange(key)}
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.6,
                                px: 1.25,
                                py: 0.5,
                                borderRadius: `${borderRadius.pill}px`,
                                border: `1px solid ${active
                                    ? alpha(theme.palette.primary.main, 0.5)
                                    : alpha(theme.palette.divider, 0.4)
                                }`,
                                bgcolor: active
                                    ? alpha(theme.palette.primary.main, 0.12)
                                    : 'transparent',
                                background: active ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                                color: active ? theme.palette.primary.main : theme.palette.text.secondary,
                                cursor: 'pointer',
                                fontSize: getResponsiveFontSize('xs'),
                                fontWeight: active ? fontWeight.bold : fontWeight.medium,
                                transition: `all ${durations.fast} ${easings.easeOut}`,
                                '&:hover': {
                                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                                    borderColor: alpha(theme.palette.primary.main, 0.3),
                                },
                            }}
                        >
                            <Icon icon={view.iconifyIcon} width={14} />
                            {view.label}
                        </Box>
                    );
                })}
            </Box>

            {/* Customize columns button — right side, icon only, only visible in custom view */}
            {activeView === 'custom' && (
                <Box
                    component="button"
                    onClick={onOpenColumnCustomizer}
                    title="Tuỳ chỉnh cột hiển thị"
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 30,
                        height: 30,
                        borderRadius: `${borderRadius.md}px`,
                        border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
                        bgcolor: 'transparent',
                        background: 'transparent',
                        color: theme.palette.text.secondary,
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: `all ${durations.fast} ${easings.easeOut}`,
                        '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            borderColor: alpha(theme.palette.primary.main, 0.3),
                            color: theme.palette.primary.main,
                        },
                    }}
                >
                    <Icon icon="solar:pen-bold" width={15} />
                </Box>
            )}
        </Box>
    );
}
