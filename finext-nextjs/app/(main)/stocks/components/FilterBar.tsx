'use client';

import { useState, useRef, useEffect } from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import { Icon } from '@iconify/react';
import { getResponsiveFontSize, fontWeight, borderRadius, getGlassCard, durations, easings } from 'theme/tokens';

interface FilterBarProps {
    meta: {
        exchange: string[];
        industry_name: string[];
        marketcap_name: string[];
        category_name: string[];
    };
    selectFilters: Record<string, string[]>;
    onSetSelectFilter: (field: string, values: string[]) => void;
    onClearSelectFilter: (field: string) => void;
    filterCount: number;
    onClearAll: () => void;
}

const FILTER_FIELDS = [
    { field: 'exchange', label: 'Sàn', metaKey: 'exchange' as const },
    { field: 'industry_name', label: 'Ngành', metaKey: 'industry_name' as const },
    { field: 'marketcap_name', label: 'Vốn hóa', metaKey: 'marketcap_name' as const },
    { field: 'category_name', label: 'Nhóm', metaKey: 'category_name' as const },
];

// ─── Custom Glass Dropdown ────────────────────────────────────────────────────

interface GlassDropdownProps {
    label: string;
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
    onClear: () => void;
}

function GlassDropdown({ label, options, selected, onChange, onClear }: GlassDropdownProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    function toggleOption(opt: string) {
        if (selected.includes(opt)) {
            const next = selected.filter(v => v !== opt);
            if (next.length === 0) onClear();
            else onChange(next);
        } else {
            onChange([...selected, opt]);
        }
    }

    const hasSelected = selected.length > 0;
    const displayLabel = hasSelected
        ? selected.length === 1
            ? selected[0]
            : `${selected[0]} +${selected.length - 1}`
        : label;

    return (
        <Box ref={ref} sx={{ position: 'relative' }}>
            {/* Trigger */}
            <Box
                component="button"
                onClick={() => setOpen(v => !v)}
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.25,
                    py: 0.6,
                    minWidth: 100,
                    borderRadius: `${borderRadius.md}px`,
                    border: `1px solid ${hasSelected
                        ? alpha(theme.palette.primary.main, 0.5)
                        : alpha(theme.palette.divider, 0.4)
                    }`,
                    bgcolor: hasSelected
                        ? alpha(theme.palette.primary.main, 0.08)
                        : isDark ? alpha('#fff', 0.04) : alpha('#000', 0.03),
                    background: hasSelected
                        ? alpha(theme.palette.primary.main, 0.08)
                        : isDark ? alpha('#fff', 0.04) : alpha('#000', 0.03),
                    color: hasSelected ? theme.palette.primary.main : theme.palette.text.secondary,
                    cursor: 'pointer',
                    transition: `all ${durations.fast} ${easings.easeOut}`,
                    '&:hover': {
                        borderColor: alpha(theme.palette.primary.main, 0.35),
                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                    },
                }}
            >
                <Typography sx={{
                    fontSize: getResponsiveFontSize('xs'),
                    fontWeight: hasSelected ? fontWeight.semibold : fontWeight.medium,
                    color: 'inherit',
                    lineHeight: 1.4,
                    whiteSpace: 'nowrap',
                    flex: 1,
                    textAlign: 'left',
                }}>
                    {displayLabel}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    {hasSelected && (
                        <Box
                            component="span"
                            onClick={(e) => { e.stopPropagation(); onClear(); }}
                            sx={{ display: 'flex', color: theme.palette.primary.main, cursor: 'pointer' }}
                        >
                            <Icon icon="solar:close-circle-bold" width={14} />
                        </Box>
                    )}
                    <Icon
                        icon="solar:alt-arrow-down-bold"
                        width={12}
                        style={{
                            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: `transform ${durations.fast} ${easings.easeOut}`,
                            color: 'inherit',
                        }}
                    />
                </Box>
            </Box>

            {/* Dropdown panel */}
            {open && options.length > 0 && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        zIndex: 1300,
                        minWidth: 180,
                        maxHeight: 280,
                        overflowY: 'auto',
                        borderRadius: `${borderRadius.lg}px`,
                        ...getGlassCard(isDark),
                        boxShadow: isDark
                            ? '0 8px 32px rgba(0,0,0,0.5)'
                            : '0 8px 24px rgba(0,0,0,0.12)',
                        animation: `ddFadeIn ${durations.fast} ${easings.easeOut}`,
                        '@keyframes ddFadeIn': {
                            from: { opacity: 0, transform: 'translateY(-6px)' },
                            to: { opacity: 1, transform: 'translateY(0)' },
                        },
                        // Custom scrollbar
                        '&::-webkit-scrollbar': { width: 4 },
                        '&::-webkit-scrollbar-track': { background: 'transparent' },
                        '&::-webkit-scrollbar-thumb': { background: alpha(theme.palette.divider, 0.4), borderRadius: 2 },
                    }}
                >
                    {options.map((opt, idx) => {
                        const isSelected = selected.includes(opt);
                        return (
                            <Box
                                key={opt}
                                component="button"
                                onClick={() => toggleOption(opt)}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    width: '100%',
                                    textAlign: 'left',
                                    px: 1.5,
                                    py: 0.9,
                                    background: isSelected
                                        ? isDark ? alpha(theme.palette.primary.main, 0.15) : alpha(theme.palette.primary.main, 0.08)
                                        : 'transparent',
                                    border: 'none',
                                    borderBottom: idx < options.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.12)}` : 'none',
                                    cursor: 'pointer',
                                    transition: `background ${durations.fastest}`,
                                    '&:hover': {
                                        background: isDark ? alpha('#fff', 0.06) : alpha('#000', 0.04),
                                    },
                                }}
                            >
                                <Box sx={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: `${borderRadius.xs}px`,
                                    border: `1.5px solid ${isSelected ? theme.palette.primary.main : alpha(theme.palette.divider, 0.5)}`,
                                    bgcolor: isSelected ? theme.palette.primary.main : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    transition: `all ${durations.fast}`,
                                }}>
                                    {isSelected && (
                                        <Icon icon="solar:check-read-bold" width={10} color="#fff" />
                                    )}
                                </Box>
                                <Typography sx={{
                                    fontSize: getResponsiveFontSize('xs'),
                                    fontWeight: isSelected ? fontWeight.semibold : fontWeight.medium,
                                    color: isSelected ? theme.palette.primary.main : theme.palette.text.primary,
                                    lineHeight: 1.4,
                                }}>
                                    {opt}
                                </Typography>
                            </Box>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

export default function FilterBar({ meta, selectFilters, onSetSelectFilter, onClearSelectFilter, filterCount, onClearAll }: FilterBarProps) {
    const theme = useTheme();

    return (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            {FILTER_FIELDS.map(({ field, label, metaKey }) => (
                <GlassDropdown
                    key={field}
                    label={label}
                    options={meta[metaKey] ?? []}
                    selected={selectFilters[field] ?? []}
                    onChange={(vals) => onSetSelectFilter(field, vals)}
                    onClear={() => onClearSelectFilter(field)}
                />
            ))}

            {/* Clear all */}
            {filterCount > 0 && (
                <Box
                    component="button"
                    onClick={onClearAll}
                    title="Xóa tất cả bộ lọc"
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 1.25,
                        py: 0.6,
                        borderRadius: `${borderRadius.md}px`,
                        border: `1px solid ${alpha(theme.palette.error.main, 0.35)}`,
                        bgcolor: 'transparent',
                        background: 'transparent',
                        color: theme.palette.error.main,
                        cursor: 'pointer',
                        fontSize: getResponsiveFontSize('xs'),
                        fontWeight: fontWeight.medium,
                        transition: `all ${durations.fast}`,
                        '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.08) },
                    }}
                >
                    <Icon icon="solar:close-circle-bold" width={14} />
                    Xóa ({filterCount})
                </Box>
            )}
        </Box>
    );
}
