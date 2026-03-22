'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Box, Typography, useTheme, alpha, TextField, InputAdornment, Pagination, Tooltip } from '@mui/material';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';
import { getResponsiveFontSize, fontWeight, borderRadius, getGlassCard, durations, easings } from 'theme/tokens';
import { useSseCache } from 'hooks/useSseCache';
import useScreenerStore from 'hooks/useScreenerStore';
import type { RangeFilter, AdvancedFilter } from 'hooks/useScreenerStore';
import FilterBar from './components/FilterBar';
import AdvancedFilterPanel from './components/AdvancedFilterPanel';
import TableViewSelector from './components/TableViewSelector';
import ResultTable from './components/ResultTable';
import ColumnCustomizer from './components/ColumnCustomizer';
import { FILTER_PRESETS, COLUMN_MAP } from './screenerConfig';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScreenerMeta {
    exchange: string[];
    industry_name: string[];
    marketcap_name: string[];
    category_name: string[];
}

// ─── Client-side filter engine ───────────────────────────────────────────────

function applyFilters(
    data: Record<string, any>[],
    selectFilters: Record<string, string[]>,
    rangeFilters: Record<string, RangeFilter>,
    advancedFilters: AdvancedFilter[],
    searchQuery: string,
): Record<string, any>[] {
    let result = data;

    if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        result = result.filter(row =>
            (row.ticker && String(row.ticker).toLowerCase().includes(q)) ||
            (row.ticker_name && String(row.ticker_name).toLowerCase().includes(q))
        );
    }

    for (const [field, values] of Object.entries(selectFilters)) {
        if (values.length === 0) continue;
        result = result.filter(row => values.includes(String(row[field] ?? '')));
    }

    for (const [field, range] of Object.entries(rangeFilters)) {
        if (range.min != null) {
            result = result.filter(row => {
                const v = row[field];
                return typeof v === 'number' && v >= (range.min as number);
            });
        }
        if (range.max != null) {
            result = result.filter(row => {
                const v = row[field];
                return typeof v === 'number' && v <= (range.max as number);
            });
        }
    }

    for (const af of advancedFilters) {
        result = result.filter(row => {
            const price = row.close;
            const indicatorVal = row[af.field];
            if (typeof price !== 'number' || typeof indicatorVal !== 'number') return false;
            if (af.compare === 'above') {
                const threshold = af.lowerPct != null ? indicatorVal * (1 + af.lowerPct / 100) : indicatorVal;
                return price > threshold;
            }
            if (af.compare === 'below') {
                const threshold = af.lowerPct != null ? indicatorVal * (1 + af.lowerPct / 100) : indicatorVal;
                return price < threshold;
            }
            // range mode: price within [indicator*(1+lowerPct/100), indicator*(1+upperPct/100)]
            const lower = af.lowerPct != null ? indicatorVal * (1 + af.lowerPct / 100) : null;
            const upper = af.upperPct != null ? indicatorVal * (1 + af.upperPct / 100) : null;
            if (lower != null && price < lower) return false;
            if (upper != null && price > upper) return false;
            return lower != null || upper != null; // at least one bound must be set
        });
    }

    return result;
}

function applySorting(data: Record<string, any>[], sortField: string, sortOrder: 'asc' | 'desc'): Record<string, any>[] {
    // Empty sortField = default: sort A→Z by ticker, no column highlighted
    const field = sortField || 'ticker';
    const order = sortField ? sortOrder : 'asc';

    return [...data].sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        const diff = (aVal as number) - (bVal as number);
        return order === 'asc' ? diff : -diff;
    });
}

// ─── Preset Chip ─────────────────────────────────────────────────────────────

interface PresetChipProps {
    preset: typeof FILTER_PRESETS[0];
    active: boolean;
    onClick: () => void;
    isDark: boolean;
    theme: any;
}

