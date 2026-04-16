'use client';

import { useMemo, useRef, useState } from 'react';
import { Box, Skeleton, Typography, useTheme } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { getResponsiveFontSize } from 'theme/tokens';
import { apiClient } from 'services/apiClient';

import {
    type FinstatsStockRecord,
    type FinstatsMapEntry,
    type IndustryType,
    type ProcessedMetric,
    STOCK_SECTIONS,
    FOCUS_METRIC_DEFAULT,
    METRIC_FORMAT_CONFIG,
    formatMetricValue,
    formatMetricDelta,
} from './stock-financials-config';
import StockFinancialsHeaderBar from './StockFinancialsHeaderBar';
import StockFinancialsFocusChart from './StockFinancialsFocusChart';
import StockFinancialsMetricSection from './StockFinancialsMetricSection';

interface Props {
    ticker: string;
}

export default function StockFinancialsSection({ ticker }: Props) {
    const theme = useTheme();
    const chartRef = useRef<HTMLDivElement>(null);

    const [mode, setMode] = useState<'Q' | 'Y'>('Q');
    const [focusKey, setFocusKey] = useState<string>(FOCUS_METRIC_DEFAULT);

    // ── Fetch stock financial records ───────────────────────────────────────
    const { data: rawRecords = [], isLoading } = useQuery<FinstatsStockRecord[]>({
        queryKey: ['finstats_stock', ticker.toUpperCase(), mode],
        queryFn: async () => {
            const res = await apiClient<FinstatsStockRecord[]>({
                url: '/api/v1/sse/rest/finstats_stock',
                method: 'GET',
                queryParams: { ticker: ticker.toUpperCase(), sort_by: mode },
                requireAuth: false,
            });
            return res.data ?? [];
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // ── Fetch finstats_map for metric names ─────────────────────────────────
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
        staleTime: 60 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // ── Sort records asc by period ──────────────────────────────────────────
    const sortedRecords = useMemo(
        () => [...rawRecords].sort((a, b) => a.period.localeCompare(b.period)),
        [rawRecords],
    );

    const latestRecord = sortedRecords[sortedRecords.length - 1];
    const industryType = (latestRecord?.type ?? 'SXKD') as IndustryType;
    const industryName = latestRecord?.industry_name ?? '';
    const latestPeriod = latestRecord?.period ?? '';

    // ── Metric name map ─────────────────────────────────────────────────────
    const metricNameMap = useMemo(() => {
        const map: Record<string, string> = {};
        for (const entry of finstatsMapEntries) {
            if (entry.type === industryType) {
                map[entry.code] = entry.vi;
            }
        }
        return map;
    }, [finstatsMapEntries, industryType]);

    // ── Process all metrics ─────────────────────────────────────────────────
    const processedMetrics = useMemo((): Record<string, ProcessedMetric> => {
        if (sortedRecords.length === 0) return {};

        const sections = STOCK_SECTIONS[industryType] ?? STOCK_SECTIONS['SXKD'];
        const allKeys = new Set<string>(sections.flatMap((s) => s.metrics));
        const result: Record<string, ProcessedMetric> = {};

        for (const key of allKeys) {
            const values: (number | null)[] = sortedRecords.map((r) => {
                const v = r[key] as number | null | undefined;
                if (v == null || (typeof v === 'number' && (isNaN(v) || !isFinite(v)))) return null;
                return v;
            });

            const latestRaw = values[values.length - 1];
            const prevRaw = values.length >= 2 ? values[values.length - 2] : null;
            const deltaRaw = latestRaw != null && prevRaw != null ? latestRaw - prevRaw : null;

            const validValues = values.filter((v): v is number => v != null);
            const minRaw = validValues.length > 0 ? Math.min(...validValues) : null;
            const maxRaw = validValues.length > 0 ? Math.max(...validValues) : null;

            const { text: displayDelta, color: deltaColor } = formatMetricDelta(key, deltaRaw, latestRaw, prevRaw);

            result[key] = {
                key,
                name: (metricNameMap[key] ?? key).replace(/ YoY$| QoQ$/i, ''),
                value: latestRaw,
                displayValue: formatMetricValue(key, latestRaw),
                delta: deltaRaw,
                displayDelta,
                deltaColor,
                sparklineValues: values,
                displayMin: formatMetricValue(key, minRaw),
                displayMax: formatMetricValue(key, maxRaw),
            };
        }

        return result;
    }, [sortedRecords, industryType, metricNameMap]);

    // ── Focus chart data ────────────────────────────────────────────────────
    const focusChartData = useMemo(() => {
        const periods = sortedRecords.map((r) => r.period);
        const values: (number | null)[] = sortedRecords.map((r) => {
            const v = r[focusKey] as number | null | undefined;
            if (v == null || (typeof v === 'number' && (isNaN(v) || !isFinite(v)))) return null;
            return v;
        });
        return { periods, values };
    }, [sortedRecords, focusKey]);

    const focusMetricName = processedMetrics[focusKey]?.name ?? focusKey;
    const sections = STOCK_SECTIONS[industryType] ?? STOCK_SECTIONS['SXKD'];

    const handleFocusChange = (key: string) => {
        setFocusKey(key);
        chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    const handleModeChange = (newMode: 'Q' | 'Y') => {
        setMode(newMode);
        setFocusKey(FOCUS_METRIC_DEFAULT);
    };

    // ── Loading ─────────────────────────────────────────────────────────────
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

    // ── Empty ───────────────────────────────────────────────────────────────
    if (sortedRecords.length === 0) {
        return (
            <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: theme.palette.text.secondary }}>
                    Không có dữ liệu tài chính cho mã {ticker}.
                </Typography>
            </Box>
        );
    }

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <Box sx={{ mt: 2 }}>
            <StockFinancialsHeaderBar
                ticker={ticker}
                industryName={industryName}
                period={latestPeriod}
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
                />
            </Box>

            {sections.map((section) => {
                const sectionMetrics = section.metrics
                    .map((k) => processedMetrics[k])
                    .filter((m): m is ProcessedMetric => m != null);

                const sectionTitle = section.title;

                return (
                    <StockFinancialsMetricSection
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
