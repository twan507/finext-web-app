/**
 * useChartStore — persistent chart state management
 *
 * Stores the user's chart preferences in localStorage:
 *   • Enabled/disabled indicator selections
 *   • Last viewed ticker symbol
 *
 * Survives page reloads, tab switches, and navigation.
 *
 * Storage keys:
 *   'finext-indicator-state'  — Record<string, boolean>
 *   'finext-last-ticker'      — string
 */
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { getDefaultEnabledIndicators, getAllIndicatorsOff, INDICATOR_GROUPS, type IndicatorGroup } from '../app/(main)/charts/[id]/indicatorConfig';

// ─── Storage keys ────────────────────────────────────────────────────────────────
const INDICATOR_KEY = 'finext-indicator-state';
const TICKER_KEY = 'finext-last-ticker';
const TOOLBAR_KEY = 'finext-toolbar-prefs';
const DEFAULT_TICKER = 'VNINDEX';

// ─── Toolbar preferences ─────────────────────────────────────────────────────────
export type PriceTagMode = 'value' | 'both' | 'none';

export interface ToolbarPrefs {
    chartType: 'candlestick' | 'line';
    showIndicators: boolean;
    showVolume: boolean;
    showLegend: boolean;
    priceTagMode: PriceTagMode;
    timeframe: string;
    showIndicatorsPanel: boolean;
    showWatchlistPanel: boolean;
}

const DEFAULT_TOOLBAR_PREFS: ToolbarPrefs = {
    chartType: 'candlestick',
    showIndicators: true,
    showVolume: true,
    showLegend: true,
    priceTagMode: 'value',
    timeframe: '1D',
    showIndicatorsPanel: true,
    showWatchlistPanel: true,
};

function loadToolbarPrefs(): ToolbarPrefs {
    if (typeof window === 'undefined') return DEFAULT_TOOLBAR_PREFS;
    try {
        const raw = localStorage.getItem(TOOLBAR_KEY);
        if (!raw) return DEFAULT_TOOLBAR_PREFS;
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_TOOLBAR_PREFS, ...parsed };
    } catch { return DEFAULT_TOOLBAR_PREFS; }
}

function saveToolbarPrefs(prefs: ToolbarPrefs) {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(TOOLBAR_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

// ─── Indicator helpers ───────────────────────────────────────────────────────────
function isValidIndicatorState(obj: unknown): obj is Record<string, boolean> {
    if (typeof obj !== 'object' || obj === null) return false;
    const record = obj as Record<string, unknown>;
    const allKeys = INDICATOR_GROUPS.flatMap((g: IndicatorGroup) => g.indicators.map(i => i.key));
    return allKeys.some((k: string) => typeof record[k] === 'boolean');
}

function mergeWithDefaults(stored: Record<string, boolean>): Record<string, boolean> {
    const base = getAllIndicatorsOff();
    return { ...base, ...stored };
}

function loadIndicators(): Record<string, boolean> | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(INDICATOR_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (isValidIndicatorState(parsed)) return mergeWithDefaults(parsed);
    } catch { /* corrupted — ignore */ }
    return null;
}

function saveIndicators(state: Record<string, boolean>) {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(INDICATOR_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

// ─── Ticker helpers ──────────────────────────────────────────────────────────────
export function loadLastTicker(): string {
    if (typeof window === 'undefined') return DEFAULT_TICKER;
    try {
        return localStorage.getItem(TICKER_KEY) || DEFAULT_TICKER;
    } catch { return DEFAULT_TICKER; }
}

function saveLastTicker(ticker: string) {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(TICKER_KEY, ticker); } catch { /* ignore */ }
}

// ─── Hook return type ────────────────────────────────────────────────────────────
export interface UseChartStoreReturn {
    /** Current enabled/disabled indicator map */
    enabledIndicators: Record<string, boolean>;
    /** Toggle one indicator on/off */
    toggleIndicator: (key: string) => void;
    /** Clear all indicators (set all to false) */
    clearAll: () => void;
    /** Reset indicators to the built-in default preset */
    resetToDefault: () => void;
    /** Save the current ticker as last viewed */
    setLastTicker: (ticker: string) => void;
    /** Persisted toolbar preferences */
    toolbarPrefs: ToolbarPrefs;
    /** Update one or more toolbar preferences */
    updateToolbarPrefs: (patch: Partial<ToolbarPrefs>) => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────────
export default function useChartStore(): UseChartStoreReturn {
    // --- Indicators ---
    const [enabledIndicators, setEnabledIndicators] = useState<Record<string, boolean>>(() => {
        return loadIndicators() ?? getDefaultEnabledIndicators();
    });

    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        saveIndicators(enabledIndicators);
    }, [enabledIndicators]);

    const toggleIndicator = useCallback((key: string) => {
        setEnabledIndicators(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const clearAll = useCallback(() => {
        setEnabledIndicators(getAllIndicatorsOff());
    }, []);

    const resetToDefault = useCallback(() => {
        setEnabledIndicators(getDefaultEnabledIndicators());
    }, []);

    // --- Last ticker ---
    const setLastTicker = useCallback((ticker: string) => {
        saveLastTicker(ticker);
    }, []);

    // --- Toolbar preferences ---
    const [toolbarPrefs, setToolbarPrefs] = useState<ToolbarPrefs>(loadToolbarPrefs);

    const isFirstToolbarRender = useRef(true);
    useEffect(() => {
        if (isFirstToolbarRender.current) { isFirstToolbarRender.current = false; return; }
        saveToolbarPrefs(toolbarPrefs);
    }, [toolbarPrefs]);

    const updateToolbarPrefs = useCallback((patch: Partial<ToolbarPrefs>) => {
        setToolbarPrefs(prev => ({ ...prev, ...patch }));
    }, []);

    return { enabledIndicators, toggleIndicator, clearAll, resetToDefault, setLastTicker, toolbarPrefs, updateToolbarPrefs };
}
