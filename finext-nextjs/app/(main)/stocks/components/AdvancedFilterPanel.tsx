'use client';

import { useState, useMemo } from 'react';
import { Box, Typography, TextField, Chip, useTheme, alpha, Select, MenuItem, FormControl, InputLabel, IconButton, Tooltip, Collapse } from '@mui/material';
import { Icon } from '@iconify/react';
import { getResponsiveFontSize, fontWeight, borderRadius, durations, easings } from 'theme/tokens';
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
}

const RANGE_FILTER_DEFS: RangeFilterDef[] = [
    { field: 'close',            label: 'Giá',              group: 'price',    unit: '×1000đ' },
    { field: 'pct_change',       label: '% Phiên',          group: 'price',    unit: '%',     isPct: true },
    { field: 'w_pct',            label: '% Tuần',           group: 'change',   unit: '%',     isPct: true },
    { field: 'm_pct',            label: '% Tháng',          group: 'change',   unit: '%',     isPct: true },
    { field: 'q_pct',            label: '% Quý',            group: 'change',   unit: '%',     isPct: true },
    { field: 'y_pct',            label: '% Năm',            group: 'change',   unit: '%',     isPct: true },
    { field: 'volume',           label: 'Khối lượng',       group: 'volume',   unit: 'CP' },
    { field: 'trading_value',    label: 'GTGD',             group: 'volume',   unit: 'Tỷ',   scaleTo: 1e9 },
    { field: 'cap_value',        label: 'Vốn hóa TT',      group: 'volume',   unit: 'Tỷ',   scaleTo: 1e9 },
    { field: 'vsi',              label: 'Chỉ số TK',        group: 'volume',   unit: '%' },
    { field: 't0_score',         label: 'T0 Score',         group: 'cashflow', unit: 'điểm' },
    { field: 't5_score',         label: 'T5 Score',         group: 'cashflow', unit: 'điểm' },
    { field: 'market_rank_pct',  label: 'Rank TT',          group: 'cashflow', unit: '%',     isPct: true },
    { field: 'industry_rank_pct',label: 'Rank Ngành',       group: 'cashflow', unit: '%',     isPct: true },
];

// ─── Zone filter definitions ─────────────────────────────────────────────────

const ZONE_VALUES = ['AAA', 'AA', 'A', 'B', 'C'] as const;
type ZoneValue = typeof ZONE_VALUES[number];

