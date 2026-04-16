# Period Selection Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to click chart bars to select a reporting period; the Value and Delta columns in the metric rows below update to reflect the selected period, defaulting to the latest period on load.

**Architecture:** Lift `selectedRecordIndex` state to the Section component. Chart becomes a controlled component receiving `selectedBarIndex` + `onBarClick`. Section derives a `resolvedIndex` (defaults to last record) and recomputes `processedMetrics` value/delta using that index. Bar colors are per-data-point via fillColor; ApexCharts hover/active filters are disabled.

**Tech Stack:** React, TypeScript, ApexCharts (react-apexcharts), MUI

---

## File Map

| File | Change |
|---|---|
| `finext-nextjs/app/(main)/sectors/[sectorId]/components/Sectors/FinancialsFocusChart.tsx` | Add props, disable hover/active, per-bar color, update header |
| `finext-nextjs/app/(main)/sectors/[sectorId]/components/Sectors/FinancialsSection.tsx` | Add state, recompute metrics, pass props to chart |
| `finext-nextjs/app/(main)/stocks/[symbol]/components/StockFinancialsFocusChart.tsx` | Mirror of sectors chart changes |
| `finext-nextjs/app/(main)/stocks/[symbol]/components/StockFinancialsSection.tsx` | Mirror of sectors section changes |

---

### Task 1: Update FinancialsFocusChart.tsx (sectors)

**Files:**
- Modify: `finext-nextjs/app/(main)/sectors/[sectorId]/components/Sectors/FinancialsFocusChart.tsx`

- [ ] **Step 1: Update interface and props destructuring**

Replace the existing interface and function signature:

```typescript
interface FinancialsFocusChartProps {
    metricKey: string;
    metricName: string;
    periods: string[];
    values: (number | null)[];
    mode: 'Q' | 'Y';
    selectedBarIndex: number;
    onBarClick: (barIndex: number) => void;
}

export default function FinancialsFocusChart({
    metricKey,
    metricName,
    periods,
    values,
    mode,
    selectedBarIndex,
    onBarClick,
}: FinancialsFocusChartProps) {
```

- [ ] **Step 2: Update chart header computation**

Replace lines 39–42 (the `latestRaw`/`prevRaw`/`deltaRaw`/`deltaText` block) with selection-aware version.

`selectedBarIndex` is an index into `shownValues` (= `values.slice(1)`), so:
- selected value = `values[selectedBarIndex + 1]`
- previous value = `values[selectedBarIndex]`

```typescript
// selectedBarIndex is index into shownValues; shownValues[i] = values[i+1]
const selectedRaw = (selectedBarIndex + 1 < values.length) ? values[selectedBarIndex + 1] : null;
const prevRaw = (selectedBarIndex >= 0 && selectedBarIndex < values.length) ? values[selectedBarIndex] : null;
const deltaRaw = selectedRaw != null && prevRaw != null ? selectedRaw - prevRaw : null;
const { text: deltaText, color: deltaColor } = formatMetricDelta(metricKey, deltaRaw);
```

- [ ] **Step 3: Add `barData` useMemo for per-bar fill colors**

Add this after the `deltaValues` useMemo (after line ~70):

```typescript
const dimColor = isDark ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.2)';

const barData = useMemo(
    () =>
        displayValues.map((v, i) => ({
            x: xCategories[i],
            y: v,
            fillColor: i === selectedBarIndex ? primaryColor : dimColor,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayValues, xCategories, selectedBarIndex, primaryColor, dimColor],
);
```

- [ ] **Step 4: Update `options` useMemo — add states + click event**

Inside the `options` useMemo, update the `chart` key and add `states`:

```typescript
chart: {
    type: 'line',
    toolbar: { show: false },
    background: 'transparent',
    animations: { enabled: true, speed: 350 },
    zoom: { enabled: false },
    fontFamily: 'inherit',
    events: {
        dataPointSelection: (_e: any, _ctx: any, { dataPointIndex }: any) => {
            onBarClick(dataPointIndex);
        },
    },
},
// Add states after colors:
states: {
    hover:  { filter: { type: 'none' } },
    active: { filter: { type: 'none' } },
},
```

