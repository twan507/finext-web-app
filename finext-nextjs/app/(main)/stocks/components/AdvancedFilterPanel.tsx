'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Box, Typography, TextField, Chip, useTheme, alpha, IconButton, Tooltip, Collapse, Slider } from '@mui/material';
import { Icon } from '@iconify/react';
import { getResponsiveFontSize, fontWeight, borderRadius, getGlassCard, durations, easings } from 'theme/tokens';
import type { RangeFilter, AdvancedFilter } from 'hooks/useScreenerStore';
import { ADVANCED_FILTER_DEFS, ADVANCED_FILTER_GROUPS, type AdvancedCompare } from '../screenerConfig';

// ─── Props ───────────────────────────────────────────────────────────────────

interface AdvancedFilterPanelProps {
    rangeFilters: Record<string, RangeFilter>;
    advancedFilters: AdvancedFilter[];
    selectFilters: Record<string, string[]>;
    showDetail: boolean;     // controls the range/zone accordion zone
    showIndicator: boolean;  // controls the indicator builder zone
    onSetRangeFilter: (field: string, range: RangeFilter) => void;
    onClearRangeFilter: (field: string) => void;
    onAddAdvancedFilter: (filter: AdvancedFilter) => void;
    onRemoveAdvancedFilter: (field: string) => void;
    onClearAdvancedFilters: () => void;
    onSetSelectFilter: (field: string, values: string[]) => void;
    onClearSelectFilter: (field: string) => void;
}

// ─── Range filter definitions ────────────────────────────────────────────────

interface RangeFilterDef {
    field: string;
    label: string;
    group: string;
    unit?: string;        // display unit suffix
    isPct?: boolean;      // stored as 0-1, display as 0-100
    scaleTo?: number;     // divide stored by this to display (e.g. 1e9 for Tỷ)
    sliderMin: number;    // display-space min for slider
    sliderMax: number;    // display-space max for slider
    step: number;         // slider step in display-space
    logScale?: boolean;   // quadratic scale: internal 0-1000 ↔ display sliderMin-sliderMax
}

const RANGE_FILTER_DEFS: RangeFilterDef[] = [
    { field: 'pct_change',       label: 'Giá',          group: 'pricevol', unit: '%',     isPct: true,  sliderMin: -7,   sliderMax: 7,    step: 0.1 },
    { field: 'trading_value',    label: 'Giá trị GD',  group: 'pricevol', unit: 'Tỷ',                sliderMin: 0,    sliderMax: 100,  step: 0.1, logScale: true },
    { field: 'vsi',              label: 'Thanh Khoản', group: 'pricevol', unit: '%',                   sliderMin: 0,    sliderMax: 150,  step: 5 },
    { field: 'w_pct',            label: '% Tuần',      group: 'change',   unit: '%',     isPct: true,  sliderMin: -20,  sliderMax: 20,   step: 0.5 },
    { field: 'm_pct',            label: '% Tháng',     group: 'change',   unit: '%',     isPct: true,  sliderMin: -20,  sliderMax: 20,   step: 0.5 },
    { field: 'q_pct',            label: '% Quý',       group: 'change',   unit: '%',     isPct: true,  sliderMin: -20,  sliderMax: 20,   step: 0.5 },
    { field: 'y_pct',            label: '% Năm',       group: 'change',   unit: '%',     isPct: true,  sliderMin: -20,  sliderMax: 20,   step: 0.5 },
    { field: 't0_score',         label: 'Trong Phiên',     group: 'cashflow', unit: 'điểm',                sliderMin: -100, sliderMax: 100,  step: 5 },
    { field: 't5_score',         label: 'Trong Tuần',      group: 'cashflow', unit: 'điểm',                sliderMin: -100, sliderMax: 100,  step: 5 },
    { field: 'market_rank_pct',  label: 'Xếp hạng TT',    group: 'cashflow', unit: '%',     isPct: true,  sliderMin: 0,    sliderMax: 100,  step: 1 },
    { field: 'industry_rank_pct',label: 'Xếp hạng Ngành', group: 'cashflow', unit: '%',     isPct: true,  sliderMin: 0,    sliderMax: 100,  step: 1 },
];

// ─── Zone filter definitions ─────────────────────────────────────────────────

const ZONE_VALUES = ['AAA', 'AA', 'A', 'B', 'C'] as const;
type ZoneValue = typeof ZONE_VALUES[number];

// Dark mode: vibrant/pastel, Light mode: saturated & readable
const ZONE_CHIP_COLORS_DARK: Record<ZoneValue, string> = {
    AAA: '#22c55e',
    AA:  '#86efac',
    A:   '#facc15',
    B:   '#f97316',
    C:   '#ef4444',
};
const ZONE_CHIP_COLORS_LIGHT: Record<ZoneValue, string> = {
    AAA: '#16a34a',  // green-600
    AA:  '#0d9488',  // teal-600
    A:   '#b45309',  // amber-700
    B:   '#c2410c',  // orange-700
    C:   '#b91c1c',  // red-700
};

interface ZoneFilterDef {
    field: string;
    label: string;
    subgroup: string;
}

