/**
 * useScreenerStore — persistent stock screener state management
 *
 * Stores the user's screener preferences in localStorage:
 *   • Active table view preset
 *   • Custom selected columns
 *   • Active select filters (exchange, industry, etc.)
 *   • Active range filters (price, pct_change, etc.)
 *   • Active advanced filters (price vs indicator comparisons)
 *   • Sort state
 *   • Active filter preset id
 *
 * Survives page reloads, tab switches, and navigation.
 * Pattern follows useChartStore.
 */
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { TableViewKey, AdvancedCompare } from '../app/(main)/stocks/screenerConfig';
import { TABLE_VIEWS } from '../app/(main)/stocks/screenerConfig';

// ─── Storage key ─────────────────────────────────────────────────────────────
const STORAGE_KEY = 'finext-screener-state';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface RangeFilter {
    min: number | null;
    max: number | null;
}

export interface AdvancedFilter {
    field: string;       // e.g. 'ma20', 'w_pivot'
    compare: AdvancedCompare; // 'above' | 'below' | 'range'
    lowerPct?: number;   // lower bound % for range mode (e.g. -1 means -1%)
    upperPct?: number;   // upper bound % for range mode (e.g. 3 means +3%)
}

export interface ScreenerState {
    tableView: TableViewKey;
    customColumns: string[];
    columnOrder: Record<string, string[]>;  // viewKey -> ordered fields (drag reorder)
    selectFilters: Record<string, string[]>;  // field -> selected values
    rangeFilters: Record<string, RangeFilter>;
    advancedFilters: AdvancedFilter[];
    sortField: string;
    sortOrder: 'asc' | 'desc';
    activePresetId: string | null;
    searchQuery: string;
}

const DEFAULT_STATE: ScreenerState = {
    tableView: 'overview',
    customColumns: TABLE_VIEWS['overview'].fields,
    columnOrder: {},  // empty = use default order
    selectFilters: {},
    rangeFilters: {},
    advancedFilters: [],
    sortField: '',
    sortOrder: 'asc',
    activePresetId: null,
    searchQuery: '',
};

// ─── Persistence helpers ─────────────────────────────────────────────────────

function loadState(): ScreenerState | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        // Merge with defaults to handle new fields added in future versions
        return { ...DEFAULT_STATE, ...parsed };
    } catch { return null; }
}