const ZONE_CHIP_COLORS: Record<ZoneValue, string> = {
    AAA: '#22c55e',
    AA:  '#86efac',
    A:   '#facc15',
    B:   '#f97316',
    C:   '#ef4444',
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

const ZONE_SUBGROUPS = ['Tổng hợp', 'MA Zone', 'Fibo Zone', 'VP Zone'];

// ─── Accordion group config ──────────────────────────────────────────────────

interface AccordionGroupConfig {
    key: string;
    label: string;
    icon: string;
    color: string;
}

// Detail accordion groups only (indicator is a separate zone)
const ACCORDION_GROUPS: AccordionGroupConfig[] = [
    { key: 'price',    label: 'Giá',              icon: 'solar:tag-price-bold-duotone', color: 'success' },
    { key: 'change',   label: '% Thay đổi',       icon: 'solar:chart-bold-duotone',     color: 'warning' },
    { key: 'volume',   label: 'KL & Thanh khoản', icon: 'solar:graph-up-bold-duotone',  color: 'secondary' },
    { key: 'cashflow', label: 'Dòng tiền',        icon: 'solar:dollar-bold-duotone',    color: 'info' },
    { key: 'zones',    label: 'Vùng giá kỹ thuật',icon: 'solar:layers-bold-duotone',    color: 'warning' },
];

// ─── Compact Range Input ─────────────────────────────────────────────────────

function CompactRangeInput({
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
    const hasValue = current != null && (current.min != null || current.max != null);

    const toDisplay = (stored: number | null) => {
        if (stored == null) return '';
        if (def.isPct) return stored * 100;
        if (def.scaleTo) return stored / def.scaleTo;
        return stored;
    };

    const toStore = (display: string): number | null => {
        if (display === '') return null;
        const val = Number(display);
        if (def.isPct) return val / 100;
        if (def.scaleTo) return val * def.scaleTo;
        return val;
    };

    const inputSx = {
        width: { xs: 60, sm: 68 },
        '& .MuiOutlinedInput-root': {
            borderRadius: `${borderRadius.sm}px`,
            fontSize: '0.7rem',
            transition: `border-color ${durations.fast} ${easings.easeOut}`,
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: accentColor,
                borderWidth: 1.5,
            },
        },
        '& .MuiOutlinedInput-input': {
            py: 0.45,
            px: 0.75,
            textAlign: 'center',
            '&::placeholder': { opacity: 0.35, fontSize: '0.68rem' },
        },
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.4 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25, minWidth: { xs: 72, sm: 82 }, justifyContent: 'flex-end' }}>
                <Typography sx={{
                    fontSize: '0.7rem',
                    color: hasValue ? accentColor : 'text.secondary',
                    fontWeight: hasValue ? fontWeight.semibold : fontWeight.medium,
                    transition: `color ${durations.fast} ${easings.easeOut}`,
                    whiteSpace: 'nowrap',
                }}>
                    {def.label}
                </Typography>
                {def.unit && (
                    <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', whiteSpace: 'nowrap' }}>
                        ({def.unit})
                    </Typography>
                )}
            </Box>
            <TextField
                size="small"
                placeholder="Min"
                type="number"
                value={toDisplay(current?.min ?? null)}
                onChange={(e) => onSet(def.field, { min: toStore(e.target.value), max: current?.max ?? null })}
                sx={inputSx}
            />
            <Box sx={{ width: 10, height: 1, bgcolor: alpha(theme.palette.divider, 0.5), borderRadius: 1, flexShrink: 0 }} />
            <TextField
                size="small"
                placeholder="Max"
                type="number"
                value={toDisplay(current?.max ?? null)}
                onChange={(e) => onSet(def.field, { min: current?.min ?? null, max: toStore(e.target.value) })}
                sx={inputSx}
            />
            {hasValue && (
                <IconButton
                    size="small"
                    onClick={() => onClear(def.field)}
                    sx={{
                        p: 0.2,
                        color: alpha(theme.palette.text.secondary, 0.4),
                        '&:hover': { color: theme.palette.error.main },
                    }}
                >
                    <Icon icon="solar:close-circle-bold" width={13} />
                </IconButton>
            )}
        </Box>
    );
}

