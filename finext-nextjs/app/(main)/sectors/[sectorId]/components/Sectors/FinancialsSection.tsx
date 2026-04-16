'use client';

import { useMemo, useRef, useState } from 'react';
import { Box, Skeleton, Typography, useTheme } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { getResponsiveFontSize } from 'theme/tokens';
import { apiClient } from 'services/apiClient';

import {
    type FinstatsRecord,
    type FinstatsMapEntry,
    type IndustryType,
    type ProcessedMetric,
    INDUSTRY_SECTIONS,
    FOCUS_METRIC_DEFAULT,
    isInvalidNumber,
    formatMetricValue,
    formatMetricDelta,
} from './financials-config';
import FinancialsHeaderBar from './FinancialsHeaderBar';
import FinancialsFocusChart from './FinancialsFocusChart';
import FinancialsMetricSection from './FinancialsMetricSection';

interface FinancialsSectionProps {
    ticker: string;
    indexName: string;
}

export default function FinancialsSection({ ticker, indexName }: FinancialsSectionProps) {
    const theme = useTheme();
    const chartRef = useRef<HTMLDivElement>(null);

    const [mode, setMode] = useState<'Q' | 'Y'>('Q');
    const [focusKey, setFocusKey] = useState<string>(FOCUS_METRIC_DEFAULT);
    const [selectedRecordIndex, setSelectedRecordIndex] = useState<number>(-1);

    // ── Fetch industry financial records — prefetch BOTH modes ─────────────
    const { data: rawRecordsQ = [], isLoading: isLoadingQ } = useQuery<FinstatsRecord[]>({
        queryKey: ['finstats_industry', ticker.toUpperCase(), 'Q'],
        queryFn: async () => {
            const res = await apiClient<FinstatsRecord[]>({
                url: '/api/v1/sse/rest/finstats_industry',
                method: 'GET',
                queryParams: { ticker: ticker.toUpperCase(), sort_by: 'Q' },
                requireAuth: false,
            });
            return res.data ?? [];
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const { data: rawRecordsY = [], isLoading: isLoadingY } = useQuery<FinstatsRecord[]>({
        queryKey: ['finstats_industry', ticker.toUpperCase(), 'Y'],
        queryFn: async () => {
            const res = await apiClient<FinstatsRecord[]>({
                url: '/api/v1/sse/rest/finstats_industry',
                method: 'GET',
                queryParams: { ticker: ticker.toUpperCase(), sort_by: 'Y' },
                requireAuth: false,
            });
            return res.data ?? [];
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const rawRecords = mode === 'Q' ? rawRecordsQ : rawRecordsY;
    const isLoading = mode === 'Q' ? isLoadingQ : isLoadingY;

    // ── Fetch metric name map (finstats_map) ─────────────────────────────────
    const { data: finstatsMapEntries = [] } = useQuery<FinstatsMapEntry[]>({
        queryKey: ['finstats_map'],
        queryFn: async () => {
            const res = await apiClient<FinstatsMapEntry[]>({
                url: '/api/v1/sse/rest/finstats_map',
                method: 'GET',
                requireAuth: false,
            });
            return res.data ?? [];
        },
        staleTime: 60 * 60 * 1000, // 1 hour — rarely changes
        refetchOnWindowFocus: false,
    });

    // ── Sort records asc by period (oldest → newest) ─────────────────────────
    const sortedRecords = useMemo(
        () => [...rawRecords].sort((a, b) => a.period.localeCompare(b.period)),
        [rawRecords],
    );

    const latestRecord = sortedRecords[sortedRecords.length - 1];
    const industryType = (latestRecord?.type ?? 'SXKD') as IndustryType;
    const industryName = latestRecord?.industry_name ?? indexName;
    const latestPeriod = latestRecord?.period ?? '';

    // -1 sentinel = "use last". Clamp to valid range.
    const resolvedIndex =
        sortedRecords.length === 0
            ? 0
            : selectedRecordIndex >= 0 && selectedRecordIndex < sortedRecords.length
            ? selectedRecordIndex
            : sortedRecords.length - 1;

    // ── Metric name map — filter by industryType ─────────────────────────────
    const metricNameMap = useMemo(() => {
        const map: Record<string, string> = {};
        for (const entry of finstatsMapEntries) {
            if (entry.type === industryType) {
                map[entry.code] = entry.vi;
            }
        }
        return map;
    }, [finstatsMapEntries, industryType]);

    // ── Process all metrics (delta, sparkline, min, max) ─────────────────────
    const processedMetrics = useMemo((): Record<string, ProcessedMetric> => {
        if (sortedRecords.length === 0) return {};

        const sections = INDUSTRY_SECTIONS[industryType] ?? INDUSTRY_SECTIONS['SXKD'];
        const allKeys = new Set<string>(sections.flatMap((s) => s.metrics));
        const result: Record<string, ProcessedMetric> = {};

        for (const key of allKeys) {
            const values: (number | null)[] = sortedRecords.map((r) => {
                const v = r[key] as number | null | undefined;
                if (isInvalidNumber(v)) return null;
                return v as number;
            });

            const selectedRaw = values[resolvedIndex] ?? null;
            const prevRaw = resolvedIndex >= 1 ? (values[resolvedIndex - 1] ?? null) : null;
            const deltaRaw = selectedRaw != null && prevRaw != null ? selectedRaw - prevRaw : null;

            const validValues = values.filter((v): v is number => v != null);
            const minRaw = validValues.length > 0 ? Math.min(...validValues) : null;
            const maxRaw = validValues.length > 0 ? Math.max(...validValues) : null;

            const { text: displayDelta, color: deltaColor } = formatMetricDelta(key, deltaRaw);

            result[key] = {
                key,
                name: (metricNameMap[key] ?? key).replace(/ YoY$| QoQ$/i, ''),
                value: selectedRaw,
                displayValue: formatMetricValue(key, selectedRaw),
                delta: deltaRaw,
                displayDelta,
                deltaColor,
                sparklineValues: values.length > 1 ? values.slice(1) : values,
                displayMin: formatMetricValue(key, minRaw, true),
                displayMax: formatMetricValue(key, maxRaw, true),
            };
        }

        return result;
    }, [sortedRecords, industryType, metricNameMap, resolvedIndex]);

    // ── Focus chart data ──────────────────────────────────────────────────────
    const focusChartData = useMemo(() => {
        const periods = sortedRecords.map((r) => r.period);
        const values: (number | null)[] = sortedRecords.map((r) => {
            const v = r[focusKey] as number | null | undefined;
            if (isInvalidNumber(v)) return null;
            return v as number;
        });
        return { periods, values };
    }, [sortedRecords, focusKey]);

    const focusMetricName = processedMetrics[focusKey]?.name ?? focusKey;
    const sections = INDUSTRY_SECTIONS[industryType] ?? INDUSTRY_SECTIONS['SXKD'];

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleFocusChange = (key: string) => {
        setFocusKey(key);
        if (chartRef.current) {
            const y = chartRef.current.getBoundingClientRect().top + window.scrollY - 140;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    };

    const handleModeChange = (newMode: 'Q' | 'Y') => {
        setMode(newMode);
        setFocusKey(FOCUS_METRIC_DEFAULT);
        setSelectedRecordIndex(-1);
    };

    // ── Loading skeleton ──────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <Box sx={{ mt: 2 }}>
                <Skeleton variant="text" width={320} height={20} sx={{ mb: 0.5 }} />
                <Skeleton variant="text" width={200} height={16} sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1, mb: 3 }} />
                {[1, 2, 3].map((i) => (
                    <Box key={i} sx={{ mb: 2.5 }}>
                        <Skeleton variant="text" width={140} height={14} sx={{ mb: 0.5 }} />
                        <Skeleton variant="rectangular" height={1} sx={{ mb: 0.5, opacity: 0.3 }} />
                        {[1, 2, 3, 4].map((j) => (
                            <Skeleton key={j} variant="text" height={28} sx={{ mb: 0.25 }} />
                        ))}
                    </Box>
                ))}
            </Box>
        );
    }

    // ── Empty state ───────────────────────────────────────────────────────────
    if (sortedRecords.length === 0) {
        return (
            <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: theme.palette.text.secondary }}>
                    Không có dữ liệu tài chính cho ngành này.
                </Typography>
            </Box>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <Box sx={{ mt: 2 }}>
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

            {sections.map((section) => {
                const sectionMetrics = section.metrics
                    .map((k) => processedMetrics[k])
                    .filter((m): m is ProcessedMetric => m != null);

                const sectionTitle = section.title;

                return (
                    <FinancialsMetricSection
                        key={section.id}
                        title={sectionTitle}
                        metrics={sectionMetrics}
                        focusedKey={focusKey}
                        onFocusChange={handleFocusChange}
                        mode={mode}
                    />
                );
            })}

        </Box>
    );
}