const ZONE_FILTER_DEFS: ZoneFilterDef[] = [
    { field: 'w_zone',      label: 'Tuần',     subgroup: 'Tổng hợp' },
    { field: 'm_zone',      label: 'Tháng',    subgroup: 'Tổng hợp' },
    { field: 'q_zone',      label: 'Quý',      subgroup: 'Tổng hợp' },
    { field: 'y_zone',      label: 'Năm',      subgroup: 'Tổng hợp' },
    { field: 'w_ma_zone',   label: 'Tuần',     subgroup: 'MA Zone' },
    { field: 'm_ma_zone',   label: 'Tháng',    subgroup: 'MA Zone' },
    { field: 'q_ma_zone',   label: 'Quý',      subgroup: 'MA Zone' },
    { field: 'y_ma_zone',   label: 'Năm',      subgroup: 'MA Zone' },
    { field: 'w_fibo_zone', label: 'Tuần',     subgroup: 'Fibo Zone' },
    { field: 'm_fibo_zone', label: 'Tháng',    subgroup: 'Fibo Zone' },
    { field: 'q_fibo_zone', label: 'Quý',      subgroup: 'Fibo Zone' },
    { field: 'y_fibo_zone', label: 'Năm',      subgroup: 'Fibo Zone' },
    { field: 'w_vp_zone',   label: 'Tuần',     subgroup: 'VP Zone' },
    { field: 'm_vp_zone',   label: 'Tháng',    subgroup: 'VP Zone' },
    { field: 'q_vp_zone',   label: 'Quý',      subgroup: 'VP Zone' },
    { field: 'y_vp_zone',   label: 'Năm',      subgroup: 'VP Zone' },
];


// ─── Accordion group config ──────────────────────────────────────────────────

interface AccordionGroupConfig {
    key: string;
    label: string;
    icon: string;
    color: string;
}

// Detail accordion groups only (indicator is a separate zone)
const ACCORDION_GROUPS: AccordionGroupConfig[] = [
    { key: 'pricevol', label: 'Biến động',          icon: 'solar:graph-up-bold-duotone',  color: 'success' },
    { key: 'change',   label: '% Thay đổi',         icon: 'solar:chart-bold-duotone',     color: '#ec4899' },
    { key: 'cashflow', label: 'Dòng tiền',           icon: 'solar:dollar-bold-duotone',    color: 'info' },
    { key: 'zones',    label: 'Vùng giá kỹ thuật',  icon: 'solar:layers-bold-duotone',    color: 'warning' },
];

// ─── Slider Range Row ────────────────────────────────────────────────────────

