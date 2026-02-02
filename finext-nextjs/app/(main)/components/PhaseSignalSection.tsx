'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Box, Typography, useTheme, Skeleton, keyframes, alpha, useMediaQuery, Grid } from '@mui/material';
import { getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import { usePollingClient } from 'services/pollingClient';
import TimeframeSelector from 'components/common/TimeframeSelector';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { SignalPanelCompact } from './SignalPanel';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// ============================================================================
// TYPES
// ============================================================================

interface PhaseSignalData {
    date: string;
    final_phase: number; // -1: Rủi ro, 0: Nghi ngờ, 1: Ổn định
    pct_change: number;
    pct_return: number;
    // Buy signals (positive)
    buy_index_change?: 0 | 1;
    buy_ratio_change?: 0 | 1;
    buy_ms_score_stt?: 0 | 1;
    buy_vsi_volume_stt?: 0 | 1;
    buy_ms_value?: 0 | 1;
    buy_ms_diff?: 0 | 1;
    buy_ratio_strength?: 0 | 1;
    buy_ratio_value?: 0 | 1;
    // Sell signals (negative)
    sell_ratio_change?: 0 | 1;
    sell_ms_score_stt?: 0 | 1;
    sell_vsi_volume_stt?: 0 | 1;
    sell_ms_value?: 0 | 1;
    sell_ms_diff?: 0 | 1;
    sell_ratio_strength?: 0 | 1;
    sell_ratio_value?: 0 | 1;
}

type TimeRangeOption = '1M' | '3M' | '6M' | '1Y' | '5Y' | 'ALL';

const TIME_RANGE_OPTIONS: TimeRangeOption[] = ['1M', '3M', '6M', '1Y', '5Y', 'ALL'];

// ============================================================================
// KEYFRAME ANIMATIONS
// ============================================================================

const pulseRing = keyframes`
    0% {
        transform: scale(0.8);
        opacity: 1;
    }
    50% {
        transform: scale(1.5);
        opacity: 0.4;
    }
    100% {
        transform: scale(2);
        opacity: 0;
    }
`;

const pulseCore = keyframes`
    0%, 100% {
        transform: scale(1);
        box-shadow: 0 0 0 0 currentColor;
    }
    50% {
        transform: scale(1.1);
        box-shadow: 0 0 8px 2px currentColor;
    }
`;

// ============================================================================
// PHASE INDICATOR COMPONENT
// ============================================================================

interface PhaseIndicatorProps {
    color: string;
}

function PhaseIndicator({ color }: PhaseIndicatorProps) {
    return (
        <Box
            sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 12,
                height: 12,
            }}
        >
            {/* Outer pulse ring */}
            <Box
                sx={{
                    position: 'absolute',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: color,
                    animation: `${pulseRing} 2s ease-out infinite`,
                }}
            />
            {/* Inner core dot */}
            <Box
                sx={{
                    position: 'relative',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: color,
                    color: color,
                    animation: `${pulseCore} 2s ease-in-out infinite`,
                    zIndex: 1,
                }}
            />
        </Box>
    );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getPhaseInfo(phase: number, theme: any): { name: string; color: string } {
    switch (phase) {
        case 1:
            return { name: 'Ổn định', color: theme.palette.trend.up };
        case 0:
            return { name: 'Nghi ngờ', color: theme.palette.trend.ref };
        case -1:
            return { name: 'Rủi ro', color: theme.palette.trend.down };
        default:
            return { name: 'Không xác định', color: theme.palette.text.secondary };
    }
}

function getCutoffDate(range: TimeRangeOption): Date | null {
    if (range === 'ALL') return null;

    const now = new Date();
    switch (range) {
        case '1M':
            return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        case '3M':
            return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        case '6M':
            return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        case '1Y':
            return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        case '5Y':
            return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
        default:
            return null;
    }
}

