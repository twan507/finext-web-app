'use client';

import { useState, useMemo, useCallback } from 'react';
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'services/apiClient';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import PELineChart from './DinhGiaSection/PELineChart';
import FinancialsLineChart from './DinhGiaSection/FinancialsLineChart';
import FinancialsBarChart from './DinhGiaSection/FinancialsBarChart';
import PENganhChart from './DinhGiaSection/PENganhChart';
import type { PENganhDataPoint } from './DinhGiaSection/PENganhChart';

// Raw API response shape from finratios_industry
interface FinratiosRecord {
    date: string;
    ryd11?: number;  // Vốn hóa thị trường
    ryd21?: number;  // P/E
    rev?: number;    // Doanh thu thuần
    isa22?: number;  // LNST của Cổ đông Công ty mẹ
    [key: string]: any;
}

export interface PEChartDataPoint {
    date: string;
    pe: number;
    vonHoa: number;
    loiNhuan: number;
    doanhThu: number;
}

interface DinhGiaSectionProps {
    peNganhData: PENganhDataPoint[];
}

// Format ISO date to MM/YYYY label
function formatISODate(dateStr: string): string {
    if (!dateStr) return '01/1970';
    const d = new Date(dateStr);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${yyyy}`;
}

export default function DinhGiaSection({ peNganhData }: DinhGiaSectionProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // ========== Fetch finratios_industry for FNXINDEX ==========
    const { data: rawFinratios = [] } = useQuery<FinratiosRecord[]>({
        queryKey: ['markets', 'finratios_industry', 'FNXINDEX'],
        queryFn: async () => {
            const response = await apiClient<FinratiosRecord[]>({
                url: '/api/v1/sse/rest/finratios_industry',
                method: 'GET',
                queryParams: { ticker: 'FNXINDEX' },
                requireAuth: false,
            });
            return response.data || [];
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Transform raw data to chart data points
    const peChartData = useMemo<PEChartDataPoint[]>(() => {
        if (!rawFinratios.length) return [];

        // Sort by date chronologically
        const sorted = [...rawFinratios].sort((a, b) => {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });

        return sorted
            .filter(r => r.ryd21 != null && r.ryd11 != null)
            .map(r => ({
                date: formatISODate(r.date),
                pe: r.ryd21 ?? 0,
                vonHoa: r.ryd11 ?? 0,
                loiNhuan: r.isa22 ?? 0,
                doanhThu: r.rev ?? 0,
            }));
    }, [rawFinratios]);

    // Hover state: null = show last data point
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const handleDataPointHover = useCallback((index: number | null) => {
        setHoveredIndex(index);
    }, []);

    // Extract arrays for the synced line charts
    const dates = useMemo(() => peChartData.map(d => d.date), [peChartData]);
    const peValues = useMemo(() => peChartData.map(d => d.pe), [peChartData]);
    const vonHoa = useMemo(() => peChartData.map(d => d.vonHoa), [peChartData]);
    const loiNhuan = useMemo(() => peChartData.map(d => d.loiNhuan), [peChartData]);
    const doanhThu = useMemo(() => peChartData.map(d => d.doanhThu), [peChartData]);

    // Global max value across all data points (highest Vốn hóa)
    const globalMaxValue = useMemo(() => vonHoa.length ? Math.max(...vonHoa) : 1, [vonHoa]);

    // Snapshot values for the bar chart (active index or last)
    const activeIndex = hoveredIndex !== null ? hoveredIndex : peChartData.length - 1;
    const activeData = peChartData[activeIndex] || peChartData[peChartData.length - 1];

    if (!peChartData.length) {
        return (
            <Box sx={{ py: 3 }}>
                <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('sm') }}>
                    Đang tải dữ liệu định giá...
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ py: 3 }}>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? 2 : 5,
                }}
            >
                {/* Left: 3 synchronized charts stacked */}
                <Box sx={{ flex: 3, minWidth: 0 }}>
                    {/* Chart 1: P/E Line */}
                    <Typography
                        color="text.secondary"
                        sx={{
                            fontSize: getResponsiveFontSize('lg'),
                            fontWeight: fontWeight.semibold,
                            mb: 0,
                            textTransform: 'uppercase',
                        }}
                    >
                        Chỉ số P/E thị trường Việt Nam
                    </Typography>
                    <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('sm'), mb: 0.5, mt: 2 }}>
                        P/E thị trường Việt Nam
                    </Typography>
                    <PELineChart
                        dates={dates}
                        values={peValues}
                        onDataPointHover={handleDataPointHover}
                    />

                    {/* Chart 2: Financial Metrics Lines */}
                    <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('sm'), mt: 1 }}>
                        Vốn hóa, Lợi nhuận, Doanh thu
                    </Typography>
                    <FinancialsLineChart
                        dates={dates}
                        vonHoa={vonHoa}
                        loiNhuan={loiNhuan}
                        doanhThu={doanhThu}
                        onDataPointHover={handleDataPointHover}
                    />

                    {/* Date axis with line, ticks, and formatted labels */}
                    {(() => {
                        const totalPoints = dates.length;
                        const labelCount = 5;
                        const step = Math.max(1, Math.floor((totalPoints - 1) / (labelCount - 1)));
                        const tickIndices: number[] = [];
                        for (let i = 0; i < totalPoints; i += step) tickIndices.push(i);
                        const lastIdx = totalPoints - 1;
                        if (lastIdx - tickIndices[tickIndices.length - 1] > step * 0.4) tickIndices.push(lastIdx);

                        const formatDate = (d: string) => {
                            const [mm, yyyy] = d.split('/');
                            return `Th ${mm} ${yyyy}`;
                        };

                        return (
                            <Box sx={{ position: 'relative', mt: -0.5 }}>
                                <Box sx={{ height: '2px', bgcolor: 'divider' }} />
                                <Box sx={{ position: 'relative', height: 24 }}>
                                    {tickIndices.map((idx, i) => {
                                        const pct = totalPoints <= 1 ? 50 : (idx / (totalPoints - 1)) * 100;
                                        const nearRight = pct > 95;
                                        const nearLeft = pct < 5;
                                        return (
                                            <Box
                                                key={idx}
                                                sx={{
                                                    position: 'absolute',
                                                    left: `${pct}%`,
                                                    transform: nearLeft ? 'translateX(0)' : nearRight ? 'translateX(-100%)' : 'translateX(-50%)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: nearLeft ? 'flex-start' : nearRight ? 'flex-end' : 'center',
                                                }}
                                            >
                                                <Box sx={{ width: '1px', height: 5, bgcolor: 'divider' }} />
                                                <Typography
                                                    color="text.secondary"
                                                    sx={{
                                                        fontSize: getResponsiveFontSize('xs'),
                                                        whiteSpace: 'nowrap',
                                                        mt: 0.25,
                                                    }}
                                                >
                                                    {formatDate(dates[idx])}
                                                </Typography>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </Box>
                        );
                    })()}

                    <Box sx={{ mt: 1 }}>
                    {activeData && (
                        <FinancialsBarChart
                            vonHoa={activeData.vonHoa}
                            loiNhuan={activeData.loiNhuan}
                            doanhThu={activeData.doanhThu}
                            maxValue={globalMaxValue}
                            date={activeData.date}
                        />
                    )}
                    </Box>
                </Box>

                {/* Right: PE Ngành Bar Chart */}
                <Box sx={{ flex: 2, minWidth: 0 }}>
                    <Typography
                        color="text.secondary"
                        sx={{
                            fontSize: getResponsiveFontSize('lg'),
                            fontWeight: fontWeight.semibold,
                            mb: 0,
                            textTransform: 'uppercase',
                        }}
                    >
                        PE Ngành
                    </Typography>
                    <PENganhChart data={peNganhData} />
                </Box>
            </Box>
        </Box>
    );
}