function saveState(state: ScreenerState): void {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

// ─── Hook return type ────────────────────────────────────────────────────────
export interface UseScreenerStoreReturn {
    state: ScreenerState;

    // Table view
    setTableView: (view: TableViewKey) => void;

    // Custom columns
    setCustomColumns: (columns: string[]) => void;
    toggleCustomColumn: (field: string) => void;

    // Select filters (dropdown multi-select)
    setSelectFilter: (field: string, values: string[]) => void;
    clearSelectFilter: (field: string) => void;

    // Range filters
    setRangeFilter: (field: string, range: RangeFilter) => void;
    clearRangeFilter: (field: string) => void;

    // Advanced filters (price vs indicator)
    addAdvancedFilter: (filter: AdvancedFilter) => void;
    removeAdvancedFilter: (field: string) => void;
    clearAdvancedFilters: () => void;

    // Sort
    setSort: (field: string, order?: 'asc' | 'desc') => void;
    toggleSort: (field: string) => void;

    // Preset
    applyPreset: (presetId: string, filters: Record<string, any>) => void;
    clearPreset: () => void;

    // Search
    setSearchQuery: (query: string) => void;

    // Bulk ops
    clearAllFilters: () => void;
    resetToDefault: () => void;

    // Column reorder (drag & drop)
    reorderColumns: (fromIndex: number, toIndex: number) => void;

    // Active columns (derived from current view)
    activeColumns: string[];

    // Filter count
    activeFilterCount: number;
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export default function useScreenerStore(): UseScreenerStoreReturn {
    const [state, setState] = useState<ScreenerState>(() => loadState() ?? DEFAULT_STATE);

    // Persist on change (skip initial render)
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        saveState(state);
    }, [state]);

    // ── Table view ──
    const setTableView = useCallback((view: TableViewKey) => {
        setState(prev => ({ ...prev, tableView: view }));
    }, []);

    // ── Custom columns ──
    const setCustomColumns = useCallback((columns: string[]) => {
        setState(prev => ({
            ...prev,
            customColumns: columns,
            columnOrder: { ...prev.columnOrder, custom: undefined as any },
        }));
    }, []);

    const toggleCustomColumn = useCallback((field: string) => {
        setState(prev => {
            const cols = prev.customColumns.includes(field)
                ? prev.customColumns.filter(c => c !== field)
                : [...prev.customColumns, field];
            return { ...prev, customColumns: cols };
        });
    }, []);

    // ── Select filters ──
    const setSelectFilter = useCallback((field: string, values: string[]) => {
        setState(prev => ({
            ...prev,
            selectFilters: { ...prev.selectFilters, [field]: values },
            activePresetId: null, // Clear preset when manually filtering
        }));
    }, []);

    const clearSelectFilter = useCallback((field: string) => {
        setState(prev => {
            const next = { ...prev.selectFilters };
            delete next[field];
            return { ...prev, selectFilters: next, activePresetId: null };
        });
    }, []);

    // ── Range filters ──
    const setRangeFilter = useCallback((field: string, range: RangeFilter) => {
        setState(prev => ({
            ...prev,
            rangeFilters: { ...prev.rangeFilters, [field]: range },
            activePresetId: null,
        }));
    }, []);

    const clearRangeFilter = useCallback((field: string) => {
        setState(prev => {
            const next = { ...prev.rangeFilters };
            delete next[field];
            return { ...prev, rangeFilters: next, activePresetId: null };
        });
    }, []);

    // ── Advanced filters ──
    const addAdvancedFilter = useCallback((filter: AdvancedFilter) => {
        setState(prev => {
            const filtered = prev.advancedFilters.filter(f => f.field !== filter.field);
            return { ...prev, advancedFilters: [...filtered, filter], activePresetId: null };
        });
    }, []);

    const removeAdvancedFilter = useCallback((field: string) => {
        setState(prev => ({
            ...prev,
            advancedFilters: prev.advancedFilters.filter(f => f.field !== field),
            activePresetId: null,
        }));
    }, []);

    const clearAdvancedFilters = useCallback(() => {
        setState(prev => ({ ...prev, advancedFilters: [], activePresetId: null }));
    }, []);

    // ── Sort ──
    const setSort = useCallback((field: string, order: 'asc' | 'desc' = 'desc') => {
        setState(prev => ({ ...prev, sortField: field, sortOrder: order }));
    }, []);

    const toggleSort = useCallback((field: string) => {
        setState(prev => {
            if (prev.sortField !== field) {
                // New column → start desc
                return { ...prev, sortField: field, sortOrder: 'desc' };
            }
            if (prev.sortOrder === 'desc') {
                // Same column desc → switch to asc
                return { ...prev, sortOrder: 'asc' };
            }
            // Same column asc → reset: no column highlighted, data falls back to ticker A→Z
            return { ...prev, sortField: '', sortOrder: 'asc' };
        });
    }, []);

    // ── Preset ──
    const applyPreset = useCallback((presetId: string, filters: Record<string, any>) => {
        setState(prev => ({
            ...prev,
            selectFilters: filters.selectFilters ?? {},
            rangeFilters: filters.rangeFilters ?? {},
            advancedFilters: filters.advancedFilters ?? [],
            activePresetId: presetId,
        }));
    }, []);

    const clearPreset = useCallback(() => {
        setState(prev => ({ ...prev, activePresetId: null }));
    }, []);

    // ── Search ──
    const setSearchQuery = useCallback((query: string) => {
        setState(prev => ({ ...prev, searchQuery: query }));
    }, []);

    // ── Bulk ops ──
    const clearAllFilters = useCallback(() => {
        setState(prev => ({
            ...prev,
            selectFilters: {},
            rangeFilters: {},
            advancedFilters: [],
            activePresetId: null,
            searchQuery: '',
        }));
    }, []);

    const resetToDefault = useCallback(() => {
        setState(DEFAULT_STATE);
    }, []);

    // ── Reorder columns (drag & drop) ──
    const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
        setState(prev => {
            const viewKey = prev.tableView;
            const baseCols = viewKey === 'custom'
                ? prev.customColumns
                : TABLE_VIEWS[viewKey].fields;
            const currentOrder = prev.columnOrder[viewKey] ?? [...baseCols];
            const reordered = [...currentOrder];
            const [moved] = reordered.splice(fromIndex, 1);
            reordered.splice(toIndex, 0, moved);
            return {
                ...prev,
                columnOrder: { ...prev.columnOrder, [viewKey]: reordered },
            };
        });
    }, []);

    // ── Derived: active columns (with drag order) ──
    const activeColumns = (() => {
        const viewKey = state.tableView;
        const baseCols = viewKey === 'custom'
            ? state.customColumns
            : TABLE_VIEWS[viewKey].fields;
        const ordered = state.columnOrder[viewKey];
        if (!ordered) return baseCols;
        // Filter to only include columns that still exist in baseCols
        const baseSet = new Set(baseCols);
        const filtered = ordered.filter(f => baseSet.has(f));
        // Add any new baseCols that aren't in the order yet
        const orderedSet = new Set(filtered);
        for (const f of baseCols) {
            if (!orderedSet.has(f)) filtered.push(f);
        }
        return filtered;
    })();

    // ── Derived: active filter count ──
    const activeFilterCount =
        Object.values(state.selectFilters).filter(v => v.length > 0).length +
        Object.keys(state.rangeFilters).length +
        state.advancedFilters.length +
        (state.searchQuery ? 1 : 0);

    return {
        state,
        setTableView,
        setCustomColumns,
        toggleCustomColumn,
        setSelectFilter,
        clearSelectFilter,
        setRangeFilter,
        clearRangeFilter,
        addAdvancedFilter,
        removeAdvancedFilter,
        clearAdvancedFilters,
        setSort,
        toggleSort,
        applyPreset,
        clearPreset,
        setSearchQuery,
        clearAllFilters,
        resetToDefault,
        reorderColumns,
        activeColumns,
        activeFilterCount,
    };
}