Also add `onBarClick` to the eslint-disable comment deps list so linter is accurate.

- [ ] **Step 5: Update `series` useMemo to use `barData`**

Replace:
```typescript
{ name: metricName, type: 'bar', data: displayValues },
```
With:
```typescript
{ name: metricName, type: 'bar', data: barData },
```

Update series deps: replace `displayValues` with `barData`:
```typescript
    [metricName, barData, deltaValues, mode],
```

- [ ] **Step 6: Update header JSX — replace `latestRaw` with `selectedRaw`**

In the return JSX, the header shows `formatMetricValue(metricKey, latestRaw)`. Change to `selectedRaw`:

```typescript
{formatMetricValue(metricKey, selectedRaw)}
```

---

### Task 2: Update FinancialsSection.tsx (sectors)

**Files:**
- Modify: `finext-nextjs/app/(main)/sectors/[sectorId]/components/Sectors/FinancialsSection.tsx`

- [ ] **Step 1: Add `selectedRecordIndex` state**

After the existing `const [focusKey, setFocusKey] = useState(...)` line, add:

```typescript
const [selectedRecordIndex, setSelectedRecordIndex] = useState<number>(-1);
```

- [ ] **Step 2: Derive `resolvedIndex` after `sortedRecords`**

After `const latestPeriod = latestRecord?.period ?? '';` (around line 76), add:

```typescript
// -1 sentinel = "use last". Clamp to valid range.
const resolvedIndex =
    sortedRecords.length === 0
        ? 0
        : selectedRecordIndex >= 0 && selectedRecordIndex < sortedRecords.length
        ? selectedRecordIndex
        : sortedRecords.length - 1;
```

- [ ] **Step 3: Update `handleModeChange` to reset selection**

```typescript
const handleModeChange = (newMode: 'Q' | 'Y') => {
    setMode(newMode);
    setFocusKey(FOCUS_METRIC_DEFAULT);
    setSelectedRecordIndex(-1);
};
```

- [ ] **Step 4: Update `processedMetrics` useMemo to use `resolvedIndex`**

Inside the `processedMetrics` useMemo, change the value/delta lines:

```typescript
// Before:
const latestRaw = values[values.length - 1];
const prevRaw = values.length >= 2 ? values[values.length - 2] : null;
const deltaRaw = latestRaw != null && prevRaw != null ? latestRaw - prevRaw : null;
// ...
const { text: displayDelta, color: deltaColor } = formatMetricDelta(key, deltaRaw);

result[key] = {
    key,
    name: (metricNameMap[key] ?? key).replace(/ YoY$| QoQ$/i, ''),
    value: latestRaw,
    displayValue: formatMetricValue(key, latestRaw),
    delta: deltaRaw,
    displayDelta,
    deltaColor,
    sparklineValues: values,
    displayMin: formatMetricValue(key, minRaw, true),
    displayMax: formatMetricValue(key, maxRaw, true),
};

// After:
const selectedRaw = values[resolvedIndex] ?? null;
const prevRaw = resolvedIndex >= 1 ? (values[resolvedIndex - 1] ?? null) : null;
const deltaRaw = selectedRaw != null && prevRaw != null ? selectedRaw - prevRaw : null;
// ...
const { text: displayDelta, color: deltaColor } = formatMetricDelta(key, deltaRaw);

result[key] = {
    key,
    name: (metricNameMap[key] ?? key).replace(/ YoY$| QoQ$/i, ''),
    value: selectedRaw,
    displayValue: formatMetricValue(key, selectedRaw),
    delta: deltaRaw,
    displayDelta,
    deltaColor,
    sparklineValues: values,
    displayMin: formatMetricValue(key, minRaw, true),
    displayMax: formatMetricValue(key, maxRaw, true),
};
```