// ─── Zone Filter Section ─────────────────────────────────────────────────────

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

    const toggleZone = (field: string, value: ZoneValue) => {
        const current = selectFilters[field] ?? [];
        if (current.includes(value)) {
            const next = current.filter(v => v !== value);
            if (next.length === 0) onClearSelectFilter(field);
            else onSetSelectFilter(field, next);
        } else {
            onSetSelectFilter(field, [...current, value]);
        }
    };

    return (
        <Box sx={{ px: 1.5, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {ZONE_SUBGROUPS.map(subgroup => {
                const defs = ZONE_FILTER_DEFS.filter(d => d.subgroup === subgroup);
                return (
                    <Box key={subgroup}>
                        <Typography sx={{
                            fontSize: '0.6rem',
                            fontWeight: fontWeight.bold,
                            color: 'text.disabled',
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                            mb: 0.5,
                        }}>
                            {subgroup}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                            {defs.map(def => {
                                const selected = selectFilters[def.field] ?? [];
                                const hasAny = selected.length > 0;
                                return (
                                    <Box key={def.field} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                        <Typography sx={{
                                            fontSize: '0.7rem',
                                            color: hasAny ? theme.palette.warning.main : 'text.secondary',
                                            fontWeight: hasAny ? fontWeight.semibold : fontWeight.medium,
                                            minWidth: 46,
                                            textAlign: 'right',
                                            transition: `color ${durations.fast} ${easings.easeOut}`,
                                        }}>
                                            {def.label}
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                                            {ZONE_VALUES.map(val => {
                                                const isSelected = selected.includes(val);
                                                const chipColor = ZONE_CHIP_COLORS[val];
                                                return (
                                                    <Box
                                                        key={val}
                                                        component="button"
                                                        onClick={() => toggleZone(def.field, val)}
                                                        sx={{
                                                            px: 0.75,
                                                            py: 0.25,
                                                            border: `1px solid ${isSelected ? chipColor : alpha(theme.palette.divider, 0.3)}`,
                                                            borderRadius: `${borderRadius.pill}px`,
                                                            bgcolor: isSelected ? alpha(chipColor, 0.18) : 'transparent',
                                                            color: isSelected ? chipColor : theme.palette.text.disabled,
                                                            cursor: 'pointer',
                                                            fontSize: '0.65rem',
                                                            fontWeight: isSelected ? fontWeight.bold : fontWeight.medium,
                                                            transition: `all ${durations.fast} ${easings.easeOut}`,
                                                            '&:hover': {
                                                                bgcolor: alpha(chipColor, 0.12),
                                                                borderColor: chipColor,
                                                                color: chipColor,
                                                            },
                                                        }}
                                                    >
                                                        {val}
                                                    </Box>
                                                );
                                            })}
                                            {hasAny && (
                                                <Box
                                                    component="button"
                                                    onClick={() => onClearSelectFilter(def.field)}
                                                    sx={{
                                                        px: 0.5,
                                                        py: 0.25,
                                                        border: 'none',
                                                        bgcolor: 'transparent',
                                                        color: alpha(theme.palette.text.secondary, 0.4),
                                                        cursor: 'pointer',
                                                        fontSize: '0.65rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        '&:hover': { color: theme.palette.error.main },
                                                    }}
                                                >
                                                    <Icon icon="solar:close-circle-bold" width={12} />
                                                </Box>
                                            )}
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
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
    const paletteColor = (theme.palette as Record<string, any>)[group.color]?.main ?? theme.palette.primary.main;

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
                    fontSize: '0.6rem',
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

    const [newField, setNewField] = useState('');
    const [newCompare, setNewCompare] = useState<AdvancedCompare>('above');
    const [newLowerPct, setNewLowerPct] = useState('');
    const [newUpperPct, setNewUpperPct] = useState('');

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

    const selectSx = {
        fontSize: getResponsiveFontSize('xs'),
        borderRadius: `${borderRadius.sm}px`,
        '& .MuiSelect-select': { py: 0.6 },
    };

    const smallInputSx = {
        width: 62,
        '& .MuiOutlinedInput-root': {
            borderRadius: `${borderRadius.sm}px`,
            fontSize: '0.7rem',
        },
        '& .MuiOutlinedInput-input': { py: 0.5, px: 0.75, textAlign: 'center' },
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
                                fontSize: '0.68rem',
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
                            fontSize: '0.68rem',
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
                        <Typography sx={{ fontSize: '0.65rem', fontWeight: fontWeight.bold, color: 'text.secondary', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
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
                                    fontSize: '0.68rem',
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
                    <FormControl size="small" sx={{ flex: '1 1 150px', maxWidth: 210 }}>
                        <InputLabel sx={{ fontSize: '0.72rem' }}>Chỉ báo</InputLabel>
                        <Select
                            value={newField}
                            onChange={(e) => setNewField(e.target.value)}
                            label="Chỉ báo"
                            sx={selectSx}
                            MenuProps={{ PaperProps: { sx: { maxHeight: 350 } } }}
                        >
                            {ADVANCED_FILTER_GROUPS.map(group => [
                                <MenuItem key={`group-${group.key}`} disabled sx={{
                                    fontSize: '0.65rem',
                                    fontWeight: fontWeight.bold,
                                    color: 'text.secondary',
                                    textTransform: 'uppercase',
                                    opacity: '1 !important',
                                    letterSpacing: '0.5px',
                                }}>
                                    {group.label}
                                </MenuItem>,
                                ...ADVANCED_FILTER_DEFS.filter(d => d.group === group.key).map(d => (
                                    <MenuItem key={d.field} value={d.field} sx={{ fontSize: getResponsiveFontSize('xs'), pl: 3 }}>
                                        {d.label}
                                    </MenuItem>
                                )),
                            ]).flat()}
                        </Select>
                    </FormControl>

                    {/* % offset inputs */}
                    <Box sx={{
                        display: 'flex', alignItems: 'center', gap: 0.4,
                        px: 0.875, py: 0.35,
                        borderRadius: `${borderRadius.sm}px`,
                        border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                        bgcolor: alpha(theme.palette.background.paper, 0.5),
                    }}>
                        <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', mr: 0.25 }}>±%</Typography>
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
                                <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>→</Typography>
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
                                    fontSize: '0.72rem',
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
                        const paletteColor = (theme.palette as Record<string, any>)[group.color]?.main ?? theme.palette.primary.main;

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
                                            display: 'grid',
                                            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                            gap: 0,
                                        }}>
                                            {(rangeGroups.get(group.key) ?? []).map(def => (
                                                <CompactRangeInput
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
                    overflow: 'hidden',
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
