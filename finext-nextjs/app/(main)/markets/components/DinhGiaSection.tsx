'use client';

import { useState, useMemo, useCallback } from 'react';
import { Box, Typography, Skeleton, useTheme, useMediaQuery } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'services/apiClient';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import PELineChart from './DinhGiaSection/PELineChart';
import FinancialsLineChart from './DinhGiaSection/FinancialsLineChart';
import FinancialsBarChart from './DinhGiaSection/FinancialsBarChart';
import PENganhChart from './DinhGiaSection/PENganhChart';
import type { PENganhDataPoint } from './DinhGiaSection/PENganhChart';

// ========== PE Ngành: danh sách ticker ngành ==========
const PE_NGANH_TICKERS = [
    'BAOHIEM', 'CHUNGKHOAN', 'NGANHANG', 'BANLE', 'BDS',
    'CAOSU', 'CONGNGHE', 'CONGNGHIEP', 'DAUKHI', 'DETMAY', 'DULICH',
    'HOACHAT', 'KCN', 'KHOANGSAN', 'KIMLOAI', 'NHUA', 'NONGNGHIEP',
    'THUCPHAM', 'THUYSAN', 'TIENICH', 'VANTAI', 'VLXD', 'XAYDUNG',
    'YTEGD',
];

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

// Raw response shape for PE Nganh (industry PE)
interface FinratiosNganhRecord {
    ticker: string;
    ticker_name?: string;
    ryd21?: number;  // P/E
    [key: string]: any;
}

// Format ISO date to MM/YYYY label
function formatISODate(dateStr: string): string {
    if (!dateStr) return '01/1970';
    const d = new Date(dateStr);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${yyyy}`;
}

// ========== Skeleton Loading Component ==========
function DinhGiaSkeleton({ isMobile }: { isMobile: boolean }) {
    // Skeleton for a line chart area
    const LineChartSkeleton = ({ height = 120 }: { height?: number }) => (
        <Box sx={{ position: 'relative', height, width: '100%', overflow: 'hidden' }}>
            {/* Y-axis labels */}
            <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} variant="text" width={30} height={14} animation="wave" />
                ))}
            </Box>
            {/* Chart area */}
            <Skeleton
                variant="rectangular"
                animation="wave"
                sx={{ ml: 5, height: height - 20, borderRadius: 1 }}
            />
        </Box>
    );

    // Skeleton for the date axis
    const DateAxisSkeleton = () => (
        <Box sx={{ mt: 0.5 }}>
            <Box sx={{ height: '2px', bgcolor: 'divider' }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, pl: 5 }}>
                {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} variant="text" width={55} height={14} animation="wave" />
                ))}
            </Box>
        </Box>
    );

    // Skeleton for the horizontal bar chart (Financials)
    const HorizontalBarSkeleton = () => (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Date label */}
            <Skeleton variant="text" width={80} height={18} animation="wave" />
            {/* 3 horizontal bars */}
            {[85, 50, 65].map((w, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Skeleton variant="text" width={60} height={14} animation="wave" />
                    <Skeleton
                        variant="rectangular"
                        animation="wave"
                        sx={{ flex: 1, maxWidth: `${w}%`, height: 20, borderRadius: 0.5 }}
                    />
                    <Skeleton variant="text" width={50} height={14} animation="wave" />
                </Box>
            ))}
        </Box>
    );

    // Skeleton for PE Nganh horizontal bar chart
    const PENganhSkeleton = () => (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
            {[70, 55, 85, 40, 65, 50, 75, 30, 60, 45, 80, 35, 55, 70, 45, 60, 50, 40, 75, 65, 55, 35, 50, 45].map((w, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Skeleton variant="text" width={75} height={14} animation="wave" sx={{ flexShrink: 0 }} />
                    <Skeleton
                        variant="rectangular"
                        animation="wave"
                        sx={{ width: `${w}%`, height: 14, borderRadius: 0.5 }}
                    />
                </Box>
            ))}
        </Box>
    );

    return (
        <Box sx={{ py: 3 }}>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? 2 : 5,
                }}
            >
                {/* Left column skeleton */}
                <Box sx={{ flex: 3, minWidth: 0 }}>
                    {/* Title */}
                    <Skeleton variant="text" width={320} height={24} animation="wave" />

                    {/* Subtitle + PE Line Chart */}
                    <Skeleton variant="text" width={180} height={16} animation="wave" sx={{ mt: 2 }} />
                    <LineChartSkeleton height={130} />

                    {/* Subtitle + Financials Line Chart */}
                    <Skeleton variant="text" width={220} height={16} animation="wave" sx={{ mt: 1 }} />
                    <LineChartSkeleton height={100} />

                    {/* Date axis */}
                    <DateAxisSkeleton />

                    {/* Financials Bar Chart */}
                    <HorizontalBarSkeleton />
                </Box>

                {/* Right column skeleton */}
                <Box sx={{ flex: 2, minWidth: 0 }}>
                    {/* Title */}
                    <Skeleton variant="text" width={150} height={24} animation="wave" />

                    {/* PE Nganh bars */}
                    <PENganhSkeleton />
                </Box>
            </Box>
        </Box>
    );
}

export default function DinhGiaSection() {
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

    // ========== Fetch finratios_industry for PE Ngành ==========
    const { data: rawPeNganh = [] } = useQuery<FinratiosNganhRecord[]>({
        queryKey: ['markets', 'finratios_industry', 'pe_nganh'],
        queryFn: async () => {
            const response = await apiClient<FinratiosNganhRecord[]>({
                url: '/api/v1/sse/rest/finratios_industry',
                method: 'GET',
                queryParams: {
                    ticker: PE_NGANH_TICKERS.join(','),
                    projection: JSON.stringify({ ryd21: 1, ticker: 1, ticker_name: 1 }),
                },
                requireAuth: false,
            });
            return response.data || [];
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    // Transform PE Nganh data to chart format
    const peNganhData = useMemo<PENganhDataPoint[]>(() => {
        if (!rawPeNganh.length) return [];

        // Lọc lấy bản ghi mới nhất (đầu tiên) cho mỗi ngành
        const latestByTicker = new Map<string, FinratiosNganhRecord>();

        for (const record of rawPeNganh) {
            if (record.ryd21 != null && record.ticker_name && !latestByTicker.has(record.ticker)) {
                latestByTicker.set(record.ticker, record);
            }
        }

        return Array.from(latestByTicker.values()).map(r => ({
            nganh: r.ticker_name!,
            peChange: r.ryd21!,
        }));
    }, [rawPeNganh]);

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

    // Latest market PE for the annotation line on PE Nganh chart
    const latestMarketPE = peChartData.length > 0 ? peChartData[peChartData.length - 1].pe : undefined;

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
        return <DinhGiaSkeleton isMobile={isMobile} />;
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
                        Thống kê định giá thị trường việt nam
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
                        P/E Ngành nghề
                    </Typography>
                    <PENganhChart data={peNganhData} marketPE={latestMarketPE} />
                </Box>
            </Box>
        </Box>
    );
}
