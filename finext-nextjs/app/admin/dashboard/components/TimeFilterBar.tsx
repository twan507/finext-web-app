'use client';

import React, { useState, useCallback } from 'react';
import {
    Box, ToggleButton, ToggleButtonGroup, TextField, IconButton, Tooltip, useTheme,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { TimePreset } from '../types';
import { borderRadius } from 'theme/tokens';

interface TimeFilterBarProps {
    onRangeChange: (startDate: string, endDate: string) => void;
    onRefresh: () => void;
    loading?: boolean;
}

function getPresetDates(preset: Exclude<TimePreset, 'custom'>): { start: string; end: string } {
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    const start = new Date(now);

    switch (preset) {
        case '7d':
            start.setDate(start.getDate() - 7);
            break;
        case '30d':
            start.setDate(start.getDate() - 30);
            break;
        case '3m':
            start.setMonth(start.getMonth() - 3);
            break;
        case '6m':
            start.setMonth(start.getMonth() - 6);
            break;
        case '1y':
            start.setFullYear(start.getFullYear() - 1);
            break;
    }
    return { start: start.toISOString().slice(0, 10), end };
}

const TimeFilterBar: React.FC<TimeFilterBarProps> = ({ onRangeChange, onRefresh, loading }) => {
    const theme = useTheme();
    const [preset, setPreset] = useState<TimePreset>('30d');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    const handlePresetChange = useCallback(
        (_: React.MouseEvent<HTMLElement>, newPreset: TimePreset | null) => {
            if (!newPreset) return;
            setPreset(newPreset);
            if (newPreset !== 'custom') {
                const { start, end } = getPresetDates(newPreset);
                onRangeChange(start, end);
            }
        },
        [onRangeChange],
    );

    const handleCustomApply = useCallback(() => {
        if (customStart && customEnd && customStart < customEnd) {
            onRangeChange(customStart, customEnd);
        }
    }, [customStart, customEnd, onRangeChange]);

    const toggleBtnSx = {
        borderRadius: `${borderRadius.xxl}px !important`,
        px: 1.5,
        py: 0.5,
        border: 'none',
        textTransform: 'none' as const,
        color: 'text.secondary',
        '&.Mui-selected': {
            bgcolor: theme.palette.action.selected,
            color: 'text.primary',
            '&:hover': { bgcolor: theme.palette.action.hover },
        },
        '&:hover': { bgcolor: theme.palette.action.hover },
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <ToggleButtonGroup
                value={preset}
                exclusive
                onChange={handlePresetChange}
                size="small"
            >
                {(['7d', '30d', '3m', '6m', '1y', 'custom'] as TimePreset[]).map((p) => (
                    <ToggleButton key={p} value={p} sx={toggleBtnSx}>
                        {p === '7d' ? '7D' : p === '30d' ? '30D' : p === '3m' ? '3M' : p === '6m' ? '6M' : p === '1y' ? '1Y' : 'Tùy chỉnh'}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>

            {preset === 'custom' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                        type="date"
                        size="small"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                        sx={{ width: 160 }}
                    />
                    <TextField
                        type="date"
                        size="small"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        onBlur={handleCustomApply}
                        slotProps={{ inputLabel: { shrink: true } }}
                        sx={{ width: 160 }}
                    />
                </Box>
            )}

            <Tooltip title="Làm mới dữ liệu">
                <IconButton onClick={onRefresh} disabled={loading} size="small">
                    <RefreshIcon />
                </IconButton>
            </Tooltip>
        </Box>
    );
};

export default TimeFilterBar;
