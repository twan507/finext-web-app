/**
 * Aggregate daily chart data into weekly (1W) or monthly (1M) timeframes.
 *
 * Rules:
 *   Open   → first day's open
 *   High   → max of all highs
 *   Low    → min of all lows
 *   Close  → last day's close
 *   Volume → sum
 *   All other indicator fields → last (giá trị cuối cùng trong group)
 */
import type { ChartRawData } from './PageContent';

export type Timeframe = '1D' | '1W' | '1M';

// Fields handled explicitly (not copied via "last")
const EXPLICIT_FIELDS = new Set<string>([
    'ticker', 'ticker_name', 'date',
    'open', 'high', 'low', 'close', 'volume',
    'diff', 'pct_change',
]);

/**
 * Get ISO week grouping key (Monday-based weeks)
 * Returns "YYYY-Www" format, e.g. "2025-W07"
 */
function getWeekKey(dateStr: string): string {
    const d = new Date(dateStr);
    // Compute ISO week number
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number (Mon=1, Sun=7)
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Get month grouping key
 * Returns "YYYY-MM" format
 */
function getMonthKey(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Aggregate an array of daily ChartRawData items into a single aggregated bar.
 */
function aggregateGroup(items: ChartRawData[], prevClose: number | null): ChartRawData {
    const first = items[0];
    const last = items[items.length - 1];

    // Start with the last item's values (covers all indicator fields via spread)
    const result: ChartRawData = { ...last };

    // Override with correct aggregation rules
    result.date = first.date;                                       // date of first bar in group
    result.open = first.open;                                       // first open
    result.close = last.close;                                      // last close
    result.high = Math.max(...items.map((d) => d.high));            // max high
    result.low = Math.min(...items.map((d) => d.low));              // min low
    result.volume = items.reduce((sum, d) => sum + (d.volume || 0), 0); // sum volume

    // Recalculate diff / pct_change
    if (prevClose != null && prevClose !== 0) {
        result.diff = result.close - prevClose;
        result.pct_change = result.diff / prevClose;
    } else {
        result.diff = last.diff;
        result.pct_change = last.pct_change;
    }

    return result;
}

/**
 * Main aggregation function.
 *
 * @param data  Sorted daily data (ascending by date)
 * @param tf    Target timeframe
 * @returns     Aggregated data array, sorted ascending
 */
export function aggregateByTimeframe(data: ChartRawData[], tf: Timeframe): ChartRawData[] {
    if (tf === '1D' || data.length === 0) return data;

    const getKey = tf === '1W' ? getWeekKey : getMonthKey;

    // Group by key, preserving order
    const groups: ChartRawData[][] = [];
    let currentKey = '';
    let currentGroup: ChartRawData[] = [];

    for (const item of data) {
        const key = getKey(item.date);
        if (key !== currentKey) {
            if (currentGroup.length > 0) groups.push(currentGroup);
            currentGroup = [item];
            currentKey = key;
        } else {
            currentGroup.push(item);
        }
    }
    if (currentGroup.length > 0) groups.push(currentGroup);

    // Aggregate each group
    const result: ChartRawData[] = [];
    let prevClose: number | null = null;

    for (const group of groups) {
        const bar = aggregateGroup(group, prevClose);
        prevClose = bar.close;
        result.push(bar);
    }

    return result;
}
