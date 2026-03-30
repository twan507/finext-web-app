/**
 * usePriceMapStore — persistent price map filter state
 *
 * Stores the user's timeframe and group toggle preferences in localStorage:
 *   • Enabled timeframe filters (w, m, q, y)
 *   • Enabled indicator group filters (ma, open_high_low, pivot, fibonacci, volume_profile)
 *
 * Shared across both the stock PriceMapSection and the VNINDEX IndexPriceMap.
 *
 * Storage key:
 *   'finext-pricemap-prefs'  — { timeframes: string[]; groups: string[] }
 */
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────────

export type TimeframeKey = 'w' | 'm' | 'q' | 'y';
export type GroupKey = 'ma' | 'open_high_low' | 'pivot' | 'fibonacci' | 'volume_profile';

interface StoredPrefs {
    timeframes: string[];
    groups: string[];
}

// ─── Defaults ────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEFRAMES: TimeframeKey[] = ['m', 'q'];
const DEFAULT_GROUPS: GroupKey[] = ['ma', 'open_high_low', 'pivot', 'fibonacci'];

const VALID_TIMEFRAMES = new Set<string>(['w', 'm', 'q', 'y']);
const VALID_GROUPS = new Set<string>(['ma', 'open_high_low', 'pivot', 'fibonacci', 'volume_profile']);

// ─── Storage helpers ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'finext-pricemap-prefs';

function loadPrefs(): { timeframes: Set<TimeframeKey>; groups: Set<GroupKey> } {
    if (typeof window === 'undefined') {
        return { timeframes: new Set(DEFAULT_TIMEFRAMES), groups: new Set(DEFAULT_GROUPS) };
    }
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { timeframes: new Set(DEFAULT_TIMEFRAMES), groups: new Set(DEFAULT_GROUPS) };
        const parsed: StoredPrefs = JSON.parse(raw);
        const timeframes = new Set(
            (parsed.timeframes ?? []).filter(t => VALID_TIMEFRAMES.has(t)) as TimeframeKey[]
        );
        const groups = new Set(
            (parsed.groups ?? []).filter(g => VALID_GROUPS.has(g)) as GroupKey[]
        );
        // Fall back to defaults if stored sets are empty (corrupted / unknown keys)
        return {
            timeframes: timeframes.size > 0 ? timeframes : new Set(DEFAULT_TIMEFRAMES),
            groups: groups.size > 0 ? groups : new Set(DEFAULT_GROUPS),
        };
    } catch {
        return { timeframes: new Set(DEFAULT_TIMEFRAMES), groups: new Set(DEFAULT_GROUPS) };
    }
}

function savePrefs(timeframes: Set<TimeframeKey>, groups: Set<GroupKey>) {
    if (typeof window === 'undefined') return;
    try {
        const prefs: StoredPrefs = {
            timeframes: Array.from(timeframes),
            groups: Array.from(groups),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch { /* ignore */ }
}

// ─── Hook ────────────────────────────────────────────────────────────────────────

export interface UsePriceMapStoreReturn {
    enabledTimeframes: Set<TimeframeKey>;
    enabledGroups: Set<GroupKey>;
    toggleTimeframe: (tf: TimeframeKey) => void;
    toggleGroup: (g: GroupKey) => void;
}

export default function usePriceMapStore(): UsePriceMapStoreReturn {
    const [enabledTimeframes, setEnabledTimeframes] = useState<Set<TimeframeKey>>(() => loadPrefs().timeframes);
    const [enabledGroups, setEnabledGroups] = useState<Set<GroupKey>>(() => loadPrefs().groups);

    // Skip saving on first render (values just loaded from storage)
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        savePrefs(enabledTimeframes, enabledGroups);
    }, [enabledTimeframes, enabledGroups]);

    const toggleTimeframe = useCallback((tf: TimeframeKey) => {
        setEnabledTimeframes(prev => {
            const next = new Set(prev);
            if (next.has(tf)) next.delete(tf); else next.add(tf);
            return next;
        });
    }, []);

    const toggleGroup = useCallback((g: GroupKey) => {
        setEnabledGroups(prev => {
            const next = new Set(prev);
            if (next.has(g)) next.delete(g); else next.add(g);
            return next;
        });
    }, []);

    return { enabledTimeframes, enabledGroups, toggleTimeframe, toggleGroup };
}
