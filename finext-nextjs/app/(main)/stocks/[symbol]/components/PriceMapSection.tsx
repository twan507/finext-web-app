'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, useTheme, useMediaQuery, alpha, Chip, Collapse } from '@mui/material';
import { getResponsiveFontSize, fontWeight, borderRadius, getGlassCard } from 'theme/tokens';

// ─── Types ───────────────────────────────────────────────────────────────────────

interface PriceMapSectionProps {
    ticker: string;
    chartIndicatorData: Record<string, any> | null;
    currentPrice: number;
    currentDiff?: number;
    currentPctChange?: number;
}

type TimeframeKey = 'w' | 'm' | 'q' | 'y';
type GroupKey = 'ma' | 'open_high_low' | 'pivot' | 'fibonacci' | 'volume_profile';

interface PriceLevel {
    price: number;
    label: string;
    field: string;
    group: GroupKey;
    groupLabel: string;
    timeframe: TimeframeKey | null; // null for MA
    pctDiff: number; // % distance from current price
}

// ─── Constants ───────────────────────────────────────────────────────────────────

const TIMEFRAMES: { key: TimeframeKey; label: string; fullLabel: string }[] = [
    { key: 'w', label: 'W', fullLabel: 'WEEK' },
    { key: 'm', label: 'M', fullLabel: 'MONTH' },
    { key: 'q', label: 'Q', fullLabel: 'QUARTER' },
    { key: 'y', label: 'Y', fullLabel: 'YEAR' },
];

const GROUPS: { key: GroupKey; label: string; shortLabel: string }[] = [
    { key: 'ma', label: 'MA', shortLabel: 'MA' },
    { key: 'open_high_low', label: 'OHL', shortLabel: 'OHL' },
    { key: 'pivot', label: 'PIVOT', shortLabel: 'PIVOT' },
    { key: 'fibonacci', label: 'FIBONACCI', shortLabel: 'FIB' },
    { key: 'volume_profile', label: 'VOLUME PROFILE', shortLabel: 'VP' },
];

const TIMEFRAME_COLORS: Record<TimeframeKey, { dark: string; light: string }> = {
    w: { dark: '#69F0AE', light: '#2E7D32' },
    m: { dark: '#40C4FF', light: '#0277BD' },
    q: { dark: '#FFAB40', light: '#EF6C00' },
    y: { dark: '#FF5252', light: '#C62828' },
};

// MA uses its own color scheme (spectrum), but for the price map we just display a neutral chip
const MA_COLORS: Record<string, { dark: string; light: string }> = {
    ma5: { dark: '#69F0AE', light: '#2E7D32' },
    ma20: { dark: '#40C4FF', light: '#0277BD' },
    ma60: { dark: '#FFAB40', light: '#EF6C00' },
    ma120: { dark: '#E040FB', light: '#AA00FF' },
    ma240: { dark: '#FF5252', light: '#C62828' },
};

// Confluence threshold: levels within this % are grouped visually
const CONFLUENCE_THRESHOLD = 0.5; // 0.5%

// ─── Indicator field definitions ─────────────────────────────────────────────────

interface FieldDef {
    field: string;
    label: string;
    group: GroupKey;
    groupLabel: string;
    timeframe: TimeframeKey | null;
}