function SliderRangeRow({
    def,
    current,
    onSet,
    onClear,
    accentColor,
}: {
    def: RangeFilterDef;
    current: RangeFilter | undefined;
    onSet: (field: string, range: RangeFilter) => void;
    onClear: (field: string) => void;
    accentColor: string;
}) {
    const theme = useTheme();

    // ── conversion helpers ──
    const toDisplay = useCallback((stored: number | null): number | '' => {
        if (stored == null) return '';
        if (def.isPct) return Math.round(stored * 10000) / 100; // avoid float drift
        if (def.scaleTo) return stored / def.scaleTo;
        return stored;
    }, [def.isPct, def.scaleTo]);

    const toStore = useCallback((display: string): number | null => {
        if (display === '') return null;
        const val = Number(display);
        if (isNaN(val)) return null;
        if (def.isPct) return val / 100;
        if (def.scaleTo) return val * def.scaleTo;
        return val;
    }, [def.isPct, def.scaleTo]);

    const displayMin = toDisplay(current?.min ?? null);
    const displayMax = toDisplay(current?.max ?? null);
    const hasValue = current != null && (current.min != null || current.max != null);

    // ── Piecewise linear scale helpers for logScale fields ──
    // Internal slider: 0–1000 | first half (0–500) → 0–20 Tỷ | second half (500–1000) → 20–100 Tỷ
    const LOG_INTERNAL_MAX = 1000;
    const posToDisplay = (pos: number): number => {
        if (pos <= 0) return 0;
        if (pos >= LOG_INTERNAL_MAX) return def.sliderMax;
        if (pos <= 500) return Math.round(pos / 500 * 20 * 10) / 10;
        return Math.round((20 + (pos - 500) / 500 * 80) * 10) / 10;
    };
    const displayToPos = (val: number): number => {
        if (val <= 0) return 0;
        if (val >= def.sliderMax) return LOG_INTERNAL_MAX;
        if (val <= 20) return Math.round(val / 20 * 500);
        return Math.round(500 + (val - 20) / 80 * 500);
    };

    // Slider value: clamp to slider bounds (or quadratic-mapped positions for logScale)
    const clamp = (v: number) => Math.min(def.sliderMax, Math.max(def.sliderMin, v));
    const sliderValue: [number, number] = def.logScale
        ? [
            displayMin === '' ? 0 : displayToPos(displayMin),
            displayMax === '' ? LOG_INTERNAL_MAX : displayToPos(displayMax),
          ]
        : [
            displayMin === '' ? def.sliderMin : clamp(displayMin),
            displayMax === '' ? def.sliderMax : clamp(displayMax),
          ];

    const handleSliderChange = (_: unknown, val: number | number[]) => {
        const [lo, hi] = val as [number, number];
        if (def.logScale) {
            const loDisplay = posToDisplay(lo);
            const hiDisplay = posToDisplay(hi);
            const minStore = lo <= 0 ? null : toStore(String(loDisplay));
            const maxStore = hi >= LOG_INTERNAL_MAX ? null : toStore(String(hiDisplay));
            if (minStore == null && maxStore == null) onClear(def.field);
            else onSet(def.field, { min: minStore, max: maxStore });
        } else {
            const minStore = lo === def.sliderMin ? null : toStore(String(lo));
            const maxStore = hi === def.sliderMax ? null : toStore(String(hi));
            if (minStore == null && maxStore == null) onClear(def.field);
            else onSet(def.field, { min: minStore, max: maxStore });
        }
    };

    const handleMinInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        onSet(def.field, { min: toStore(e.target.value), max: current?.max ?? null });
    };

    const handleMaxInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        onSet(def.field, { min: current?.min ?? null, max: toStore(e.target.value) });
    };

    const inputSx = {
        width: { xs: 56, sm: 64 },
        flexShrink: 0,
        '& .MuiOutlinedInput-root': {
            borderRadius: `${borderRadius.sm}px`,
            fontSize: getResponsiveFontSize('xs'),
            transition: `border-color ${durations.fast} ${easings.easeOut}`,
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: accentColor,
                borderWidth: 1.5,
            },
        },
        '& .MuiOutlinedInput-input': {
            py: 0.45,
            px: 0.5,
            fontSize: getResponsiveFontSize('xs'),
            textAlign: 'center',
            '&::placeholder': { opacity: 0.4, fontSize: '0.75rem' },
        },
    };

    return (
        <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 0.75, sm: 1 },
            px: 0.75,
            py: 0.5,
            borderRadius: `${borderRadius.sm}px`,
        }}>
            {/* Label */}
            <Box sx={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 0.25,
                width: { xs: 96, sm: 112 },
                justifyContent: 'flex-start',
                flexShrink: 0,
                mr: { xs: 0.75, sm: 1 },
            }}>
                <Typography sx={{
                    fontSize: getResponsiveFontSize('xs'),
                    color: hasValue ? accentColor : 'text.secondary',
                    fontWeight: hasValue ? fontWeight.semibold : fontWeight.medium,
                    transition: `color ${durations.fast} ${easings.easeOut}`,
                    whiteSpace: 'nowrap',
                }}>
                    {def.label}
                </Typography>
                {def.unit && (
                    <Typography sx={{ fontSize: getResponsiveFontSize('xxs'), color: 'text.disabled', whiteSpace: 'nowrap' }}>
                        ({def.unit})
                    </Typography>
                )}
            </Box>

            {/* Min input */}
            <TextField
                size="small"
                placeholder="Min"
                type="number"
                value={displayMin}
                onChange={handleMinInput}
                sx={inputSx}
            />

            {/* Dual-handle slider */}
            <Slider
                value={sliderValue}
                onChange={handleSliderChange}
                min={def.logScale ? 0 : def.sliderMin}
                max={def.logScale ? LOG_INTERNAL_MAX : def.sliderMax}
                step={def.logScale ? 1 : def.step}
                scale={def.logScale ? posToDisplay : undefined}
                disableSwap
                sx={{
                    flex: 1,
                    mx: 1.5,
                    height: 4,
                    color: accentColor,
                    opacity: hasValue ? 1 : 0.3,
                    '& .MuiSlider-track': {
                        border: 'none',
                    },
                    '& .MuiSlider-rail': {
                        opacity: 0.25,
                        bgcolor: theme.palette.text.secondary,
                    },
                    '& .MuiSlider-thumb': {
                        width: 14,
                        height: 14,
                        bgcolor: theme.palette.background.paper,
                        border: `2px solid ${accentColor}`,
                        boxShadow: `0 0 0 3px ${alpha(accentColor, 0.12)}`,
                        '&:hover, &.Mui-focusVisible': {
                            boxShadow: `0 0 0 5px ${alpha(accentColor, 0.2)}`,
                        },
                        '&.Mui-active': {
                            boxShadow: `0 0 0 6px ${alpha(accentColor, 0.25)}`,
                        },
                    },
                }}
            />

            {/* Max input */}
            <TextField
                size="small"
                placeholder="Max"
                type="number"
                value={displayMax}
                onChange={handleMaxInput}
                sx={inputSx}
            />

            {/* Clear button — visibility hidden to reserve space */}
            <IconButton
                size="small"
                onClick={() => onClear(def.field)}
                sx={{
                    p: 0.2,
                    flexShrink: 0,
                    visibility: hasValue ? 'visible' : 'hidden',
                    color: alpha(theme.palette.text.secondary, 0.4),
                    '&:hover': { color: theme.palette.error.main },
                }}
            >
                <Icon icon="solar:close-circle-bold" width={13} />
            </IconButton>
        </Box>
    );
}

// ─── Zone Filter Section ─────────────────────────────────────────────────────

const ZONE_TAB_CONFIGS = [
    { key: 'Tổng hợp', label: 'Tổng hợp', icon: 'solar:layers-minimalistic-bold-duotone' },
    { key: 'MA Zone',   label: 'Moving Average',        icon: 'solar:chart-2-bold-duotone' },
    { key: 'Fibo Zone', label: 'Fibonacci', icon: 'solar:infinity-bold-duotone' },
    { key: 'VP Zone',   label: 'Volume Profile',icon: 'solar:graph-new-bold-duotone' },
] as const;

