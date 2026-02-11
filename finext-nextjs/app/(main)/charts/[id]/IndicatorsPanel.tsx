'use client';

import React, { useState, useMemo } from 'react';
import {
    Box,
    Typography,
    Collapse,
    IconButton,
    Tooltip,
    useTheme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import { INDICATOR_GROUPS, LINE_STYLE, getIndicatorColor, type IndicatorDef, type LineIndicator, type VolumeLineIndicator } from './indicatorConfig';

/** Map lwOptions.lineStyle → CSS border-style */
const getCssLineStyle = (lineStyle?: number): string => {
    switch (lineStyle) {
        case LINE_STYLE.Dashed:
        case LINE_STYLE.LargeDashed:
            return 'dashed';
        case LINE_STYLE.Dotted:
        case LINE_STYLE.SparseDotted:
            return 'dotted';
        default:
            return 'solid';
    }
};

/* ── Radiant Dot indicator (static glow) ──────────── */
const RadiantDot = ({ active, color }: { active: boolean; color: string }) => (
    <Box
        sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            flexShrink: 0,
        }}
    >
        {/* Outer glow halo — only when active */}
        {active && (
            <Box
                sx={{
                    position: 'absolute',
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    backgroundColor: `${color}25`,
                    boxShadow: `0 0 6px 1px ${color}30`,
                }}
            />
        )}
        {/* Core dot */}
        <Box
            sx={{
                position: 'relative',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: active ? color : 'rgba(128,128,128,0.35)',
                boxShadow: active ? `0 0 6px 2px ${color}` : 'none',
                transition: 'all 0.3s',
                zIndex: 1,
            }}
        />
    </Box>
);

export interface IndicatorsPanelProps {
    enabledIndicators: Record<string, boolean>;
    onToggleIndicator: (key: string) => void;
    onClearAll: () => void;
    onResetDefault?: () => void;
}