Add `resolvedIndex` to the `useMemo` dependency array:
```typescript
    }, [sortedRecords, industryType, metricNameMap, resolvedIndex]);
```

- [ ] **Step 5: Pass new props to `FinancialsFocusChart` + update HeaderBar period**

```typescript
<FinancialsHeaderBar
    industryName={industryName}
    period={sortedRecords[resolvedIndex]?.period ?? latestPeriod}
    mode={mode}
    onModeChange={handleModeChange}
/>

<Box ref={chartRef}>
    <FinancialsFocusChart
        metricKey={focusKey}
        metricName={focusMetricName}
        periods={focusChartData.periods}
        values={focusChartData.values}
        mode={mode}
        selectedBarIndex={Math.max(0, resolvedIndex - 1)}
        onBarClick={(barIndex) => setSelectedRecordIndex(barIndex + 1)}
    />
</Box>
```

- [ ] **Step 6: Commit sectors changes**

```bash
git add finext-nextjs/app/\(main\)/sectors/\[sectorId\]/components/Sectors/FinancialsFocusChart.tsx
git add finext-nextjs/app/\(main\)/sectors/\[sectorId\]/components/Sectors/FinancialsSection.tsx
git commit -m "feat: period selection on sectors financials chart"
```

---

### Task 3: Update StockFinancialsFocusChart.tsx (stocks)

**Files:**
- Modify: `finext-nextjs/app/(main)/stocks/[symbol]/components/StockFinancialsFocusChart.tsx`

Apply the same changes as Task 1, mirrored for the stocks chart.

- [ ] **Step 1: Update interface and props destructuring**

```typescript
interface Props {
    metricKey: string;
    metricName: string;
    periods: string[];
    values: (number | null)[];
    mode: 'Q' | 'Y';
    selectedBarIndex: number;
    onBarClick: (barIndex: number) => void;
}

export default function StockFinancialsFocusChart({ metricKey, metricName, periods, values, mode, selectedBarIndex, onBarClick }: Props) {
```

- [ ] **Step 2: Update chart header computation**

Replace the `latestRaw`/`prevRaw`/`deltaRaw` block (lines 27–30) with:

```typescript
const selectedRaw = (selectedBarIndex + 1 < values.length) ? values[selectedBarIndex + 1] : null;
const prevRaw = (selectedBarIndex >= 0 && selectedBarIndex < values.length) ? values[selectedBarIndex] : null;
const deltaRaw = selectedRaw != null && prevRaw != null ? selectedRaw - prevRaw : null;
const { text: deltaText, color: deltaColor } = formatMetricDelta(metricKey, deltaRaw, selectedRaw, prevRaw);
```

Note: `StockFinancialsFocusChart` passes `latestRaw` and `prevRaw` to `formatMetricDelta` (4-arg version). Pass `selectedRaw` and `prevRaw` instead.

- [ ] **Step 3: Add `barData` useMemo**

After the `deltaValues` useMemo, add:

```typescript
const dimColor = isDark ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.2)';

const barData = useMemo(
    () =>
        displayValues.map((v, i) => ({
            x: xCategories[i],
            y: v,
            fillColor: i === selectedBarIndex ? primaryColor : dimColor,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayValues, xCategories, selectedBarIndex, primaryColor, dimColor],
);
```

- [ ] **Step 4: Update `options` useMemo — add states + click event**

Update the `chart` key and add `states`:

```typescript
chart: { type: 'line', toolbar: { show: false }, background: 'transparent', animations: { enabled: true, speed: 350 }, fontFamily: 'inherit', zoom: { enabled: false },
    events: {
        dataPointSelection: (_e: any, _ctx: any, { dataPointIndex }: any) => {
            onBarClick(dataPointIndex);
        },
    },
},
states: {
    hover:  { filter: { type: 'none' } },
    active: { filter: { type: 'none' } },
},
```

- [ ] **Step 5: Update `series` useMemo to use `barData`**

