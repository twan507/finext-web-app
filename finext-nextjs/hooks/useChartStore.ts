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
const DEFAULT_TICKER = 'VNINDEX';

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

    return { enabledIndicators, toggleIndicator, clearAll, resetToDefault, setLastTicker };
}