function ZoneFilterSection({
    selectFilters,
    onSetSelectFilter,
    onClearSelectFilter,
}: {
    selectFilters: Record<string, string[]>;
    onSetSelectFilter: (field: string, values: string[]) => void;
    onClearSelectFilter: (field: string) => void;
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [activeTab, setActiveTab] = useState<typeof ZONE_TAB_CONFIGS[number]['key']>('Tổng hợp');

    const toggleZone = (field: string, value: ZoneValue) => {
        const current = selectFilters[field] ?? [];
        const next = current.includes(value)
            ? current.filter(v => v !== value)
            : [...current, value];
        if (next.length === 0) onClearSelectFilter(field);
        else onSetSelectFilter(field, next);
    };

    const getTabCount = (tabKey: string) =>
        ZONE_FILTER_DEFS.filter(d => d.subgroup === tabKey && (selectFilters[d.field] ?? []).length > 0).length;

    const accentColor = theme.palette.warning.main;
    const zoneValuesByTab: Record<string, ZoneValue[]> = {
        'Tổng hợp': [...ZONE_VALUES],
        'MA Zone':   ['A', 'B', 'C'],
        'Fibo Zone': ['A', 'B', 'C'],
        'VP Zone':   ['A', 'B', 'C'],
    };

    return (
        <Box sx={{ px: 1.5, pb: 1.5 }}>
            {/* Tab selector */}
            <Box sx={{
                display: 'flex',
                gap: 0.5,
                mb: 1.5,
                mt: 1.5,
                p: 0.4,
                borderRadius: `${borderRadius.md}px`,
                bgcolor: alpha(theme.palette.divider, isDark ? 0.08 : 0.06),
            }}>
                {ZONE_TAB_CONFIGS.map(tab => {
                    const isActive = activeTab === tab.key;
                    const count = getTabCount(tab.key);
                    return (
                        <Box
                            key={tab.key}
                            component="button"
                            onClick={() => setActiveTab(tab.key)}
                            sx={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 0.5,
                                py: 0.55,
                                px: 0.5,
                                border: 'none',
                                borderRadius: `${borderRadius.sm}px`,
                                bgcolor: isActive
                                    ? theme.palette.background.paper
                                    : 'transparent',
                                boxShadow: isActive
                                    ? `0 1px 4px ${alpha('#000', isDark ? 0.4 : 0.12)}`
                                    : 'none',
                                color: isActive ? accentColor : theme.palette.text.secondary,
                                cursor: 'pointer',
                                fontSize: getResponsiveFontSize('xs'),
                                fontWeight: isActive ? fontWeight.bold : fontWeight.medium,
                                transition: `all ${durations.fast} ${easings.easeOut}`,
                                whiteSpace: 'nowrap',
                                '&:hover': {
                                    color: isActive ? accentColor : theme.palette.text.primary,
                                },
                            }}
                        >
                            <Icon icon={tab.icon} width={13} />
                            {tab.label}
                            {count > 0 && (
                                <Box sx={{
                                    width: 16, height: 16,
                                    borderRadius: '50%',
                                    bgcolor: accentColor,
                                    color: '#fff',
                                    fontSize: getResponsiveFontSize('xxs'),
                                    fontWeight: fontWeight.bold,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    {count}
                                </Box>
                            )}
                        </Box>
                    );
                })}
            </Box>

            {/* Render all tab panels — show/hide via display to avoid unmount flicker */}
            {ZONE_TAB_CONFIGS.map(tab => {
                const tabDefs = ZONE_FILTER_DEFS.filter(d => d.subgroup === tab.key);
                const tabValues = zoneValuesByTab[tab.key];
                return (
                    <Box
                        key={tab.key}
                        sx={{ display: activeTab === tab.key ? 'flex' : 'none', flexDirection: 'column', gap: 0.625 }}
                    >
                        {tabDefs.map((def: ZoneFilterDef) => {
                            const selected = selectFilters[def.field] ?? [];
                            const hasAny = selected.length > 0;
                            return (
                                <Box key={def.field} sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    px: 0.75,
                                    py: 0.5,
                                    borderRadius: `${borderRadius.sm}px`,
                                    bgcolor: hasAny ? alpha(accentColor, 0.04) : 'transparent',
                                    transition: `background ${durations.fast} ${easings.easeOut}`,
                                }}>
                                    <Typography sx={{
                                        fontSize: getResponsiveFontSize('xs'),
                                        fontWeight: hasAny ? fontWeight.bold : fontWeight.medium,
                                        color: hasAny ? accentColor : theme.palette.text.secondary,
                                        minWidth: 40,
                                        transition: `color ${durations.fast} ${easings.easeOut}`,
                                    }}>
                                        {def.label}
                                    </Typography>

                                    <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                                        {tabValues.map((val: ZoneValue) => {
                                            const isSelected = selected.includes(val);
                                            const chipColor = isDark ? ZONE_CHIP_COLORS_DARK[val] : ZONE_CHIP_COLORS_LIGHT[val];
                                            return (
                                                <Box
                                                    key={val}
                                                    component="button"
                                                    onClick={() => toggleZone(def.field, val)}
                                                    sx={{
                                                        flex: 1,
                                                        py: 0.35,
                                                        border: `1.5px solid ${isSelected ? chipColor : alpha(chipColor, 0.25)}`,
                                                        borderRadius: `${borderRadius.sm}px`,
                                                        bgcolor: isSelected
                                                            ? alpha(chipColor, isDark ? 0.22 : 0.15)
                                                            : isDark ? alpha(chipColor, 0.1) : theme.palette.grey[100],
                                                        color: isSelected ? chipColor : alpha(chipColor, isDark ? 0.9 : 0.7),
                                                        cursor: 'pointer',
                                                        fontSize: getResponsiveFontSize('xs'),
                                                        fontWeight: isSelected ? fontWeight.bold : fontWeight.medium,
                                                        textAlign: 'center',
                                                        transition: `all ${durations.fast} ${easings.easeOut}`,
                                                        '&:hover': {
                                                            bgcolor: alpha(chipColor, 0.15),
                                                            borderColor: alpha(chipColor, 0.6),
                                                            color: chipColor,
                                                        },
                                                    }}
                                                >
                                                    {val}
                                                </Box>
                                            );
                                        })}
                                    </Box>

                                    <IconButton
                                        size="small"
                                        onClick={() => onClearSelectFilter(def.field)}
                                        sx={{
                                            p: 0.2, flexShrink: 0,
                                            visibility: hasAny ? 'visible' : 'hidden',
                                            color: alpha(theme.palette.text.secondary, 0.35),
                                            '&:hover': { color: theme.palette.error.main },
                                        }}
                                    >
                                        <Icon icon="solar:close-circle-bold" width={13} />
                                    </IconButton>
                                </Box>
                            );
                        })}
                    </Box>
                );
            })}
        </Box>
    );
}