function buildFieldDefs(): FieldDef[] {
    const defs: FieldDef[] = [];

    // MA group
    const maFields = [
        { field: 'ma5', label: 'MA 5' },
        { field: 'ma20', label: 'MA 20' },
        { field: 'ma60', label: 'MA 60' },
        { field: 'ma120', label: 'MA 120' },
        { field: 'ma240', label: 'MA 240' },
    ];
    for (const f of maFields) {
        defs.push({ ...f, group: 'ma', groupLabel: 'MA', timeframe: null });
    }

    // Open-High-Low group
    for (const tf of TIMEFRAMES) {
        defs.push({ field: `${tf.key}_open`, label: 'OPEN', group: 'open_high_low', groupLabel: 'OHL', timeframe: tf.key });
        defs.push({ field: `${tf.key}_ph`, label: 'PREV HIGH', group: 'open_high_low', groupLabel: 'OHL', timeframe: tf.key });
        defs.push({ field: `${tf.key}_pl`, label: 'PREV LOW', group: 'open_high_low', groupLabel: 'OHL', timeframe: tf.key });
    }

    // Pivot group
    for (const tf of TIMEFRAMES) {
        defs.push({ field: `${tf.key}_pivot`, label: 'PIVOT', group: 'pivot', groupLabel: 'PIVOT', timeframe: tf.key });
        defs.push({ field: `${tf.key}_r1`, label: 'R1', group: 'pivot', groupLabel: 'PIVOT', timeframe: tf.key });
        defs.push({ field: `${tf.key}_s1`, label: 'S1', group: 'pivot', groupLabel: 'PIVOT', timeframe: tf.key });
    }

    // Fibonacci group
    for (const tf of TIMEFRAMES) {
        defs.push({ field: `${tf.key}_f382`, label: 'F382', group: 'fibonacci', groupLabel: 'FIBO', timeframe: tf.key });
        defs.push({ field: `${tf.key}_f500`, label: 'F500', group: 'fibonacci', groupLabel: 'FIBO', timeframe: tf.key });
        defs.push({ field: `${tf.key}_f618`, label: 'F618', group: 'fibonacci', groupLabel: 'FIBO', timeframe: tf.key });
    }

    // Volume Profile group
    for (const tf of TIMEFRAMES) {
        defs.push({ field: `${tf.key}_vah`, label: 'VAH', group: 'volume_profile', groupLabel: 'VP', timeframe: tf.key });
        defs.push({ field: `${tf.key}_poc`, label: 'POC', group: 'volume_profile', groupLabel: 'VP', timeframe: tf.key });
        defs.push({ field: `${tf.key}_val`, label: 'VAL', group: 'volume_profile', groupLabel: 'VP', timeframe: tf.key });
    }

    return defs;
}

const ALL_FIELD_DEFS = buildFieldDefs();

// ─── Default enabled preset ──────────────────────────────────────────────────────

const DEFAULT_TIMEFRAMES = new Set<TimeframeKey>(['m', 'q']);
const DEFAULT_GROUPS = new Set<GroupKey>(['ma', 'open_high_low', 'pivot', 'fibonacci']);

