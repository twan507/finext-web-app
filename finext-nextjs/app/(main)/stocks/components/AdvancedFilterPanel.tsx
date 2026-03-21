'use client';

import { useState } from 'react';
import { Box, Typography, TextField, Chip, useTheme, alpha, Divider, Select, MenuItem, FormControl, InputLabel, IconButton, Tooltip } from '@mui/material';
import { Icon } from '@iconify/react';
import { getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import type { RangeFilter, AdvancedFilter } from 'hooks/useScreenerStore';
import { ADVANCED_FILTER_DEFS, ADVANCED_FILTER_GROUPS, type AdvancedCompare } from '../screenerConfig';

interface AdvancedFilterPanelProps {
    rangeFilters: Record<string, RangeFilter>;
    advancedFilters: AdvancedFilter[];
    onSetRangeFilter: (field: string, range: RangeFilter) => void;
    onClearRangeFilter: (field: string) => void;
    onAddAdvancedFilter: (filter: AdvancedFilter) => void;
    onRemoveAdvancedFilter: (field: string) => void;
    onClearAdvancedFilters: () => void;
}

// Range filter definitions
const RANGE_FILTER_DEFS = [
    { field: 'close', label: 'Giá (×1000 VND)', group: 'Giá', multiplier: 1 },
    { field: 'pct_change', label: '% Phiên', group: 'Giá', isPct: true },
    { field: 'w_pct', label: '% Tuần', group: '% Thay đổi', isPct: true },
    { field: 'm_pct', label: '% Tháng', group: '% Thay đổi', isPct: true },
    { field: 'q_pct', label: '% Quý', group: '% Thay đổi', isPct: true },
    { field: 'y_pct', label: '% Năm', group: '% Thay đổi', isPct: true },
    { field: 'volume', label: 'Khối lượng', group: 'KL & Thanh khoản' },
    { field: 'trading_value', label: 'GTGD', group: 'KL & Thanh khoản' },
    { field: 'cap_value', label: 'Vốn hóa TT', group: 'KL & Thanh khoản' },
    { field: 'vsi', label: 'VSI', group: 'KL & Thanh khoản' },
    { field: 't0_score', label: 'T0 Score', group: 'Dòng tiền' },
    { field: 't5_score', label: 'T5 Score', group: 'Dòng tiền' },
    { field: 'market_rank_pct', label: 'Rank TT (%)', group: 'Dòng tiền', isPct: true },
    { field: 'industry_rank_pct', label: 'Rank Ngành (%)', group: 'Dòng tiền', isPct: true },
];

export default function AdvancedFilterPanel({
    rangeFilters,
    advancedFilters,
    onSetRangeFilter,
    onClearRangeFilter,
    onAddAdvancedFilter,
    onRemoveAdvancedFilter,
    onClearAdvancedFilters,
}: AdvancedFilterPanelProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    // State for adding new indicator filter
    const [newFilterField, setNewFilterField] = useState('');
    const [newFilterCompare, setNewFilterCompare] = useState<AdvancedCompare>('above');

    const handleAddAdvancedFilter = () => {
        if (!newFilterField) return;
        onAddAdvancedFilter({ field: newFilterField, compare: newFilterCompare });
        setNewFilterField('');
    };

    // Group range filter defs
    const rangeGroups = new Map<string, typeof RANGE_FILTER_DEFS>();
    for (const def of RANGE_FILTER_DEFS) {
        if (!rangeGroups.has(def.group)) rangeGroups.set(def.group, []);
        rangeGroups.get(def.group)!.push(def);
    }

    return (
        <Box>
            {/* Range Filters */}
            <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.bold, color: 'text.secondary', mb: 1 }}>
                Lọc theo khoảng giá trị
            </Typography>

            {Array.from(rangeGroups.entries()).map(([groupLabel, defs]) => (
                <Box key={groupLabel} sx={{ mb: 1.5 }}>
                    <Typography sx={{ fontSize: getResponsiveFontSize('xxs'), fontWeight: fontWeight.bold, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.5 }}>
                        {groupLabel}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {defs.map(def => {
                            const current = rangeFilters[def.field];
                            return (
                                <Box key={def.field} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography sx={{ fontSize: getResponsiveFontSize('xxs'), color: 'text.secondary', minWidth: 65, textAlign: 'right' }}>
                                        {def.label}:
                                    </Typography>
                                    <TextField
                                        size="small"
                                        placeholder="Min"
                                        type="number"
                                        value={current?.min ?? ''}
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? null : Number(e.target.value);
                                            const raw = def.isPct && val != null ? val / 100 : val;
                                            onSetRangeFilter(def.field, { min: raw, max: current?.max ?? null });
                                        }}
                                        sx={{
                                            width: 80,
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: `${borderRadius.sm}px`,
                                                fontSize: getResponsiveFontSize('xxs'),
                                            },
                                            '& .MuiOutlinedInput-input': { py: 0.5, px: 0.75 },
                                        }}
                                    />
                                    <Typography sx={{ fontSize: getResponsiveFontSize('xxs'), color: 'text.disabled' }}>—</Typography>
                                    <TextField
                                        size="small"
                                        placeholder="Max"
                                        type="number"
                                        value={current?.max ?? ''}
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? null : Number(e.target.value);
                                            const raw = def.isPct && val != null ? val / 100 : val;
                                            onSetRangeFilter(def.field, { min: current?.min ?? null, max: raw });
                                        }}
                                        sx={{
                                            width: 80,
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: `${borderRadius.sm}px`,
                                                fontSize: getResponsiveFontSize('xxs'),
                                            },
                                            '& .MuiOutlinedInput-input': { py: 0.5, px: 0.75 },
                                        }}
                                    />
                                    {current && (
                                        <IconButton size="small" onClick={() => onClearRangeFilter(def.field)} sx={{ p: 0.25 }}>
                                            <Icon icon="solar:close-circle-bold" width={14} />
                                        </IconButton>
                                    )}
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            ))}

            <Divider sx={{ my: 2 }} />

            {/* Technical Indicator Filters (Price vs Indicator) */}
            <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.bold, color: 'text.secondary', mb: 1 }}>
                So sánh Giá với chỉ báo kỹ thuật
            </Typography>

            {/* Active indicator filters */}
            {advancedFilters.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
                    {advancedFilters.map(af => {
                        const def = ADVANCED_FILTER_DEFS.find(d => d.field === af.field);
                        return (
                            <Chip
                                key={af.field}
                                label={`Giá ${af.compare === 'above' ? '>' : '<'} ${def?.label ?? af.field}`}
                                size="small"
                                onDelete={() => onRemoveAdvancedFilter(af.field)}
                                sx={{
                                    fontSize: getResponsiveFontSize('xxs'),
                                    fontWeight: fontWeight.semibold,
                                    height: 24,
                                    bgcolor: alpha(theme.palette.info.main, 0.12),
                                    color: theme.palette.info.main,
                                    '& .MuiChip-deleteIcon': { fontSize: 14, color: theme.palette.info.main },
                                }}
                            />
                        );
                    })}
                    <Chip
                        label="Xóa tất cả"
                        size="small"
                        onClick={onClearAdvancedFilters}
                        sx={{
                            fontSize: getResponsiveFontSize('xxs'),
                            height: 24,
                            color: theme.palette.error.main,
                            border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                            cursor: 'pointer',
                        }}
                    />
                </Box>
            )}

            {/* Add new indicator filter */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary' }}>Giá</Typography>

                <FormControl size="small" sx={{ minWidth: 90 }}>
                    <Select
                        value={newFilterCompare}
                        onChange={(e) => setNewFilterCompare(e.target.value as AdvancedCompare)}
                        sx={{
                            fontSize: getResponsiveFontSize('xs'),
                            borderRadius: `${borderRadius.sm}px`,
                            '& .MuiSelect-select': { py: 0.5 },
                        }}
                    >
                        <MenuItem value="above" sx={{ fontSize: getResponsiveFontSize('xs') }}>lớn hơn</MenuItem>
                        <MenuItem value="below" sx={{ fontSize: getResponsiveFontSize('xs') }}>nhỏ hơn</MenuItem>
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel sx={{ fontSize: getResponsiveFontSize('xs') }}>Chỉ báo</InputLabel>
                    <Select
                        value={newFilterField}
                        onChange={(e) => setNewFilterField(e.target.value)}
                        label="Chỉ báo"
                        sx={{
                            fontSize: getResponsiveFontSize('xs'),
                            borderRadius: `${borderRadius.sm}px`,
                            '& .MuiSelect-select': { py: 0.5 },
                        }}
                        MenuProps={{ PaperProps: { sx: { maxHeight: 350 } } }}
                    >
                        {ADVANCED_FILTER_GROUPS.map(group => [
                            <MenuItem key={`group-${group.key}`} disabled sx={{ fontSize: getResponsiveFontSize('xxs'), fontWeight: fontWeight.bold, color: 'text.secondary', textTransform: 'uppercase' }}>
                                {group.label}
                            </MenuItem>,
                            ...ADVANCED_FILTER_DEFS
                                .filter(d => d.group === group.key)
                                .map(d => (
                                    <MenuItem key={d.field} value={d.field} sx={{ fontSize: getResponsiveFontSize('xs'), pl: 3 }}>
                                        {d.label}
                                    </MenuItem>
                                )),
                        ]).flat()}
                    </Select>
                </FormControl>

                <Tooltip title="Thêm bộ lọc">
                    <IconButton
                        size="small"
                        onClick={handleAddAdvancedFilter}
                        disabled={!newFilterField}
                        sx={{
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: theme.palette.primary.main,
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) },
                            '&:disabled': { opacity: 0.5 },
                        }}
                    >
                        <Icon icon="solar:add-circle-bold" width={20} />
                    </IconButton>
                </Tooltip>
            </Box>
        </Box>
    );
}