// ─── Accordion Header ────────────────────────────────────────────────────────

function AccordionHeader({
    group,
    isOpen,
    activeCount,
    onClick,
}: {
    group: AccordionGroupConfig;
    isOpen: boolean;
    activeCount: number;
    onClick: () => void;
}) {
    const theme = useTheme();
    const paletteColor = group.color.startsWith('#')
        ? group.color
        : (theme.palette as Record<string, any>)[group.color]?.main ?? theme.palette.primary.main;

    return (
        <Box
            component="button"
            onClick={onClick}
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                width: '100%',
                py: 0.875,
                px: 1.5,
                border: 'none',
                borderRadius: `${borderRadius.md}px`,
                bgcolor: isOpen ? alpha(paletteColor, 0.08) : 'transparent',
                cursor: 'pointer',
                transition: `all ${durations.fast} ${easings.easeOut}`,
                '&:hover': { bgcolor: alpha(paletteColor, 0.06) },
            }}
        >
            <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 26, height: 26,
                borderRadius: `${borderRadius.sm}px`,
                bgcolor: alpha(paletteColor, 0.12),
                color: paletteColor,
                flexShrink: 0,
            }}>
                <Icon icon={group.icon} width={14} />
            </Box>

            <Typography sx={{
                fontSize: getResponsiveFontSize('xs'),
                fontWeight: fontWeight.semibold,
                color: isOpen ? paletteColor : 'text.primary',
                flex: 1,
                textAlign: 'left',
                transition: `color ${durations.fast} ${easings.easeOut}`,
            }}>
                {group.label}
            </Typography>

            {activeCount > 0 && (
                <Box sx={{
                    px: 0.75, py: 0.1,
                    borderRadius: `${borderRadius.pill}px`,
                    bgcolor: paletteColor,
                    color: '#fff',
                    fontSize: getResponsiveFontSize('xxs'),
                    fontWeight: fontWeight.bold,
                    lineHeight: 1.6,
                    minWidth: 18,
                    textAlign: 'center',
                }}>
                    {activeCount}
                </Box>
            )}

            <Icon
                icon="solar:alt-arrow-down-linear"
                width={14}
                style={{
                    color: theme.palette.text.disabled,
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                    transition: `transform ${durations.fast} ${easings.easeOut}`,
                }}
            />
        </Box>
    );
}

// ─── Indicator / Lọc nâng cao Section ────────────────────────────────────────