export default function IndicatorsPanel({
    enabledIndicators,
    onToggleIndicator,
    onClearAll,
    onResetDefault,
}: IndicatorsPanelProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        INDICATOR_GROUPS.forEach((g) => {
            initial[g.key] = g.indicators.some((ind) => enabledIndicators[ind.key]);
        });
        return initial;
    });

    const toggleGroup = (groupKey: string) => {
        setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
    };

    const getTypeLabel = (type: IndicatorDef['type']) => {
        switch (type) {
            case 'line':
                return 'Line';
            case 'band':
                return 'Band';
            case 'volume-line':
                return 'Vol';
        }
    };

    const hasActiveIndicators = useMemo(
        () => Object.values(enabledIndicators).some(Boolean),
        [enabledIndicators],
    );

    return (
        <Box
            sx={{
                width: 280,
                height: '100%',
                borderLeft: 1,
                borderColor: 'divider',
                backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(8px)',
                overflowY: 'auto',
                overflowX: 'hidden',
                scrollbarWidth: 'thin',
            }}
        >
            {/* Header */}
            <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                {/* <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        fontWeight: fontWeight.semibold,
                        color: 'text.primary',
                    }}
                >
                    Chỉ báo kỹ thuật
                </Typography> */}
                {hasActiveIndicators && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                        {onResetDefault && (
                            <Tooltip title="Thiết lập mặc định">
                                <IconButton
                                    size="small"
                                    onClick={onResetDefault}
                                    sx={{
                                        p: 0.25,
                                        color: 'text.secondary',
                                        '&:hover': { color: 'primary.main' },
                                    }}
                                >
                                    <RestartAltIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                            </Tooltip>
                        )}
                        <Tooltip title="Xoá tất cả">
                            <IconButton
                                size="small"
                                onClick={onClearAll}
                                sx={{
                                    p: 0.25,
                                    color: 'text.secondary',
                                    '&:hover': { color: 'error.main' },
                                }}
                            >
                                <DeleteSweepIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}
                {!hasActiveIndicators && onResetDefault && (
                    <Tooltip title="Thiết lập mặc định">
                        <IconButton
                            size="small"
                            onClick={onResetDefault}
                            sx={{
                                p: 0.25,
                                color: 'text.secondary',
                                '&:hover': { color: 'primary.main' },
                            }}
                        >
                            <RestartAltIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </Tooltip>
                )}
            </Box>

            {INDICATOR_GROUPS.map((group) => {
                const enabledCount = group.indicators.filter((i) => enabledIndicators[i.key]).length;

                return (
                    <Box key={group.key}>
                        {/* Group header */}
                        <Box
                            onClick={() => toggleGroup(group.key)}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                px: 1.5,
                                py: 0.75,
                                cursor: 'pointer',
                                userSelect: 'none',
                                '&:hover': {
                                    backgroundColor: isDark
                                        ? 'rgba(255,255,255,0.04)'
                                        : 'rgba(0,0,0,0.03)',
                                },
                                borderBottom: expandedGroups[group.key] ? 0 : 1,
                                borderColor: 'divider',
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('xs'),
                                        fontWeight: fontWeight.semibold,
                                        color: 'text.secondary',
                                        textTransform: 'uppercase',
                                        letterSpacing: 0.5,
                                    }}
                                >
                                    {group.name}
                                </Typography>
                                {enabledCount > 0 && (
                                    <Box
                                        sx={{
                                            px: 0.5,
                                            py: 0.1,
                                            borderRadius: 0.5,
                                            backgroundColor: 'primary.main',
                                            color: 'primary.contrastText',
                                        }}
                                    >
                                        <Typography
                                            sx={{
                                                fontSize: '0.6rem',
                                                fontWeight: 600,
                                                lineHeight: 1.2,
                                            }}
                                        >
                                            {enabledCount}
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                            {expandedGroups[group.key] ? (
                                <ExpandLessIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            ) : (
                                <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            )}
                        </Box>

                        {/* Group indicators */}
                        <Collapse in={expandedGroups[group.key]}>
                            <Box sx={{ pb: 0.5, borderBottom: 1, borderColor: 'divider' }}>
                                {group.indicators.map((ind) => {
                                    const indColor = getIndicatorColor(ind, isDark);
                                    const isActive = !!enabledIndicators[ind.key];

                                    return (
                                        <Box
                                            key={ind.key}
                                            onClick={() => onToggleIndicator(ind.key)}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                px: 1.5,
                                                py: 0.5,
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                transition: 'background-color 0.15s',
                                                '&:hover': {
                                                    backgroundColor: isDark
                                                        ? 'rgba(255,255,255,0.05)'
                                                        : 'rgba(0,0,0,0.03)',
                                                },
                                                '&:active': {
                                                    backgroundColor: isDark
                                                        ? 'rgba(255,255,255,0.08)'
                                                        : 'rgba(0,0,0,0.05)',
                                                },
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.75,
                                                    minWidth: 0,
                                                }}
                                            >
                                                {/* Color indicator — reflects actual line/band style */}
                                                {ind.type === 'band' ? (
                                                    <Box
                                                        sx={{
                                                            width: 12,
                                                            height: 8,
                                                            borderRadius: 0.5,
                                                            backgroundColor: `${indColor}30`,
                                                            flexShrink: 0,
                                                        }}
                                                    />
                                                ) : (
                                                    <Box
                                                        sx={{
                                                            width: 16,
                                                            height: 0,
                                                            borderBottom: `2px ${getCssLineStyle((ind as LineIndicator | VolumeLineIndicator).lwOptions?.lineStyle)} ${indColor}`,
                                                            flexShrink: 0,
                                                        }}
                                                    />
                                                )}
                                                <Typography
                                                    sx={{
                                                        fontSize: getResponsiveFontSize('xs'),
                                                        color: isActive
                                                            ? 'text.primary'
                                                            : 'text.secondary',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        transition: 'color 0.2s',
                                                    }}
                                                >
                                                    {ind.label}
                                                </Typography>
                                                <Typography
                                                    sx={{
                                                        fontSize: '0.55rem',
                                                        color: 'text.disabled',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: 0.3,
                                                    }}
                                                >
                                                    {getTypeLabel(ind.type)}
                                                </Typography>
                                            </Box>
                                            <RadiantDot active={isActive} color={indColor} />
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Collapse>
                    </Box>
                );
            })}
        </Box>
    );
}