// ─── Helpers ─────────────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
    return price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatPct(pct: number): string {
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(2)}%`;
}

// Group nearby levels into confluence clusters
interface ConfluenceCluster {
    levels: PriceLevel[];
    avgPrice: number;
    avgPctDiff: number;
    isAbove: boolean;
}

function clusterLevels(levels: PriceLevel[]): ConfluenceCluster[] {
    if (levels.length === 0) return [];

    // Sort high to low
    const sorted = [...levels].sort((a, b) => b.price - a.price);
    const clusters: ConfluenceCluster[] = [];

    // Centroid-based clustering:
    // Each new level is compared to the running centroid (average price)
    // of the current cluster. If the gap exceeds the threshold,
    // finalize the cluster and start a new one.
    // This prevents chain-drift where individually close levels
    // extend a cluster far beyond the threshold.
    let currentCluster: PriceLevel[] = [sorted[0]];
    let centroidSum = sorted[0].price;

    for (let i = 1; i < sorted.length; i++) {
        const centroid = centroidSum / currentCluster.length;
        const currPrice = sorted[i].price;
        const pctGap = centroid > 0 ? Math.abs((centroid - currPrice) / centroid) * 100 : Infinity;

        if (pctGap <= CONFLUENCE_THRESHOLD) {
            currentCluster.push(sorted[i]);
            centroidSum += currPrice;
        } else {
            // Finalize cluster
            const avg = centroidSum / currentCluster.length;
            const avgPct = currentCluster.reduce((s, l) => s + l.pctDiff, 0) / currentCluster.length;
            clusters.push({
                levels: currentCluster,
                avgPrice: avg,
                avgPctDiff: avgPct,
                isAbove: avgPct > 0,
            });
            currentCluster = [sorted[i]];
            centroidSum = currPrice;
        }
    }

    // Last cluster
    const avg = centroidSum / currentCluster.length;
    const avgPct = currentCluster.reduce((s, l) => s + l.pctDiff, 0) / currentCluster.length;
    clusters.push({
        levels: currentCluster,
        avgPrice: avg,
        avgPctDiff: avgPct,
        isAbove: avgPct > 0,
    });

    return clusters;
}

// ─── Component ───────────────────────────────────────────────────────────────────

export default function PriceMapSection({ ticker, chartIndicatorData, currentPrice, currentDiff, currentPctChange }: PriceMapSectionProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const router = useRouter();

    // Toggle states
    const [enabledTimeframes, setEnabledTimeframes] = useState<Set<TimeframeKey>>(DEFAULT_TIMEFRAMES);
    const [enabledGroups, setEnabledGroups] = useState<Set<GroupKey>>(DEFAULT_GROUPS);

    // Collapse states
    const [resistanceCollapsed, setResistanceCollapsed] = useState(false);
    const [supportCollapsed, setSupportCollapsed] = useState(false);

    const toggleTimeframe = (tf: TimeframeKey) => {
        setEnabledTimeframes(prev => {
            const next = new Set(prev);
            if (next.has(tf)) next.delete(tf);
            else next.add(tf);
            return next;
        });
    };

    const toggleGroup = (g: GroupKey) => {
        setEnabledGroups(prev => {
            const next = new Set(prev);
            if (next.has(g)) next.delete(g);
            else next.add(g);
            return next;
        });
    };

    // Build price levels
    const priceLevels = useMemo<PriceLevel[]>(() => {
        if (!chartIndicatorData || currentPrice <= 0) return [];

        const levels: PriceLevel[] = [];

        for (const def of ALL_FIELD_DEFS) {
            const value = chartIndicatorData[def.field];
            if (value == null || typeof value !== 'number' || isNaN(value) || value <= 0) continue;

            // Filter by enabled toggles
            if (!enabledGroups.has(def.group)) continue;
            if (def.timeframe && !enabledTimeframes.has(def.timeframe)) continue;

            const pctDiff = ((value - currentPrice) / currentPrice) * 100;

            levels.push({
                price: value,
                label: def.label,
                field: def.field,
                group: def.group,
                groupLabel: def.groupLabel,
                timeframe: def.timeframe,
                pctDiff,
            });
        }

        return levels;
    }, [chartIndicatorData, currentPrice, enabledTimeframes, enabledGroups]);

    // Split into above & below first, then cluster each group separately
    const { aboveClusters, belowClusters } = useMemo(() => {
        const above = priceLevels.filter(l => l.pctDiff > 0.01);
        const below = priceLevels.filter(l => l.pctDiff <= 0.01);
        return { aboveClusters: clusterLevels(above), belowClusters: clusterLevels(below) };
    }, [priceLevels]);

    const getTimeframeColor = (tf: TimeframeKey | null, field?: string): string => {
        if (tf) return isDark ? TIMEFRAME_COLORS[tf].dark : TIMEFRAME_COLORS[tf].light;
        if (field && MA_COLORS[field]) return isDark ? MA_COLORS[field].dark : MA_COLORS[field].light;
        return theme.palette.text.secondary;
    };

    const getTimeframeLabel = (tf: TimeframeKey | null): string => {
        if (!tf) return '—';
        return TIMEFRAMES.find(t => t.key === tf)?.fullLabel ?? tf.toUpperCase();
    };

    // No data state
    if (!chartIndicatorData || currentPrice <= 0) {
        return (
            <Box>
                <Box sx={{
                    ...getGlassCard(isDark),
                    p: 2,
                    borderRadius: `${borderRadius.lg}px`,
                }}>

                    <Typography color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>
                        Đang tải dữ liệu chỉ báo...
                    </Typography>
                </Box>
            </Box>
        );
    }

    return (
        <Box>
            <Box sx={{
                ...getGlassCard(isDark),
                p: 2,
                borderRadius: `${borderRadius.lg}px`,
            }}>
                {/* Title */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography sx={{
                        fontSize: getResponsiveFontSize('lg'),
                        fontWeight: fontWeight.semibold,
                        color: theme.palette.text.secondary,
                    }}>
                        MA TRẬN HỢP LƯU KỸ THUẬT CỔ PHIẾU {ticker}
                    </Typography>
                    <Box component={isMobile ? 'span' : 'a'} href={isMobile ? undefined : `/charts/${ticker.toLowerCase()}`} target={isMobile ? undefined : '_blank'} onClick={isMobile ? () => router.push(`/charts/${ticker.toLowerCase()}`) : undefined} sx={{ textDecoration: 'none', cursor: 'pointer' }}>
                        <Typography sx={{
                            fontSize: getResponsiveFontSize('sm'),
                            fontWeight: fontWeight.bold,
                            color: theme.palette.primary.main,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            px: 1.5,
                            py: 0.5,
                            borderRadius: `${borderRadius.sm}px`,
                            transition: 'background 0.2s',
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.15) }
                        }}>
                            Mở biểu đồ ↗
                        </Typography>
                    </Box>
                </Box>

                {/* ─── Toggle Filters ─── */}
                <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {/* Timeframe toggles */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                        <Typography sx={{
                            fontSize: getResponsiveFontSize('xs'),
                            color: 'text.secondary',
                            fontWeight: fontWeight.medium,
                            minWidth: 52,
                        }}>
                            Khung:
                        </Typography>
                        {TIMEFRAMES.map(tf => {
                            const active = enabledTimeframes.has(tf.key);
                            const tfColor = isDark ? TIMEFRAME_COLORS[tf.key].dark : TIMEFRAME_COLORS[tf.key].light;
                            return (
                                <Chip
                                    key={tf.key}
                                    label={tf.fullLabel}
                                    size="small"
                                    onClick={() => toggleTimeframe(tf.key)}
                                    sx={{
                                        fontSize: getResponsiveFontSize('xs'),
                                        fontWeight: fontWeight.semibold,
                                        height: 26,
                                        bgcolor: active ? alpha(tfColor, 0.18) : 'transparent',
                                        color: active ? tfColor : theme.palette.text.disabled,
                                        border: `1px solid ${active ? alpha(tfColor, 0.4) : alpha(theme.palette.divider, 0.3)}`,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            bgcolor: alpha(tfColor, 0.12),
                                        },
                                    }}
                                />
                            );
                        })}
                    </Box>

                    {/* Group toggles */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                        <Typography sx={{
                            fontSize: getResponsiveFontSize('xs'),
                            color: 'text.secondary',
                            fontWeight: fontWeight.medium,
                            minWidth: 52,
                        }}>
                            Loại:
                        </Typography>
                        {GROUPS.map(g => {
                            const active = enabledGroups.has(g.key);
                            return (
                                <Chip
                                    key={g.key}
                                    label={g.label}
                                    size="small"
                                    onClick={() => toggleGroup(g.key)}
                                    sx={{
                                        fontSize: getResponsiveFontSize('xs'),
                                        fontWeight: fontWeight.semibold,
                                        height: 26,
                                        bgcolor: active ? alpha(theme.palette.primary.main, 0.15) : 'transparent',
                                        color: active ? theme.palette.primary.main : theme.palette.text.disabled,
                                        border: `1px solid ${active ? alpha(theme.palette.primary.main, 0.35) : alpha(theme.palette.divider, 0.3)}`,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                                        },
                                    }}
                                />
                            );
                        })}
                    </Box>
                </Box>

                {/* ─── Price Map Table ─── */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

                    {/* ═══ RESISTANCE ZONE ═══ */}
                    {aboveClusters.length > 0 && (
                        <>
                            <Collapse in={!resistanceCollapsed} timeout={200}>
                                {aboveClusters.map((cluster, ci) => (
                                    <ClusterRow
                                        key={`r-${ci}`}
                                        cluster={cluster}
                                        isDark={isDark}
                                        theme={theme}
                                        isResistance={true}
                                        getTimeframeColor={getTimeframeColor}
                                        getTimeframeLabel={getTimeframeLabel}
                                    />
                                ))}
                            </Collapse>

                            <Box
                                sx={{
                                    mt: 0,
                                    mb: 0.5,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    px: 1,
                                    py: 0.5,
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    borderRadius: `${borderRadius.sm}px`,
                                    '&:hover': { bgcolor: alpha(isDark ? '#69F0AE' : '#2E7D32', 0.06) },
                                    transition: 'background 0.15s',
                                }}
                                onClick={() => setResistanceCollapsed(v => !v)}
                            >
                                <Typography sx={{
                                    fontSize: getResponsiveFontSize('xs'),
                                    fontWeight: fontWeight.bold,
                                    color: isDark ? '#69F0AE' : '#2E7D32',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                }}>
                                    {resistanceCollapsed ? '▶' : '▲'} Kháng cự
                                </Typography>
                                <Box sx={{
                                    flex: 1,
                                    height: '1px',
                                    bgcolor: alpha(isDark ? '#69F0AE' : '#2E7D32', 0.25),
                                }} />
                                <Typography sx={{
                                    fontSize: getResponsiveFontSize('xxs'),
                                    color: theme.palette.text.disabled,
                                    fontVariantNumeric: 'tabular-nums',
                                }}>
                                    {aboveClusters.length} mốc
                                </Typography>
                            </Box>
                        </>
                    )}

                    {/* ━━━ CURRENT PRICE ━━━ */}
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        py: 1.25,
                        px: 1.5,
                        my: 0.75,
                        borderRadius: `${borderRadius.md}px`,
                        background: isDark
                            ? `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.18)}, ${alpha(theme.palette.warning.dark, 0.10)})`
                            : `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.12)}, ${alpha(theme.palette.warning.light, 0.06)})`,
                        border: `1.5px solid ${alpha(theme.palette.warning.main, 0.4)}`,
                        boxShadow: `0 0 16px ${alpha(theme.palette.warning.main, 0.12)}`,
                    }}>
                        <Box sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: theme.palette.warning.main,
                            boxShadow: `0 0 8px ${alpha(theme.palette.warning.main, 0.5)}`,
                            flexShrink: 0,
                        }} />
                        <Typography sx={{
                            fontSize: getResponsiveFontSize('md'),
                            fontWeight: fontWeight.bold,
                            color: theme.palette.warning.main,
                            fontVariantNumeric: 'tabular-nums',
                        }}>
                            {currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                        <Typography sx={{
                            fontSize: getResponsiveFontSize('sm'),
                            fontWeight: fontWeight.semibold,
                            color: theme.palette.warning.main,
                        }}>
                            Giá hiện tại
                        </Typography>
                        <Box sx={{ flex: 1 }} />
                        {currentDiff != null && currentPctChange != null && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography sx={{
                                    fontSize: getResponsiveFontSize('sm'),
                                    fontWeight: fontWeight.semibold,
                                    color: currentDiff >= 0 ? theme.palette.trend.up : theme.palette.trend.down,
                                    fontVariantNumeric: 'tabular-nums',
                                }}>
                                    {currentDiff >= 0 ? '+' : ''}{currentDiff.toFixed(2)}
                                </Typography>
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.25,
                                    px: 0.75,
                                    py: 0.25,
                                    bgcolor: currentDiff >= 0 ? theme.palette.trend.up : theme.palette.trend.down,
                                    color: '#fff',
                                    borderRadius: 1,
                                }}>
                                    <Box component="span" sx={{ fontSize: '0.65em', display: 'flex', mt: '0.5px' }}>
                                        {currentDiff >= 0 ? '▲' : '▼'}
                                    </Box>
                                    <Typography component="span" sx={{
                                        fontSize: getResponsiveFontSize('xs'),
                                        fontWeight: fontWeight.bold,
                                        fontVariantNumeric: 'tabular-nums',
                                        lineHeight: 1.2,
                                    }}>
                                        {Math.abs(currentPctChange * 100).toFixed(2)}%
                                    </Typography>
                                </Box>
                            </Box>
                        )}
                    </Box>

                    {/* ═══ SUPPORT ZONE ═══ */}
                    {belowClusters.length > 0 && (
                        <>
                            <Box
                                sx={{
                                    mt: 0.5,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    px: 1,
                                    py: 0.5,
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    borderRadius: `${borderRadius.sm}px`,
                                    '&:hover': { bgcolor: alpha(isDark ? '#FF5252' : '#C62828', 0.06) },
                                    transition: 'background 0.15s',
                                }}
                                onClick={() => setSupportCollapsed(v => !v)}
                            >
                                <Typography sx={{
                                    fontSize: getResponsiveFontSize('xs'),
                                    fontWeight: fontWeight.bold,
                                    color: isDark ? '#FF5252' : '#C62828',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                }}>
                                    {supportCollapsed ? '▶' : '▼'} Hỗ trợ
                                </Typography>
                                <Box sx={{
                                    flex: 1,
                                    height: '1px',
                                    bgcolor: alpha(isDark ? '#FF5252' : '#C62828', 0.25),
                                }} />
                                <Typography sx={{
                                    fontSize: getResponsiveFontSize('xxs'),
                                    color: theme.palette.text.disabled,
                                    fontVariantNumeric: 'tabular-nums',
                                }}>
                                    {belowClusters.length} mốc
                                </Typography>
                            </Box>

                            <Collapse in={!supportCollapsed} timeout={200}>
                                {belowClusters.map((cluster, ci) => (
                                    <ClusterRow
                                        key={`s-${ci}`}
                                        cluster={cluster}
                                        isDark={isDark}
                                        theme={theme}
                                        isResistance={false}
                                        getTimeframeColor={getTimeframeColor}
                                        getTimeframeLabel={getTimeframeLabel}
                                    />
                                ))}
                            </Collapse>
                        </>
                    )}

                    {priceLevels.length === 0 && (
                        <Typography color="text.secondary" sx={{
                            textAlign: 'center',
                            py: 4,
                            fontSize: getResponsiveFontSize('sm'),
                        }}>
                            Chọn ít nhất 1 khung thời gian và 1 loại chỉ báo
                        </Typography>
                    )}
                </Box>
            </Box>
        </Box>
    );
}

// ─── Cluster Row Sub-component ───────────────────────────────────────────────────

interface ClusterRowProps {
    cluster: ConfluenceCluster;
    isDark: boolean;
    theme: any;
    isResistance: boolean;
    getTimeframeColor: (tf: TimeframeKey | null, field?: string) => string;
    getTimeframeLabel: (tf: TimeframeKey | null) => string;
}

function ClusterRow({ cluster, isDark, theme, isResistance, getTimeframeColor, getTimeframeLabel }: ClusterRowProps) {
    const isConfluence = cluster.levels.length > 1;
    const zoneColor = isResistance
        ? (isDark ? '#69F0AE' : '#2E7D32')
        : (isDark ? '#FF5252' : '#C62828');

    return (
        <Box sx={{
            borderRadius: `${borderRadius.sm}px`,
            border: isConfluence
                ? `1px solid ${alpha(zoneColor, 0.25)}`
                : 'none',
            bgcolor: isConfluence
                ? alpha(zoneColor, 0.04)
                : 'transparent',
            mb: isConfluence ? 0.5 : 0,
            overflow: 'hidden',
        }}>
            {/* Confluence badge */}
            {isConfluence && (
                <Box sx={{
                    px: 1,
                    py: 0.25,
                    bgcolor: alpha(zoneColor, 0.08),
                    borderBottom: `1px solid ${alpha(zoneColor, 0.12)}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                }}>
                    <Typography sx={{
                        fontSize: getResponsiveFontSize('xxs'),
                        fontWeight: fontWeight.bold,
                        color: zoneColor,
                        letterSpacing: '0.3px',
                    }}>
                        HỢP LƯU ({cluster.levels.length} mốc)
                    </Typography>
                </Box>
            )}

            {/* Individual levels */}
            {cluster.levels
                .sort((a, b) => b.price - a.price)
                .map((level, li) => (
                    <Box
                        key={`${level.group}-${level.label}-${level.timeframe}-${li}`}
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '90px 1fr auto auto', md: '100px 1fr 50px 45px 75px' },
                            alignItems: 'center',
                            gap: { xs: 0.5, md: 1 },
                            px: 1.5,
                            py: 0.6,
                            borderBottom: li < cluster.levels.length - 1
                                ? `1px solid ${alpha(theme.palette.divider, 0.08)}`
                                : 'none',
                            '&:hover': {
                                bgcolor: alpha(zoneColor, 0.06),
                            },
                            transition: 'background 0.15s ease',
                        }}
                    >
                        {/* Price */}
                        <Typography sx={{
                            fontSize: getResponsiveFontSize('sm'),
                            fontWeight: fontWeight.semibold,
                            color: theme.palette.text.primary,
                            fontVariantNumeric: 'tabular-nums',
                        }}>
                            {formatPrice(level.price)}
                        </Typography>

                        {/* Label */}
                        <Typography sx={{
                            fontSize: getResponsiveFontSize('sm'),
                            fontWeight: fontWeight.bold,
                            color: getTimeframeColor(level.timeframe, level.field),
                        }}>
                            {level.label}
                        </Typography>

                        {/* Group badge */}
                        <Typography sx={{
                            fontSize: getResponsiveFontSize('xxs'),
                            fontWeight: fontWeight.medium,
                            color: theme.palette.text.secondary,
                            display: { xs: 'none', md: 'block' },
                        }}>
                            {level.groupLabel}
                        </Typography>

                        {/* Timeframe chip */}
                        <Box sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
                            {level.timeframe ? (
                                <Typography sx={{
                                    fontSize: getResponsiveFontSize('xxs'),
                                    fontWeight: fontWeight.bold,
                                    color: getTimeframeColor(level.timeframe),
                                    width: 22,
                                    textAlign: 'center',
                                }}>
                                    {level.timeframe.toUpperCase()}
                                </Typography>
                            ) : (
                                <Typography sx={{
                                    fontSize: getResponsiveFontSize('xxs'),
                                    color: theme.palette.text.disabled,
                                    width: 22,
                                    textAlign: 'center',
                                }}>
                                    —
                                </Typography>
                            )}
                        </Box>

                        {/* % distance */}
                        <Typography sx={{
                            fontSize: getResponsiveFontSize('xs'),
                            fontWeight: fontWeight.semibold,
                            color: zoneColor,
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                        }}>
                            {formatPct(level.pctDiff)}
                        </Typography>
                    </Box>
                ))}
        </Box>
    );
}
