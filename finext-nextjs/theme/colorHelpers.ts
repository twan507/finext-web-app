// finext-nextjs/theme/colorHelpers.ts
// Utility functions for stock data color coding

import { Theme } from '@mui/material';

/**
 * Get color based on price change percentage and exchange
 * HSX/HOSE: ceil/floor at ±6.5%, HNX: ±9%, UPCOM: ±14%
 */
export const getPriceColor = (pctChange: number, exchange: string | undefined, theme: Theme): string => {
    const pct = pctChange * 100; // Convert to percentage

    // Normalize exchange to uppercase for comparison
    // Default to HSX if exchange is undefined
    const ex = (exchange || 'HSX').toUpperCase();

    // Determine ceil/floor limits based on exchange
    let limit = 6.5; // Default HSX/HOSE
    if (ex === 'HNX' || ex.includes('HNX')) {
        limit = 9;
    } else if (ex === 'UPCOM' || ex.includes('UPCOM')) {
        limit = 13.5;
    }

    // Check ceil/floor first
    if (pct >= limit) return theme.palette.trend.ceil;
    if (pct <= -limit) return theme.palette.trend.floor;

    // Check ref (near zero: ±0.005%)
    if (Math.abs(pct) <= 0.005) return theme.palette.trend.ref;

    // Normal up/down
    return pct > 0 ? theme.palette.trend.up : theme.palette.trend.down;
};

/**
 * Get color based on t0_score (money flow)
 * (-1, 1) = yellow (ref), >= 1 = green (up), <= -1 = red (down)
 * No ceil/floor for flow
 */
export const getFlowColor = (t0Score: number, theme: Theme): string => {
    if (t0Score > -1 && t0Score < 1) return theme.palette.trend.ref; // Yellow
    if (t0Score >= 1) return theme.palette.trend.up; // Green
    return theme.palette.trend.down; // Red
};

/**
 * Get color based on VSI (Volume Strength Index)
 * VSI ranges and their meanings:
 * < 0.6: Floor (Cyan/Blue)
 * 0.6-0.9: Down (Red)
 * 0.9-1.2: Ref (Yellow)
 * 1.2-1.5: Up (Green)
 * >= 1.5: Ceil (Purple)
 */
export const getVsiColor = (vsi: number, theme: Theme): string => {
    if (vsi === 0) return theme.palette.trend.ref; // Yellow
    if (vsi < 0.6) return theme.palette.trend.floor; // Cyan/Blue (Sàn)
    if (vsi < 0.9) return theme.palette.trend.down; // Red
    if (vsi < 1.2) return theme.palette.trend.ref; // Yellow
    if (vsi < 1.5) return theme.palette.trend.up; // Green
    return theme.palette.trend.ceil; // Purple (Ceiling)
};

/**
 * Get color based on rank percentile (0–1), split into 5 equal bands of 20%
 * 0–20%: floor | 20–40%: down | 40–60%: ref | 60–80%: up | 80–100%: ceil
 */
export const getRankColor = (value: number, theme: Theme): string => {
    const pct = value * 100;
    if (pct >= 80) return theme.palette.trend.ceil;
    if (pct >= 60) return theme.palette.trend.up;
    if (pct >= 40) return theme.palette.trend.ref;
    if (pct >= 20) return theme.palette.trend.down;
    return theme.palette.trend.floor;
};

/**
 * Get color based on zone value (AAA/AA/A/B/C)
 */
const ZONE_COLORS_DARK: Record<string, string> = {
    AAA: '#22c55e',
    AA:  '#86efac',
    A:   '#facc15',
    B:   '#f97316',
    C:   '#ef4444',
};
const ZONE_COLORS_LIGHT: Record<string, string> = {
    AAA: '#16a34a',
    AA:  '#0d9488',
    A:   '#b45309',
    B:   '#c2410c',
    C:   '#b91c1c',
};

export const getZoneColor = (zone: string, isDark: boolean): string | undefined => {
    const map = isDark ? ZONE_COLORS_DARK : ZONE_COLORS_LIGHT;
    return map[zone] ?? undefined;
};

/**
 * Get simple trend color for a numeric value (up/down/ref)
 * Use for index pct_change, biến động %, or any value where
 * only positive/negative/neutral matters (no ceil/floor logic)
 */
export const getTrendColor = (value: number | null | undefined, theme: Theme): string => {
    if (value == null) return theme.palette.trend.ref;
    if (Math.abs(value) <= 0.005) return theme.palette.trend.ref;
    return value > 0 ? theme.palette.trend.up : theme.palette.trend.down;
};