function PresetChip({ preset, active, onClick, isDark, theme }: PresetChipProps) {
    return (
        <Tooltip
            title={preset.description}
            placement="bottom"
            slotProps={{
                tooltip: {
                    sx: {
                        bgcolor: isDark ? alpha('#1a1a2e', 0.95) : alpha('#fff', 0.97),
                        color: isDark ? alpha('#fff', 0.85) : alpha('#000', 0.75),
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: getResponsiveFontSize('xs'),
                        px: 1.25,
                        py: 0.6,
                        boxShadow: isDark
                            ? '0 4px 16px rgba(0,0,0,0.5)'
                            : '0 4px 16px rgba(0,0,0,0.12)',
                        backdropFilter: 'blur(8px)',
                    },
                },
                arrow: { sx: { color: isDark ? alpha('#1a1a2e', 0.95) : alpha('#fff', 0.97) } },
            }}
            arrow
        >
        <Box
            component="button"
            onClick={onClick}
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
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
                color: active ? theme.palette.primary.main : theme.palette.text.secondary,
                cursor: 'pointer',
                background: 'none',
                fontSize: getResponsiveFontSize('xs'),
                fontWeight: active ? fontWeight.bold : fontWeight.medium,
                transition: `all ${durations.fast} ${easings.easeOut}`,
                '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    borderColor: alpha(theme.palette.primary.main, 0.3),
                },
            }}
        >
            <Icon icon={preset.iconifyIcon} width={14} />
            {preset.label}
        </Box>
        </Tooltip>
    );
}

// ─── Page-size Glass Dropdown (no portal) ────────────────────────────────────

const PAGE_SIZE_OPTIONS = [
    { value: 20, label: '20 hàng' },
    { value: 50, label: '50 hàng' },
    { value: 100, label: '100 hàng' },
    { value: 0, label: 'Tất cả' },
];