function filterDataByTimeRange(data: PhaseSignalData[], range: TimeRangeOption): PhaseSignalData[] {
    const cutoff = getCutoffDate(range);
    if (!cutoff) return data;
    return data.filter(item => new Date(item.date) >= cutoff);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PhaseSignalSection() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [timeRange, setTimeRange] = useState<TimeRangeOption>('1Y');

    // Polling data with 10s interval
    const { data: rawData, isLoading, error } = usePollingClient<PhaseSignalData[]>(
        '/api/v1/sse/rest/phase_signal',
        {},
        { interval: 10000, enabled: true, useCache: true, cacheTtl: 5 * 60 * 1000 }
    );

    // Get current phase from latest data
    const currentPhase = useMemo(() => {
        if (!rawData || rawData.length === 0) return 0;
        const sortedAll = [...rawData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return sortedAll[0]?.final_phase ?? 0;
    }, [rawData]);

    // Get latest signal data for SignalPanel
    const latestSignalData = useMemo(() => {
        if (!rawData || rawData.length === 0) return null;
        const sortedAll = [...rawData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return sortedAll[0] ?? null;
    }, [rawData]);

    const { name: phaseName, color: phaseColor } = getPhaseInfo(currentPhase, theme);

    // Format date label for x-axis
    const formatDateLabel = useCallback((timestamp: number): string => {
        const date = new Date(timestamp);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${day}/${month}`;
    }, []);

    // Process data and build chart series with index-based x-axis
    const { chartSeries, annotations, idxToTs, idxToPhase } = useMemo(() => {
        if (!rawData || rawData.length === 0) {
            return { chartSeries: [], annotations: { xaxis: [] }, idxToTs: new Map<number, number>(), idxToPhase: new Map<number, number>() };
        }

        // Filter by time range
        const filteredData = filterDataByTimeRange(rawData, timeRange);
        if (filteredData.length === 0) {
            return { chartSeries: [], annotations: { xaxis: [] }, idxToTs: new Map<number, number>(), idxToPhase: new Map<number, number>() };
        }

        // Sort by date ascending
        const sortedData = [...filteredData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Build timestamp -> index mapping (to skip market holidays)
        const allTimestamps = sortedData.map(item => new Date(item.date).getTime());
        const timestampToIndex = new Map<number, number>();
        const idxToTsMap = new Map<number, number>();
        const idxToPhaseMap = new Map<number, number>();
        allTimestamps.forEach((ts, index) => {
            timestampToIndex.set(ts, index);
            idxToTsMap.set(index, ts);
            idxToPhaseMap.set(index, sortedData[index].final_phase);
        });

        // Calculate cumulative returns
        let cumVnindex = 0;
        let cumPhase = 0;

        const vnindexData: { x: number; y: number }[] = [];
        const phaseData: { x: number; y: number }[] = [];
        const phases: { index: number; phase: number }[] = [];

        sortedData.forEach((item, idx) => {
            const pctChange = item.pct_change || 0;
            const pctReturn = item.pct_return !== undefined ? item.pct_return : pctChange;

            // VNINDEX return: luôn cộng dồn pct_change
            cumVnindex += pctChange * 100;

            // Phase return: luôn cộng dồn pct_return (đã tính toán sẵn ở backend)
            cumPhase += pctReturn * 100;

            vnindexData.push({ x: idx, y: parseFloat(cumVnindex.toFixed(2)) });
            phaseData.push({ x: idx, y: parseFloat(cumPhase.toFixed(2)) });
            phases.push({ index: idx, phase: item.final_phase });
        });

        // Normalize start to 0
        if (vnindexData.length > 0) {
            const baseVnindex = vnindexData[0].y;
            const basePhase = phaseData[0].y;
            vnindexData.forEach(p => p.y = parseFloat((p.y - baseVnindex).toFixed(2)));
            phaseData.forEach(p => p.y = parseFloat((p.y - basePhase).toFixed(2)));
        }

        // Build annotations for background colors based on phase
        const bgOpacity = theme.palette.mode === 'dark' ? 0.1 : 0.2;
        const xAxisAnnotations: any[] = [];
        if (phases.length > 0) {
            let currentPhaseVal = phases[0].phase;
            let startIdx = 0;

            for (let i = 1; i <= phases.length; i++) {
                const phaseVal = phases[i]?.phase;
                if (phaseVal !== currentPhaseVal || i === phases.length) {
                    // Create annotation for the previous phase segment
                    let fillColor: string;
                    switch (currentPhaseVal) {
                        case 1:
                            fillColor = alpha(theme.palette.trend.up, bgOpacity);
                            break;
                        case 0:
                            fillColor = alpha(theme.palette.trend.ref, bgOpacity);
                            break;
                        case -1:
                            fillColor = alpha(theme.palette.trend.down, bgOpacity);
                            break;
                        default:
                            fillColor = 'transparent';
                    }

                    // Extend x2 by 0.5 to fill gap between segments
                    xAxisAnnotations.push({
                        x: startIdx - 0.5,
                        x2: i - 0.5,
                        fillColor,
                        opacity: 1,
                        borderColor: 'transparent',
                    });

                    startIdx = i;
                    currentPhaseVal = phaseVal;
                }
            }
        }

        const series = [
            { name: 'Biến động VNINDEX', data: vnindexData },
            { name: 'Biến động FINEXT', data: phaseData },
        ];

        return { chartSeries: series, annotations: { xaxis: xAxisAnnotations }, idxToTs: idxToTsMap, idxToPhase: idxToPhaseMap };
    }, [rawData, timeRange, theme]);

    // Chart colors
    const chartColors = useMemo(() => [
        theme.palette.warning.main,
        theme.palette.primary.main,
    ], [theme]);

    // Generate yAxis annotations for price tags
    const yAxisAnnotations = useMemo(() => {
        return chartSeries.map((series, index) => {
            const data = series.data;
            if (!data || data.length === 0) return null;
            const lastPoint = data[data.length - 1];
            const color = chartColors[index % chartColors.length];

            return {
                y: lastPoint.y,
                borderColor: 'transparent',
                strokeDashArray: 0,
                label: {
                    borderColor: 'transparent',
                    style: {
                        color: theme.palette.text.primary,
                        background: alpha(color, 1),
                        fontSize: getResponsiveFontSize('sm').md,
                        fontWeight: fontWeight.medium,
                        padding: {
                            left: 6,
                            right: 6,
                            top: 2,
                            bottom: 2,
                        }
                    },
                    text: `${lastPoint.y.toFixed(1)}%`,
                    position: 'right',
                    textAnchor: 'start',
                    offsetX: 15.5,
                    offsetY: 0,
                }
            };
        }).filter(Boolean) as any[];
    }, [chartSeries, chartColors]);

    // ApexCharts options with index-based x-axis
    const chartOptions: ApexOptions = useMemo(() => ({
        chart: {
            type: 'line',
            height: 350,
            background: 'transparent',
            toolbar: { show: false },
            zoom: { enabled: false },
            fontFamily: 'inherit',
            animations: { enabled: true, speed: 300, dynamicAnimation: { enabled: true, speed: 150 } },
            redrawOnParentResize: true,
            dropShadow: {
                enabled: true,
                top: 0,
                left: 0,
                blur: 5,
                opacity: 1,
                color: chartColors as unknown as string,
            }
        },
        stroke: {
            width: 3,
            curve: 'smooth',
        },
        theme: { mode: theme.palette.mode },
        colors: chartColors,
        xaxis: {
            type: 'numeric',
            tickAmount: isMobile ? 6 : 10,
            tooltip: { enabled: false },
            axisBorder: { show: false },
            axisTicks: { show: false },
            crosshairs: {
                stroke: {
                    color: (theme.palette as any).component?.chart?.crosshair || theme.palette.divider,
                    width: 1,
                    dashArray: 3,
                },
            },
            labels: {
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: getResponsiveFontSize('sm').md,
                },
                rotate: 0,
                hideOverlappingLabels: true,
                formatter: (value: string) => {
                    const index = Math.round(parseFloat(value));
                    if (isNaN(index)) return '';
                    const ts = idxToTs.get(index);
                    if (!ts) return '';
                    return formatDateLabel(ts);
                },
            },
        },
        yaxis: {
            opposite: true,
            tickAmount: 5,
            labels: {
                formatter: (val: number) => `${val.toFixed(1)}%\u00A0\u00A0\u00A0`,
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: getResponsiveFontSize('sm').md,
                },
                offsetX: -10,
            },
        },
        annotations: {
            xaxis: annotations.xaxis,
            yaxis: yAxisAnnotations,
        },
        grid: {
            borderColor: theme.palette.divider,
            strokeDashArray: 0,
            padding: {
                left: 20,
                right: 5,
                bottom: -8,
                top: -19
            },
            xaxis: {
                lines: { show: false }
            },
            yaxis: {
                lines: { show: true }
            }
        },
        tooltip: {
            enabled: true,
            shared: true,
            intersect: false,
            style: {
                fontSize: '12px',
            },
            custom: function ({ series, seriesIndex, dataPointIndex, w }) {
                const xValue = w.globals.seriesX[seriesIndex][dataPointIndex];
                const index = Math.round(xValue);
                const ts = idxToTs.get(index);
                const phase = idxToPhase.get(index);

                let dateStr = '';
                if (ts) {
                    const date = new Date(ts);
                    const day = date.getDate().toString().padStart(2, '0');
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const year = date.getFullYear();
                    dateStr = `${day}/${month}/${year}`;
                }

                // Get phase info
                let phaseName = 'Không xác định';
                let phaseColor = theme.palette.text.secondary;
                if (phase !== undefined) {
                    const phaseInfo = getPhaseInfo(phase, theme);
                    phaseName = phaseInfo.name;
                    phaseColor = phaseInfo.color;
                }

                // Build series HTML
                let seriesHTML = '';
                series.forEach((seriesData: any, idx: number) => {
                    const value = seriesData[dataPointIndex];
                    if (value !== null && value !== undefined) {
                        const seriesName = w.globals.seriesNames[idx];
                        const color = w.globals.colors[idx];
                        const formattedValue = `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

                        seriesHTML += `
                            <div style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
                                <span style="width: 10px; height: 10px; border-radius: 50%; background: ${color};"></span>
                                <span style="flex: 1; font-size: 12px;">${seriesName}:</span>
                                <span style="font-weight: 600; font-size: 12px;">${formattedValue}</span>
                            </div>
                        `;
                    }
                });

                const bgColor = theme.palette.mode === 'dark' ? 'rgba(26, 26, 26, 0.9)' : 'rgba(255, 255, 255, 0.9)';
                const textColor = theme.palette.mode === 'dark' ? '#e0e0e0' : '#333333';

                return `
                    <div style="
                        background: ${bgColor};
                        border: none;
                        border-radius: 6px;
                        padding: 12px;
                        color: ${textColor};
                        min-width: 200px;
                        box-shadow: none !important;
                        filter: none !important;
                        -webkit-box-shadow: none !important;
                        -moz-box-shadow: none !important;
                    ">
                        <div style="font-weight: 600; margin-bottom: 8px; font-size: 13px; color: ${textColor};">
                            ${dateStr}
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${phaseColor};"></span>
                            <span style="flex: 1; font-size: 12px;">Giai đoạn:</span>
                            <span style="font-weight: 600; font-size: 12px; color: ${phaseColor};">${phaseName}</span>
                        </div>
                        ${seriesHTML}
                    </div>
                `;
            }
        },
        legend: {
            show: false,
        },
        markers: {
            size: 0,
            colors: [theme.palette.mode === 'dark' ? '#000000' : '#ffffff'],
            strokeColors: chartColors,
            strokeWidth: 2,
            hover: { size: 6 }
        },
    }), [theme, idxToTs, formatDateLabel, annotations, yAxisAnnotations, chartColors, isMobile]);

    // Handle time range change
    const handleTimeRangeChange = (_event: React.MouseEvent<HTMLElement>, newRange: TimeRangeOption | null) => {
        if (newRange !== null) setTimeRange(newRange);
    };

    // Loading skeleton
    if (isLoading && (!rawData || rawData.length === 0)) {
        return (
            <Box>
                <Skeleton variant="text" width={300} height={48} sx={{ mb: 1 }} />
                <Skeleton variant="text" width={150} height={36} sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" height={350} sx={{ borderRadius: 2 }} />
            </Box>
        );
    }

    // Error state
    if (error) {
        return (
            <Box>
                <Typography color="error">Lỗi tải dữ liệu: {error}</Typography>
            </Box>
        );
    }

    return (
        <Box>
            {/* Title */}
            <Typography sx={{ fontSize: getResponsiveFontSize('h4'), fontWeight: fontWeight.bold, mb: 1.5 }}>
                Tín hiệu thị trường
            </Typography>

            {/* Main 2-Column Layout */}
            <Grid container spacing={3} sx={{ alignItems: 'stretch' }}>
                {/* LEFT COLUMN: Phase Info + Signal Panel */}
                <Grid size={{ xs: 12, md: 4, lg: 3 }} sx={{ display: 'flex' }}>
                    <Box sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                    }}>
                        {/* Phase Info */}
                        <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('sm'),
                                        color: 'text.secondary',
                                        fontWeight: fontWeight.medium,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    Giai đoạn hiện tại
                                </Typography>
                                <PhaseIndicator color={phaseColor} />
                            </Box>
                            <Typography
                                sx={{
                                    mt: 0.5,
                                    fontSize: getResponsiveFontSize('xxl'),
                                    fontWeight: fontWeight.bold,
                                    color: phaseColor,
                                }}
                            >
                                {phaseName}
                            </Typography>
                        </Box>

                        {/* Signal Panel */}
                        <Box sx={{ flex: 1, minHeight: { xs: 'auto', md: 350 } }}>
                            <SignalPanelCompact
                                data={latestSignalData as any}
                                isLoading={isLoading}
                            />
                        </Box>
                    </Box>
                </Grid>

                {/* RIGHT COLUMN: Timeframe + Legend + Chart */}
                <Grid size={{ xs: 12, md: 8, lg: 9 }} sx={{ display: 'flex' }}>
                    <Box sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                    }}>
                        {/* Timeframe Selector (right aligned) */}
                        <Box sx={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            mb: 1,
                        }}>
                            <TimeframeSelector
                                value={timeRange}
                                onChange={handleTimeRangeChange}
                                options={TIME_RANGE_OPTIONS}
                            />
                        </Box>

                        {/* Custom Legend (center aligned) */}
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                            {chartSeries.map((series, index) => (
                                <Box key={series.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: chartColors[index] }} />
                                    <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.medium }}>
                                        {series.name}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>

                        {/* Chart */}
                        <Box sx={{
                            flex: 1,
                            width: '100%',
                            minHeight: 400,
                            '& .apexcharts-tooltip': {
                                boxShadow: 'none !important',
                                filter: 'none !important',
                                WebkitBoxShadow: 'none !important',
                                MozBoxShadow: 'none !important',
                                background: 'transparent !important',
                                border: 'none !important',
                                padding: '0 !important',
                            },
                            '& .apexcharts-tooltip.apexcharts-theme-light, & .apexcharts-tooltip.apexcharts-theme-dark': {
                                boxShadow: 'none !important',
                                filter: 'none !important',
                                background: 'transparent !important',
                            }
                        }}>
                            {chartSeries.length > 0 && chartSeries[0].data.length > 0 ? (
                                <Chart
                                    options={chartOptions}
                                    series={chartSeries}
                                    type="line"
                                    height="100%"
                                    width="100%"
                                />
                            ) : (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 350 }}>
                                    <Typography color="text.secondary">Không có dữ liệu</Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
}