function IndicatorSection({
    advancedFilters,
    onAddAdvancedFilter,
    onRemoveAdvancedFilter,
    onClearAdvancedFilters,
}: {
    advancedFilters: AdvancedFilter[];
    onAddAdvancedFilter: (filter: AdvancedFilter) => void;
    onRemoveAdvancedFilter: (field: string) => void;
    onClearAdvancedFilters: () => void;
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const [newField, setNewField] = useState('');
    const [newCompare, setNewCompare] = useState<AdvancedCompare>('above');
    const [newLowerPct, setNewLowerPct] = useState('');
    const [newUpperPct, setNewUpperPct] = useState('');
    const [indicatorOpen, setIndicatorOpen] = useState(false);
    const [indicatorSearch, setIndicatorSearch] = useState('');
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
    const indicatorRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click; lock body scroll while open
    useEffect(() => {
        if (!indicatorOpen) return;
        function handleClick(e: MouseEvent) {
            if (
                indicatorRef.current && !indicatorRef.current.contains(e.target as Node) &&
                dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
            ) {
                setIndicatorOpen(false);
                setIndicatorSearch('');
            }
        }
        document.addEventListener('mousedown', handleClick);
        function preventScroll(e: WheelEvent | TouchEvent) {
            if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) return;
            e.preventDefault();
        }
        document.addEventListener('wheel', preventScroll, { passive: false });
        document.addEventListener('touchmove', preventScroll, { passive: false });
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('wheel', preventScroll);
            document.removeEventListener('touchmove', preventScroll);
        };
    }, [indicatorOpen]);

    // Auto-focus search when dropdown opens
    useEffect(() => {
        if (indicatorOpen) searchInputRef.current?.focus();
    }, [indicatorOpen]);

    const handleAdd = () => {
        if (!newField) return;
        if (newCompare === 'range') {
            const lower = newLowerPct === '' ? undefined : Number(newLowerPct);
            const upper = newUpperPct === '' ? undefined : Number(newUpperPct);
            if (lower == null && upper == null) return;
            onAddAdvancedFilter({ field: newField, compare: 'range', lowerPct: lower, upperPct: upper });
        } else {
            const offset = newLowerPct === '' ? undefined : Number(newLowerPct);
            onAddAdvancedFilter({ field: newField, compare: newCompare, lowerPct: offset });
        }
        setNewField('');
        setNewLowerPct('');
        setNewUpperPct('');
    };

    const formatOffset = (pct: number) => pct >= 0 ? `+${pct}%` : `${pct}%`;

    const getChipLabel = (af: AdvancedFilter): string => {
        const def = ADVANCED_FILTER_DEFS.find(d => d.field === af.field);
        const name = def?.label ?? af.field;
        const offset = af.lowerPct != null ? ` ${formatOffset(af.lowerPct)}` : '';
        if (af.compare === 'above') return `Giá > ${name}${offset}`;
        if (af.compare === 'below') return `Giá < ${name}${offset}`;
        if (af.lowerPct != null && af.upperPct != null) return `${name} ${af.lowerPct}% → +${af.upperPct}%`;
        if (af.lowerPct != null) return `Giá ≥ ${name} ${af.lowerPct}%`;
        if (af.upperPct != null) return `Giá ≤ ${name} +${af.upperPct}%`;
        return name;
    };

    const COMPARE_OPTIONS: { value: AdvancedCompare; label: string; icon: string }[] = [
        { value: 'above', label: 'Lớn hơn', icon: 'solar:arrow-up-bold' },
        { value: 'below', label: 'Nhỏ hơn', icon: 'solar:arrow-down-bold' },
        { value: 'range', label: 'Trong khoảng', icon: 'solar:move-to-folder-bold' },
    ];

    const canAdd = !!newField && (newCompare !== 'range' || newLowerPct !== '' || newUpperPct !== '');

    const filteredDefs = useMemo(() => {
        if (!indicatorSearch) return ADVANCED_FILTER_DEFS;
        const q = indicatorSearch.toLowerCase();
        return ADVANCED_FILTER_DEFS.filter(d => d.label.toLowerCase().includes(q) || d.field.toLowerCase().includes(q));
    }, [indicatorSearch]);

    const smallInputSx = {
        width: 62,
        '& .MuiOutlinedInput-root': {
            borderRadius: `${borderRadius.sm}px`,
            fontSize: getResponsiveFontSize('xs'),
        },
        '& .MuiOutlinedInput-input': { py: 0.45, px: 0.75, fontSize: getResponsiveFontSize('xs'), textAlign: 'center' },
    };

    return (
        <Box sx={{ px: 1.5, pt: 1.5, pb: 1.5 }}>
            {advancedFilters.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
                    {advancedFilters.map(af => (
                        <Chip
                            key={af.field}
                            label={getChipLabel(af)}
                            size="small"
                            onDelete={() => onRemoveAdvancedFilter(af.field)}
                            sx={{
                                fontSize: getResponsiveFontSize('xs'),
                                fontWeight: fontWeight.semibold,
                                height: 24,
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                color: theme.palette.primary.main,
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                '& .MuiChip-deleteIcon': {
                                    fontSize: 13,
                                    color: alpha(theme.palette.primary.main, 0.5),
                                    '&:hover': { color: theme.palette.error.main },
                                },
                            }}
                        />
                    ))}
                    <Chip
                        label="Xóa tất cả"
                        size="small"
                        variant="outlined"
                        onClick={onClearAdvancedFilters}
                        sx={{
                            fontSize: getResponsiveFontSize('xs'),
                            height: 24,
                            color: theme.palette.error.main,
                            borderColor: alpha(theme.palette.error.main, 0.3),
                            cursor: 'pointer',
                            '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.08) },
                        }}
                    />
                </Box>
            )}

            {/* Builder card */}
            <Box sx={{
                border: `1px dashed ${alpha(theme.palette.primary.main, 0.2)}`,
                borderRadius: `${borderRadius.md}px`,
                p: 1.25,
                bgcolor: alpha(theme.palette.primary.main, 0.03),
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
            }}>
                {/* Row 1: GIÁ label + segmented compare */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Box sx={{
                        px: 0.875, py: 0.25,
                        borderRadius: `${borderRadius.sm}px`,
                        bgcolor: alpha(theme.palette.text.primary, 0.06),
                        border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                    }}>
                        <Typography sx={{ fontSize: getResponsiveFontSize('xxs'), fontWeight: fontWeight.bold, color: 'text.secondary', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                            GIÁ
                        </Typography>
                    </Box>
                    <Box sx={{
                        display: 'flex',
                        borderRadius: `${borderRadius.sm}px`,
                        border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                        overflow: 'hidden',
                    }}>
                        {COMPARE_OPTIONS.map((opt, idx) => (
                            <Box
                                key={opt.value}
                                component="button"
                                onClick={() => setNewCompare(opt.value)}
                                sx={{
                                    display: 'flex', alignItems: 'center', gap: 0.4,
                                    px: 0.875, py: 0.4,
                                    border: 'none',
                                    borderLeft: idx > 0 ? `1px solid ${alpha(theme.palette.divider, 0.3)}` : 'none',
                                    bgcolor: newCompare === opt.value ? alpha(theme.palette.primary.main, 0.15) : 'transparent',
                                    color: newCompare === opt.value ? theme.palette.primary.main : theme.palette.text.secondary,
                                    cursor: 'pointer',
                                    fontSize: getResponsiveFontSize('xs'),
                                    fontWeight: newCompare === opt.value ? fontWeight.bold : fontWeight.medium,
                                    transition: `all ${durations.fast} ${easings.easeOut}`,
                                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <Icon icon={opt.icon} width={11} />
                                {opt.label}
                            </Box>
                        ))}
                    </Box>
                </Box>

                {/* Row 2: Indicator + % input + Add */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                    <Box ref={indicatorRef} sx={{ position: 'relative', flex: '1 1 150px', maxWidth: 210 }}>
                        {/* Trigger */}
                        <Box
                            component="button"
                            ref={triggerRef}
                            onClick={() => {
                                if (triggerRef.current) {
                                    const r = triggerRef.current.getBoundingClientRect();
                                    setDropdownPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 220) });
                                }
                                setIndicatorOpen(v => !v);
                                setIndicatorSearch('');
                            }}
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.75,
                                width: '100%',
                                px: 1,
                                py: 0.45,
                                borderRadius: `${borderRadius.sm}px`,
                                border: `1px solid ${newField
                                    ? alpha(theme.palette.primary.main, 0.5)
                                    : alpha(theme.palette.divider, 0.4)
                                }`,
                                bgcolor: newField
                                    ? alpha(theme.palette.primary.main, 0.08)
                                    : 'transparent',
                                color: newField ? theme.palette.primary.main : theme.palette.text.secondary,
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
                                fontWeight: newField ? fontWeight.semibold : fontWeight.medium,
                                color: newField ? theme.palette.primary.main : 'text.disabled',
                                flex: 1,
                                textAlign: 'left',
                                whiteSpace: 'nowrap',
                            }}>
                                {newField ? (ADVANCED_FILTER_DEFS.find(d => d.field === newField)?.label ?? newField) : 'Chọn chỉ báo'}
                            </Typography>
                            <Icon
                                icon="solar:alt-arrow-down-bold"
                                width={12}
                                style={{
                                    transform: indicatorOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: `transform ${durations.fast} ${easings.easeOut}`,
                                }}
                            />
                        </Box>

                        {/* Dropdown — rendered via portal to escape stacking contexts */}
                        {indicatorOpen && dropdownPos && createPortal(
                            <Box ref={dropdownRef} sx={{
                                position: 'fixed',
                                top: dropdownPos.top,
                                left: dropdownPos.left,
                                width: dropdownPos.width,
                                zIndex: 9999,
                                maxHeight: 350,
                                overflowY: 'auto',
                                borderRadius: `${borderRadius.lg}px`,
                                ...getGlassCard(isDark),
                                boxShadow: isDark
                                    ? '0 8px 32px rgba(0,0,0,0.5)'
                                    : '0 8px 24px rgba(0,0,0,0.12)',
                                animation: `ddFadeIn2 ${durations.fast} ${easings.easeOut}`,
                                '@keyframes ddFadeIn2': {
                                    from: { opacity: 0, transform: 'translateY(-6px)' },
                                    to: { opacity: 1, transform: 'translateY(0)' },
                                },
                                '&::-webkit-scrollbar': { width: 4 },
                                '&::-webkit-scrollbar-track': { background: 'transparent' },
                                '&::-webkit-scrollbar-thumb': { background: alpha(theme.palette.divider, 0.4), borderRadius: 2 },
                            }}>
                                {/* Search input */}
                                <Box sx={{ p: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                                    <Box
                                        component="input"
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Tìm chỉ báo..."
                                        value={indicatorSearch}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIndicatorSearch(e.target.value)}
                                        onKeyDown={(e: React.KeyboardEvent) => {
                                            if (e.key === 'Enter' && filteredDefs.length > 0) {
                                                setNewField(filteredDefs[0].field);
                                                setIndicatorOpen(false);
                                                setIndicatorSearch('');
                                            }
                                        }}
                                        sx={{
                                            width: '100%',
                                            bgcolor: 'transparent',
                                            border: 'none',
                                            outline: 'none',
                                            color: 'text.primary',
                                            fontSize: getResponsiveFontSize('xs'),
                                            fontFamily: 'inherit',
                                            '&::placeholder': {
                                                color: 'text.secondary',
                                                opacity: 0.7,
                                            },
                                        }}
                                    />
                                </Box>

                                {/* Grouped items */}
                                {ADVANCED_FILTER_GROUPS.map(group => {
                                    const groupDefs = filteredDefs.filter(d => d.group === group.key);
                                    if (groupDefs.length === 0) return null;
                                    return (
                                        <Box key={group.key}>
                                            <Typography sx={{
                                                fontSize: getResponsiveFontSize('xxs'),
                                                fontWeight: fontWeight.bold,
                                                color: 'text.secondary',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                px: 1.5,
                                                pt: 1,
                                                pb: 0.25,
                                            }}>
                                                {group.label}
                                            </Typography>
                                            {groupDefs.map(d => {
                                                const isActive = newField === d.field;
                                                return (
                                                    <Box
                                                        key={d.field}
                                                        component="button"
                                                        onClick={() => {
                                                            setNewField(d.field);
                                                            setIndicatorOpen(false);
                                                            setIndicatorSearch('');
                                                        }}
                                                        sx={{
                                                            display: 'block',
                                                            width: '100%',
                                                            textAlign: 'left',
                                                            background: isActive
                                                                ? isDark ? alpha(theme.palette.primary.main, 0.15) : alpha(theme.palette.primary.main, 0.08)
                                                                : 'transparent',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            px: 2,
                                                            py: 0.75,
                                                            transition: `background ${durations.fastest}`,
                                                            '&:hover': {
                                                                background: isDark ? alpha('#fff', 0.06) : alpha('#000', 0.04),
                                                            },
                                                        }}
                                                    >
                                                        <Typography sx={{
                                                            fontSize: getResponsiveFontSize('xs'),
                                                            fontWeight: isActive ? fontWeight.semibold : fontWeight.medium,
                                                            color: isActive ? theme.palette.primary.main : theme.palette.text.primary,
                                                            lineHeight: 1.4,
                                                        }}>
                                                            {d.label}
                                                        </Typography>
                                                    </Box>
                                                );
                                            })}
                                        </Box>
                                    );
                                })}
                            </Box>
                        , document.body)}
                    </Box>

                    {/* % offset inputs */}
                    <Box sx={{
                        display: 'flex', alignItems: 'center', gap: 0.4,
                        px: 0.875, py: 0.35,
                        borderRadius: `${borderRadius.sm}px`,
                        border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                        bgcolor: alpha(theme.palette.background.paper, 0.5),
                    }}>
                        <Typography sx={{ fontSize: getResponsiveFontSize('xxs'), color: 'text.disabled', mr: 0.25 }}>±%</Typography>
                        <TextField
                            size="small"
                            placeholder={newCompare === 'range' ? '−%' : '%'}
                            type="number"
                            value={newLowerPct}
                            onChange={(e) => setNewLowerPct(e.target.value)}
                            sx={smallInputSx}
                            inputProps={{ style: { textAlign: 'center' } }}
                        />
                        {newCompare === 'range' && (
                            <>
                                <Typography sx={{ fontSize: getResponsiveFontSize('xxs'), color: 'text.disabled' }}>→</Typography>
                                <TextField
                                    size="small"
                                    placeholder="+%"
                                    type="number"
                                    value={newUpperPct}
                                    onChange={(e) => setNewUpperPct(e.target.value)}
                                    sx={smallInputSx}
                                    inputProps={{ style: { textAlign: 'center' } }}
                                />
                            </>
                        )}
                    </Box>

                    <Tooltip title={canAdd ? 'Thêm điều kiện' : 'Chọn chỉ báo'}>
                        <span>
                            <Box
                                component="button"
                                onClick={handleAdd}
                                disabled={!canAdd}
                                sx={{
                                    display: 'flex', alignItems: 'center', gap: 0.4,
                                    px: 1.125, py: 0.5,
                                    border: 'none',
                                    borderRadius: `${borderRadius.sm}px`,
                                    bgcolor: canAdd ? theme.palette.primary.main : alpha(theme.palette.text.disabled, 0.1),
                                    color: canAdd ? '#fff' : theme.palette.text.disabled,
                                    cursor: canAdd ? 'pointer' : 'not-allowed',
                                    fontSize: getResponsiveFontSize('xs'),
                                    fontWeight: fontWeight.semibold,
                                    transition: `all ${durations.fast} ${easings.easeOut}`,
                                    '&:hover:not(:disabled)': { opacity: 0.88 },
                                    flexShrink: 0,
                                }}
                            >
                                <Icon icon="solar:add-square-bold" width={14} />
                                Thêm
                            </Box>
                        </span>
                    </Tooltip>
                </Box>
            </Box>
        </Box>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdvancedFilterPanel({
    rangeFilters,
    advancedFilters,
    selectFilters,
    showDetail,
    showIndicator,
    onSetRangeFilter,
    onClearRangeFilter,
    onAddAdvancedFilter,
    onRemoveAdvancedFilter,
    onClearAdvancedFilters,
    onSetSelectFilter,
    onClearSelectFilter,
}: AdvancedFilterPanelProps) {
    const theme = useTheme();

    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

    const handleToggle = (key: string) => {
        setOpenGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const rangeGroups = useMemo(() => {
        const groups = new Map<string, RangeFilterDef[]>();
        for (const def of RANGE_FILTER_DEFS) {
            if (!groups.has(def.group)) groups.set(def.group, []);
            groups.get(def.group)!.push(def);
        }
        return groups;
    }, []);

    const getActiveCount = (groupKey: string): number => {
        if (groupKey === 'zones') {
            return ZONE_FILTER_DEFS.filter(d => (selectFilters[d.field] ?? []).length > 0).length;
        }
        const defs = rangeGroups.get(groupKey);
        if (!defs) return 0;
        return defs.filter(d => { const r = rangeFilters[d.field]; return r && (r.min != null || r.max != null); }).length;
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* ── Zone 1: Lọc chi tiết (range + zone accordions) ── */}
            <Collapse in={showDetail} timeout={220}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {ACCORDION_GROUPS.map(group => {
                        const isOpen = openGroups.has(group.key);
                        const activeCount = getActiveCount(group.key);
                        const paletteColor = group.color.startsWith('#')
                            ? group.color
                            : (theme.palette as Record<string, any>)[group.color]?.main ?? theme.palette.primary.main;

                        return (
                            <Box
                                key={group.key}
                                sx={{
                                    borderRadius: `${borderRadius.md}px`,
                                    border: `1px solid ${isOpen ? alpha(paletteColor, 0.2) : alpha(theme.palette.divider, 0.15)}`,
                                    overflow: 'hidden',
                                    transition: `border-color ${durations.fast} ${easings.easeOut}`,
                                }}
                            >
                                <AccordionHeader
                                    group={group}
                                    isOpen={isOpen}
                                    activeCount={activeCount}
                                    onClick={() => handleToggle(group.key)}
                                />
                                <Collapse in={isOpen} timeout={200}>
                                    {group.key === 'zones' ? (
                                        <ZoneFilterSection
                                            selectFilters={selectFilters}
                                            onSetSelectFilter={onSetSelectFilter}
                                            onClearSelectFilter={onClearSelectFilter}
                                        />
                                    ) : (
                                        <Box sx={{
                                            px: 1.5, pb: 1.25,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 0.25,
                                        }}>
                                            {(rangeGroups.get(group.key) ?? []).map(def => (
                                                <SliderRangeRow
                                                    key={def.field}
                                                    def={def}
                                                    current={rangeFilters[def.field]}
                                                    onSet={onSetRangeFilter}
                                                    onClear={onClearRangeFilter}
                                                    accentColor={paletteColor}
                                                />
                                            ))}
                                        </Box>
                                    )}
                                </Collapse>
                            </Box>
                        );
                    })}
                </Box>
            </Collapse>

            {/* ── Zone 2: Lọc nâng cao (indicator builder) ── */}
            <Collapse in={showIndicator} timeout={220}>
                <Box sx={{
                    borderRadius: `${borderRadius.md}px`,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                    overflow: 'visible',
                }}>
                    <IndicatorSection
                        advancedFilters={advancedFilters}
                        onAddAdvancedFilter={onAddAdvancedFilter}
                        onRemoveAdvancedFilter={onRemoveAdvancedFilter}
                        onClearAdvancedFilters={onClearAdvancedFilters}
                    />
                </Box>
            </Collapse>
        </Box>
    );
}