function PageSizeDropdown({ pageSize, onChangePageSize }: { pageSize: number; onChangePageSize: (n: number) => void }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        function handleClick(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    const currentLabel = PAGE_SIZE_OPTIONS.find(o => o.value === pageSize)?.label ?? `${pageSize} hàng`;
    const fontSize = getResponsiveFontSize('xs');

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                Hiển thị:
            </Typography>
            <Box ref={wrapperRef} sx={{ position: 'relative' }}>
                <Box
                    component="button"
                    onClick={() => setOpen(v => !v)}
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.75,
                        px: 1,
                        height: 26,
                        borderRadius: `${borderRadius.sm}px`,
                        border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
                        bgcolor: isDark ? alpha('#fff', 0.04) : alpha('#000', 0.03),
                        color: theme.palette.text.secondary,
                        cursor: 'pointer',
                        transition: `all ${durations.fast} ${easings.easeOut}`,
                        '&:hover': {
                            borderColor: alpha(theme.palette.primary.main, 0.35),
                            bgcolor: alpha(theme.palette.primary.main, 0.06),
                        },
                    }}
                >
                    <Typography sx={{ fontSize, fontWeight: fontWeight.medium, color: 'inherit', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                        {currentLabel}
                    </Typography>
                    <Icon
                        icon="solar:alt-arrow-down-bold"
                        width={11}
                        style={{
                            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: `transform ${durations.fast} ${easings.easeOut}`,
                        }}
                    />
                </Box>

                {open && (
                    <Box sx={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        mb: 0.75,
                        minWidth: '100%',
                        zIndex: 9999,
                        borderRadius: `${borderRadius.md}px`,
                        ...getGlassCard(isDark),
                        background: isDark ? 'rgba(30, 30, 30, 0.5)' : 'rgba(255, 255, 255, 0.5)',
                        boxShadow: isDark
                            ? '0 8px 32px rgba(0,0,0,0.5)'
                            : '0 8px 24px rgba(0,0,0,0.12)',
                        overflow: 'hidden',
                        animation: `pageSizeFadeIn ${durations.fast} ${easings.easeOut}`,
                        '@keyframes pageSizeFadeIn': {
                            from: { opacity: 0, transform: 'translateY(4px)' },
                            to: { opacity: 1, transform: 'translateY(0)' },
                        },
                    }}>
                        {PAGE_SIZE_OPTIONS.map((opt, idx) => {
                            const isActive = pageSize === opt.value;
                            return (
                                <Box
                                    key={opt.value}
                                    component="button"
                                    onClick={() => { onChangePageSize(opt.value); setOpen(false); }}
                                    sx={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        px: 1.5,
                                        py: 0.7,
                                        background: isActive
                                            ? isDark ? alpha(theme.palette.primary.main, 0.15) : alpha(theme.palette.primary.main, 0.08)
                                            : 'transparent',
                                        border: 'none',
                                        borderBottom: idx < PAGE_SIZE_OPTIONS.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.12)}` : 'none',
                                        cursor: 'pointer',
                                        transition: `background ${durations.fastest}`,
                                        '&:hover': {
                                            background: isDark ? alpha('#fff', 0.06) : alpha('#000', 0.04),
                                        },
                                    }}
                                >
                                    <Typography sx={{
                                        fontSize,
                                        fontWeight: isActive ? fontWeight.semibold : fontWeight.medium,
                                        color: isActive ? theme.palette.primary.main : theme.palette.text.primary,
                                        lineHeight: 1.4,
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {opt.label}
                                    </Typography>
                                </Box>
                            );
                        })}
                    </Box>
                )}
            </Box>
        </Box>
    );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StocksContent() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const store = useScreenerStore();
    const [showDetail, setShowDetail] = useState(false);
    const [showIndicator, setShowIndicator] = useState(false);
    const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // SSE data
    const { data: rawData, isLoading: dataLoading, error: dataError } = useSseCache<Record<string, any>[]>({
        keyword: 'screener_stock_data',
        onData: (d) => console.log('[Screener] data received:', Array.isArray(d) ? `${d.length} records` : typeof d),
        onError: (e) => console.error('[Screener] error:', e),
        onOpen: () => console.log('[Screener] SSE connected'),
    });

    const { data: meta } = useSseCache<ScreenerMeta>({
        keyword: 'screener_stock_meta',
    });

    // Client-side filtering & sorting
    const filteredData = useMemo(() => {
        if (!rawData || !Array.isArray(rawData)) return [];
        const filtered = applyFilters(
            rawData,
            store.state.selectFilters,
            store.state.rangeFilters,
            store.state.advancedFilters,
            store.state.searchQuery,
        );
        return applySorting(filtered, store.state.sortField, store.state.sortOrder);
    }, [rawData, store.state.selectFilters, store.state.rangeFilters, store.state.advancedFilters, store.state.searchQuery, store.state.sortField, store.state.sortOrder]);

    // Reset to page 1 when filters/sort change
    useEffect(() => { setCurrentPage(1); }, [
        store.state.selectFilters,
        store.state.rangeFilters,
        store.state.advancedFilters,
        store.state.searchQuery,
        store.state.sortField,
        store.state.sortOrder,
    ]);

    // Paginated slice
    const pagedData = useMemo(() => {
        if (pageSize === 0) return filteredData; // 0 = show all
        const start = (currentPage - 1) * pageSize;
        return filteredData.slice(start, start + pageSize);
    }, [filteredData, currentPage, pageSize]);

    const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredData.length / pageSize);

    const handleApplyPreset = useCallback((presetId: string) => {
        if (store.state.activePresetId === presetId) {
            store.clearAllFilters();
        } else {
            const preset = FILTER_PRESETS.find(p => p.id === presetId);
            if (preset) store.applyPreset(presetId, preset.filters);
        }
    }, [store]);

    const totalCount = rawData?.length ?? 0;
    const statusText = dataError
        ? `Lỗi kết nối: ${dataError.message}`
        : dataLoading
            ? 'Đang tải dữ liệu...'
            : `${filteredData.length.toLocaleString()} / ${totalCount.toLocaleString()} cổ phiếu`;

    return (
        <Box sx={{ py: 3 }}>
            {/* ─── Header ─── */}
            <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
                <Box>
                    <Typography variant="h1" sx={{ fontSize: getResponsiveFontSize('h1'), lineHeight: 1.2 }}>
                        Bộ lọc cổ phiếu
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1 }}>
                        {dataLoading && !dataError && (
                            <Icon icon="svg-spinners:ring-resize" width={14} color={theme.palette.text.secondary} />
                        )}
                        {dataError && (
                            <Icon icon="solar:danger-triangle-bold" width={14} color={theme.palette.error.main} />
                        )}
                        <Typography
                            variant="body2"
                            color={dataError ? 'error' : 'text.secondary'}
                            sx={{ fontSize: getResponsiveFontSize('sm') }}
                        >
                            {statusText}
                        </Typography>
                    </Box>
                </Box>

                {/* Search */}
                <TextField
                    size="small"
                    placeholder="Lọc theo mã CK"
                    value={store.state.searchQuery}
                    onChange={(e) => store.setSearchQuery(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Icon icon="solar:magnifer-linear" width={16} color={theme.palette.text.secondary} />
                            </InputAdornment>
                        ),
                        endAdornment: store.state.searchQuery ? (
                            <InputAdornment position="end">
                                <Box
                                    component="button"
                                    onClick={() => store.setSearchQuery('')}
                                    sx={{ background: 'none', border: 'none', cursor: 'pointer', p: 0.25, display: 'flex', color: 'text.disabled' }}
                                >
                                    <Icon icon="solar:close-circle-bold" width={16} />
                                </Box>
                            </InputAdornment>
                        ) : undefined,
                    }}
                    sx={{
                        width: { xs: '100%', sm: 260 },
                        '& .MuiOutlinedInput-root': {
                            borderRadius: `${borderRadius.md}px`,
                            fontSize: getResponsiveFontSize('sm'),
                        },
                    }}
                />
            </Box>

            {/* ─── Preset Filter Templates ─── */}
            <Box sx={{ mb: 2, display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', fontWeight: fontWeight.medium }}>
                    Mẫu lọc:
                </Typography>
                {FILTER_PRESETS.map(preset => (
                    <PresetChip
                        key={preset.id}
                        preset={preset}
                        active={store.state.activePresetId === preset.id}
                        onClick={() => handleApplyPreset(preset.id)}
                        isDark={isDark}
                        theme={theme}
                    />
                ))}
            </Box>

            {/* ─── Filter Box ─── */}
            <Box sx={{ ...getGlassCard(isDark), borderRadius: `${borderRadius.lg}px`, p: 2, mb: 2 }}>
                <FilterBar
                    meta={meta ?? { exchange: [], industry_name: [], marketcap_name: [], category_name: [] }}
                    selectFilters={store.state.selectFilters}
                    onSetSelectFilter={store.setSelectFilter}
                    onClearSelectFilter={store.clearSelectFilter}
                    filterCount={store.activeFilterCount}
                    onClearAll={store.clearAllFilters}
                />

                {/* Filter toggle buttons */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.5 }}>
                    {[
                        {
                            active: showDetail,
                            onToggle: () => setShowDetail((v: boolean) => !v),
                            label: 'Lọc nâng cao',
                            color: theme.palette.warning.main,
                            badge: Object.keys(store.state.rangeFilters).length + Object.values(store.state.selectFilters).filter(v => v.length > 0).length,
                        },
                        {
                            active: showIndicator,
                            onToggle: () => setShowIndicator((v: boolean) => !v),
                            label: 'Lọc kỹ thuật',
                            color: theme.palette.primary.main,
                            badge: store.state.advancedFilters.length,
                        },
                    ].map(({ active, onToggle, label, color, badge }) => (
                        <Box
                            key={label}
                            component="button"
                            onClick={onToggle}
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.5,
                                px: 1.25,
                                height: 28,
                                borderRadius: `${borderRadius.pill}px`,
                                border: `1px solid ${active ? alpha(color, 0.4) : alpha(theme.palette.divider, 0.4)}`,
                                bgcolor: active ? alpha(color, 0.08) : 'transparent',
                                color: active ? color : theme.palette.text.secondary,
                                cursor: 'pointer',
                                fontSize: getResponsiveFontSize('xs'),
                                fontWeight: active ? fontWeight.semibold : fontWeight.medium,
                                transition: `all ${durations.fast} ${easings.easeOut}`,
                                '&:hover': {
                                    bgcolor: alpha(color, 0.06),
                                    borderColor: alpha(color, 0.3),
                                },
                            }}
                        >
                            <Icon icon={active ? 'solar:filter-bold' : 'solar:filter-linear'} width={13} />
                            {label}
                            {badge > 0 && (
                                <Box sx={{
                                    ml: 0.25, px: 0.625, py: 0.1,
                                    borderRadius: `${borderRadius.pill}px`,
                                    bgcolor: color,
                                    color: '#fff',
                                    fontSize: '0.6rem',
                                    fontWeight: fontWeight.bold,
                                    lineHeight: 1.6,
                                    minWidth: 16,
                                    textAlign: 'center',
                                }}>
                                    {badge}
                                </Box>
                            )}
                        </Box>
                    ))}
                </Box>

                {(showDetail || showIndicator) && (
                    <Box sx={{ mt: 1.5 }}>
                        <AdvancedFilterPanel
                            rangeFilters={store.state.rangeFilters}
                            advancedFilters={store.state.advancedFilters}
                            selectFilters={store.state.selectFilters}
                            showDetail={showDetail}
                            showIndicator={showIndicator}
                            onSetRangeFilter={store.setRangeFilter}
                            onClearRangeFilter={store.clearRangeFilter}
                            onAddAdvancedFilter={store.addAdvancedFilter}
                            onRemoveAdvancedFilter={store.removeAdvancedFilter}
                            onClearAdvancedFilters={store.clearAdvancedFilters}
                            onSetSelectFilter={store.setSelectFilter}
                            onClearSelectFilter={store.clearSelectFilter}
                        />
                    </Box>
                )}
            </Box>

            {/* ─── Table View Selector ─── */}
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <TableViewSelector
                    activeView={store.state.tableView}
                    onViewChange={store.setTableView}
                    onOpenColumnCustomizer={() => setShowColumnCustomizer(true)}
                />
            </Box>

            {/* ─── Results Table ─── */}
            <Box sx={{ ...getGlassCard(isDark), borderRadius: `${borderRadius.lg}px`, overflow: 'hidden', px: 1, py: 0.5 }}>
                <ResultTable
                    data={pagedData}
                    columns={store.activeColumns}
                    sortField={store.state.sortField}
                    sortOrder={store.state.sortOrder}
                    onToggleSort={store.toggleSort}
                    onReorderColumns={store.reorderColumns}
                    isLoading={dataLoading}
                />

                {/* Pagination footer */}
                {!dataLoading && filteredData.length > 0 && (
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 1,
                        px: 1,
                        py: 1,
                        borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                        mt: 0.5,
                    }}>
                        {/* Left: page info + per-page selector */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', whiteSpace: 'nowrap' }}>
                                {pageSize === 0
                                    ? `Tất cả ${filteredData.length.toLocaleString()} cổ phiếu`
                                    : `${Math.min((currentPage - 1) * pageSize + 1, filteredData.length).toLocaleString()}–${Math.min(currentPage * pageSize, filteredData.length).toLocaleString()} / ${filteredData.length.toLocaleString()}`
                                }
                            </Typography>

                            <PageSizeDropdown
                                pageSize={pageSize}
                                onChangePageSize={(n) => { setPageSize(n); setCurrentPage(1); }}
                            />
                        </Box>

                        {/* Right: page buttons */}
                        {totalPages > 1 && (
                            <Pagination
                                count={totalPages}
                                page={currentPage}
                                onChange={(_, val) => setCurrentPage(val)}
                                color="primary"
                                size="small"
                                showFirstButton
                                showLastButton
                                sx={{
                                    '& .MuiPaginationItem-root': {
                                        borderRadius: `${borderRadius.sm}px`,
                                        fontSize: getResponsiveFontSize('xs'),
                                        color: theme.palette.text.secondary,
                                    },
                                    '& .MuiPaginationItem-root.Mui-selected': {
                                        color: '#fff',
                                    },
                                }}
                            />
                        )}
                    </Box>
                )}
            </Box>

            {showColumnCustomizer && (
                <ColumnCustomizer
                    open={showColumnCustomizer}
                    onClose={() => setShowColumnCustomizer(false)}
                    selectedColumns={store.state.customColumns}
                    onSetColumns={store.setCustomColumns}
                    onToggleColumn={store.toggleCustomColumn}
                />
            )}
        </Box>
    );
}
