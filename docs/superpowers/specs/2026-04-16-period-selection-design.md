# Period Selection Feature — Design Spec
Date: 2026-04-16

## Summary

Add a "selected period" interaction to the FinancialsFocusChart. Clicking a bar highlights that period and updates the Value + Delta columns in the metric rows below. Defaults to the latest period on load. Removes ApexCharts default hover/click color effects.

## Scope

4 files only:
- `finext-nextjs/app/(main)/sectors/[sectorId]/components/Sectors/FinancialsFocusChart.tsx`
- `finext-nextjs/app/(main)/sectors/[sectorId]/components/Sectors/FinancialsSection.tsx`
- `finext-nextjs/app/(main)/stocks/[symbol]/components/StockFinancialsFocusChart.tsx`
- `finext-nextjs/app/(main)/stocks/[symbol]/components/StockFinancialsSection.tsx`

## Architecture

### State (Approach A — state lifted to Section)

`selectedRecordIndex: number` lives in the Section component.
- Default: `sortedRecords.length - 1` (latest period)
- Reset: via `useEffect` watching `sortedRecords` — when records reload (mode switch, refetch), resets to last index automatically

### Index Mapping

Chart internally drops the first record (`periods.slice(1)`), so:
- `selectedBarIndex` (chart) = `selectedRecordIndex - 1`
- `onBarClick(barIndex)` → `setSelectedRecordIndex(barIndex + 1)`

## Chart Changes (FinancialsFocusChart + StockFinancialsFocusChart)

### New props
```typescript
selectedBarIndex: number;
onBarClick: (barIndex: number) => void;
```

### Disable default effects
```typescript
states: {
    hover:  { filter: { type: 'none' } },
    active: { filter: { type: 'none' } },
}
```

### Per-bar fill color
Convert bar series data from `number[]` to object array:
```typescript
data: displayValues.map((v, i) => ({
    x: xCategories[i],
    y: v,
    fillColor: i === selectedBarIndex
        ? primaryColor
        : isDark ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.2)',
}))
```

### Click event
```typescript
chart: {
    events: {
        dataPointSelection: (_e, _ctx, { dataPointIndex }) => {
            onBarClick(dataPointIndex);
        }
    }
}
```

### Chart header (value + delta above chart)
Replace always-latest logic with selection-aware:
```typescript
// shownValues[selectedBarIndex] = values[selectedBarIndex + 1]
const selectedRaw = shownValues[selectedBarIndex] ?? null;
const prevRaw     = values[selectedBarIndex] ?? null;
```

## Section Changes (FinancialsSection + StockFinancialsSection)

### New state
```typescript
const [selectedRecordIndex, setSelectedRecordIndex] = useState<number>(0);

// Auto-reset when records load/reload
useEffect(() => {
    if (sortedRecords.length > 0) {
        setSelectedRecordIndex(sortedRecords.length - 1);
    }
}, [sortedRecords]);
```

### processedMetrics — value + delta only
```typescript
// Before: always used values[values.length - 1]
// After:
const selectedRaw = values[selectedRecordIndex];
const prevRaw     = selectedRecordIndex >= 1 ? values[selectedRecordIndex - 1] : null;
```
sparklineValues, displayMin, displayMax remain unchanged.
Add `selectedRecordIndex` to useMemo deps.

### FinancialsHeaderBar period label
```typescript
// Before: period={latestPeriod}
// After:
period={sortedRecords[selectedRecordIndex]?.period ?? latestPeriod}
```

### Chart props
```typescript
<FinancialsFocusChart
    ...
    selectedBarIndex={selectedRecordIndex - 1}
    onBarClick={(barIndex) => setSelectedRecordIndex(barIndex + 1)}
/>
```

## Non-goals

- MetricRow, MetricSection, HeaderBar components are not modified
- sparklineValues, displayMin, displayMax are not affected by selection
- No changes to data fetching or API calls