```typescript
const series = useMemo(() => [
    { name: metricName, type: 'bar', data: barData },
    { name: `Δ ${mode === 'Q' ? 'QoQ' : 'YoY'}`, type: 'line', data: deltaValues },
], [metricName, barData, deltaValues, mode]);
```

- [ ] **Step 6: Update header JSX — replace `latestRaw` with `selectedRaw`**

```typescript
{formatMetricValue(metricKey, selectedRaw)}
```

---

### Task 4: Update StockFinancialsSection.tsx (stocks)

**Files:**
- Modify: `finext-nextjs/app/(main)/stocks/[symbol]/components/StockFinancialsSection.tsx`

Apply the same changes as Task 2, mirrored for the stocks section.

- [ ] **Step 1: Add `selectedRecordIndex` state**

After `const [focusKey, setFocusKey] = useState(...)`:

```typescript
const [selectedRecordIndex, setSelectedRecordIndex] = useState<number>(-1);
```

- [ ] **Step 2: Derive `resolvedIndex` after `sortedRecords`**

After `const latestPeriod = latestRecord?.period ?? '';`:

```typescript
const resolvedIndex =
    sortedRecords.length === 0
        ? 0
        : selectedRecordIndex >= 0 && selectedRecordIndex < sortedRecords.length
        ? selectedRecordIndex
        : sortedRecords.length - 1;
```

- [ ] **Step 3: Update `handleModeChange` to reset selection**

```typescript
const handleModeChange = (newMode: 'Q' | 'Y') => {
    setMode(newMode);
    setFocusKey(FOCUS_METRIC_DEFAULT);
    setSelectedRecordIndex(-1);
};
```

- [ ] **Step 4: Update `processedMetrics` useMemo**

```typescript
// Change inside the for loop:
const selectedRaw = values[resolvedIndex] ?? null;
const prevRaw = resolvedIndex >= 1 ? (values[resolvedIndex - 1] ?? null) : null;
const deltaRaw = selectedRaw != null && prevRaw != null ? selectedRaw - prevRaw : null;

const { text: displayDelta, color: deltaColor } = formatMetricDelta(key, deltaRaw, selectedRaw, prevRaw);

result[key] = {
    key,
    name: (metricNameMap[key] ?? key).replace(/ YoY$| QoQ$/i, ''),
    value: selectedRaw,
    displayValue: formatMetricValue(key, selectedRaw),
    delta: deltaRaw,
    displayDelta,
    deltaColor,
    sparklineValues: values,
    displayMin: formatMetricValue(key, minRaw, true),
    displayMax: formatMetricValue(key, maxRaw, true),
};
```

Add `resolvedIndex` to the useMemo dependency array:
```typescript
    }, [sortedRecords, industryType, metricNameMap, resolvedIndex]);
```

- [ ] **Step 5: Pass new props to `StockFinancialsFocusChart` + update HeaderBar period**

```typescript
<StockFinancialsHeaderBar
    ticker={ticker}
    industryName={industryName}
    period={sortedRecords[resolvedIndex]?.period ?? latestPeriod}
    mode={mode}
    onModeChange={handleModeChange}
/>

<Box ref={chartRef}>
    <StockFinancialsFocusChart
        metricKey={focusKey}
        metricName={focusMetricName}
        periods={focusChartData.periods}
        values={focusChartData.values}
        mode={mode}
        selectedBarIndex={Math.max(0, resolvedIndex - 1)}
        onBarClick={(barIndex) => setSelectedRecordIndex(barIndex + 1)}
    />
</Box>
```

- [ ] **Step 6: Commit stocks changes**

```bash
git add finext-nextjs/app/\(main\)/stocks/\[symbol\]/components/StockFinancialsFocusChart.tsx
git add finext-nextjs/app/\(main\)/stocks/\[symbol\]/components/StockFinancialsSection.tsx
git commit -m "feat: period selection on stocks financials chart"
```
