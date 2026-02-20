'use client';

import { useEffect, useState, useMemo } from 'react';
import { Box, Typography, Skeleton, useTheme } from '@mui/material';
import dynamic from 'next/dynamic';
import { transitions, getResponsiveFontSize, fontWeight, getGlassCard, getGlassHighlight, getGlassEdgeLight } from 'theme/tokens';
import { ApexOptions } from 'apexcharts';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface RawMarketData {
    ticker: string;
    ticker_name?: string;
    date: string;
    close: number;
    volume: number;
    diff?: number;
    pct_change?: number;
}

interface MiniIndexCardProps {
    symbol: string;
    itdData: RawMarketData[]; // Data được truyền từ parent (page.tsx) qua SSE
    todayData?: RawMarketData[]; // Fallback data từ today_index khi chưa có ITD
    hideOnTablet?: boolean; // Ẩn card ở tablet (md breakpoint)
    hideOnMobile?: boolean; // Ẩn card ở mobile (xs breakpoint)
}

// Can't access theme here easily for default params, so we'll refactor component to use theme inside.
// Or we can pass theme to these functions.
// Let's refactor the functions to accept theme.

const getChangeColor = (pctChange: number, theme: any): string => {
    // Nếu biến động nằm trong khoảng ±0.005% thì tô màu vàng (ref)
    if (Math.abs(pctChange) <= 0.005) return theme.palette.trend.ref;
    return pctChange > 0 ? theme.palette.trend.up : theme.palette.trend.down;
};

// Màu nền fill cho chip %
const getChipBgColor = (pctChange: number, theme: any): string => {
    return getChangeColor(pctChange, theme);
};

// Mũi tên tam giác
const getArrow = (pctChange: number): string => {
    // Không hiển thị mũi tên khi biến động nằm trong khoảng ±0.005%
    if (Math.abs(pctChange) <= 0.005) return '';
    return pctChange > 0 ? '▲' : '▼';
};

const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const vnDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const day = vnDate.getUTCDate().toString().padStart(2, '0');
    const month = (vnDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = vnDate.getUTCFullYear();
    const hours = vnDate.getUTCHours().toString().padStart(2, '0');
    const minutes = vnDate.getUTCMinutes().toString().padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
};

interface ChartDataPoint {
    value: number;
    dateStr: string;
}

export default function MiniIndexCard({ symbol, itdData, todayData = [], hideOnTablet = false, hideOnMobile = false }: MiniIndexCardProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [tickerName, setTickerName] = useState<string>(symbol);
    const [lastPrice, setLastPrice] = useState<number | null>(null);
    const [baselinePrice, setBaselinePrice] = useState<number | null>(null);
    const [diff, setDiff] = useState<number | null>(null);
    const [pctChange, setPctChange] = useState<number | null>(null);

    const hasItdData = itdData.length > 0;
    const hasTodayData = todayData.length > 0;

    // Check if data is loading (cả itdData và todayData đều chưa có)
    const isLoading = !hasItdData && !hasTodayData;

    // Dùng todayData làm fallback khi chưa có itdData
    useEffect(() => {
        if (!hasItdData && hasTodayData) {
            const lastRecord = todayData[todayData.length - 1];
            if (lastRecord?.ticker_name) setTickerName(lastRecord.ticker_name);
            setLastPrice(lastRecord.close);
            setDiff(lastRecord.diff ?? null);
            setPctChange(lastRecord.pct_change != null ? lastRecord.pct_change * 100 : null);
        }
    }, [hasItdData, hasTodayData, todayData]);

    // Process itdData from props (SSE data passed from parent)
    useEffect(() => {
        if (itdData && Array.isArray(itdData) && itdData.length > 0) {
            const validData = itdData.filter(
                (item) => item.date && typeof item.close === 'number' && !isNaN(item.close)
            );
            if (validData.length === 0) return;

            const sortedData = [...validData].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            if (sortedData[0]?.ticker_name) setTickerName(sortedData[0].ticker_name);
            setBaselinePrice(sortedData[0].close);
            setChartData(sortedData.map((item) => ({ value: item.close, dateStr: item.date })));

            const lastRecord = sortedData[sortedData.length - 1];
            setLastPrice(lastRecord.close);
            setDiff(lastRecord.diff ?? null);
            setPctChange(lastRecord.pct_change != null ? lastRecord.pct_change * 100 : null);
        }
    }, [itdData]);

    const lineColor = getChangeColor(pctChange ?? 0, theme);
    const changeColor = getChangeColor(pctChange ?? 0, theme);
    const chipBgColor = getChipBgColor(pctChange ?? 0, theme);
    const arrow = getArrow(pctChange ?? 0);

    // Luôn trống 2 điểm cuối để chấm tròn không bị che
    const MIN_POINTS = 58;
    const lastDataIndex = chartData.length - 1;
    const FIXED_POINTS = Math.max(MIN_POINTS, chartData.length + 2);

    // Pad data với null ở cuối để cố định x-axis
    const paddedData = useMemo(() => {
        const values = chartData.map(d => d.value);
        // Pad với null ở cuối để luôn đủ FIXED_POINTS điểm
        while (values.length < FIXED_POINTS) {
            values.push(null as unknown as number);
        }
        return values;
    }, [chartData, FIXED_POINTS]);

    const chartOptions: ApexOptions = useMemo(() => ({
        chart: {
            type: 'area',
            sparkline: { enabled: true },
            animations: { enabled: false },
            dropShadow: {
                enabled: true,
                top: 0,
                left: 0,
                blur: 5,
                opacity: 1,
                color: lineColor,
            }
        },
        stroke: {
            curve: 'smooth',
            width: 1.5,

        },
        colors: [lineColor],
        tooltip: {
            enabled: true,
            theme: isDark ? 'dark' : 'light',
            custom: function ({ dataPointIndex }: { dataPointIndex: number }) {
                const dataPoint = chartData[dataPointIndex];
                if (dataPoint) {
                    const dateTimeStr = formatDateTime(dataPoint.dateStr);
                    const priceStr = dataPoint.value.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    });
                    return `<div style="padding: 5px 10px; font-size: 12px; line-height: 1.5;">
                        ${dateTimeStr}<br/>
                        <strong>${priceStr}</strong>
                    </div>`;
                }
                return '';
            },
        },
        markers: {
            strokeWidth: 0,
            hover: {
                sizeOffset: 4
            },
            // Chấm tròn cố định tại điểm dữ liệu cuối cùng
            discrete: lastDataIndex >= 0 ? [{
                seriesIndex: 0,
                dataPointIndex: lastDataIndex,
                fillColor: lineColor,
                strokeColor: '#fff',
                size: 4,
                shape: 'circle'
            }] : []
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: isDark ? 0.45 : 0.55, // Light mode: opacity cao hơn
                opacityTo: isDark ? 0 : 0,
                stops: [0, 100]
            }
        },
        xaxis: {
            type: 'numeric',
            min: 0,
            max: FIXED_POINTS - 1,
            labels: { show: false },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            show: false,
            min: chartData.length > 0 ? Math.min(...chartData.map(d => d.value)) * 0.9995 : undefined,
            max: chartData.length > 0 ? Math.max(...chartData.map(d => d.value)) * 1.0005 : undefined
        }
    }), [lineColor, isDark, chartData, lastDataIndex]);

    const chartSeries = useMemo(() => [{ name: symbol, data: paddedData }], [symbol, paddedData]);

    // Desktop: 2 decimal places; Mobile: 1 decimal place
    const formatNumber = (num: number | null | undefined, decimals = 2): string => {
        if (num == null) return '--';
        return num >= 1000
            ? num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
            : num.toFixed(decimals);
    };

    const formatDiff = (num: number | null | undefined): string => {
        if (num == null) return '0.00';
        const absNum = Math.abs(num);
        return absNum >= 1000
            ? absNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : absNum.toFixed(2);
    };

    const formatPctChange = (num: number | null | undefined): string => {
        if (num == null) return '0.00%';
        return `${Math.abs(num).toFixed(2)}%`;
    };

    // Responsive styles cho card
    const cardSx = {
        p: { xs: 1, sm: 1.5 },
        borderRadius: '16px',
        minWidth: { xs: 0, sm: 150 },
        position: 'relative' as const,
        overflow: 'hidden',
        // Glass card base styles
        ...getGlassCard(isDark),
        // Desktop (lg+): 6 cards
        width: {
            xs: 'calc(33.333% - 8px)', // Mobile: 3 cards per row
            md: 'calc((100% - 36px) / 4)', // Tablet: 4 cards (hide 2)
            lg: 'calc((100% - 60px) / 6)', // Desktop: 6 cards
        },
        // Ẩn card ở tablet và mobile nếu hideOnTablet/hideOnMobile = true
        display: hideOnTablet
            ? { xs: 'none', lg: 'block' }
            : hideOnMobile
                ? { xs: 'none', sm: 'block' }
                : 'block',
        transition: transitions.all,
        // Top highlight line (::before)
        '&::before': getGlassHighlight(isDark),
        // Left edge light (::after)
        '&::after': getGlassEdgeLight(isDark),
    };

    if (isLoading && chartData.length === 0) {
        return (
            <Box sx={cardSx}>
                <Skeleton variant="text" width="60%" height={22} />
                <Skeleton variant="text" width="90%" height={30} sx={{ mt: 0.5 }} />
                <Skeleton variant="rectangular" width="100%" height={60} sx={{ mt: 1, borderRadius: 1 }} />
            </Box>
        );
    }

    return (
        <Box sx={cardSx}>
            <Typography variant="body2" sx={{ fontWeight: fontWeight.semibold, color: 'text.secondary', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tickerName}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, flexWrap: 'nowrap' }}>
                {/* Điểm số: mobile dùng 1 chữ số thập phân, desktop dùng 2 */}
                <Typography sx={{ fontWeight: fontWeight.bold, color: 'text.primary', lineHeight: 1, fontSize: getResponsiveFontSize('md') }}>
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                        {formatNumber(lastPrice, 2)}
                    </Box>
                    <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
                        {formatNumber(lastPrice, 1)}
                    </Box>
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {/* Biến động tuyệt đối: hiển thị trên mobile */}
                    <Typography sx={{ color: changeColor, fontWeight: fontWeight.medium, fontSize: getResponsiveFontSize('xs'), lineHeight: 1, display: 'block' }}>
                        {diff != null && diff !== 0 && (pctChange ?? 0) > 0 ? '+' : diff != null && diff !== 0 && (pctChange ?? 0) < 0 ? '-' : ''}{formatDiff(diff)}
                    </Typography>
                    <Box component="span" sx={{
                        px: 0.5,
                        py: 0.4,
                        borderRadius: 1,
                        bgcolor: chipBgColor,
                        color: '#fff',
                        fontSize: getResponsiveFontSize('xs'),
                        fontWeight: fontWeight.semibold,
                        whiteSpace: 'nowrap',
                        display: { xs: 'none', sm: 'inline-flex' },
                        alignItems: 'center',
                        lineHeight: 1,
                    }}>
                        {arrow && <span style={{ fontSize: '0.65em', lineHeight: 1 }}>{arrow}</span>}
                        {formatPctChange(pctChange)}
                    </Box>
                </Box>
            </Box>

            <Box sx={{ height: 60, mt: 1, mx: -0.5 }}>
                {chartData.length > 0 ? (
                    <ReactApexChart options={chartOptions} series={chartSeries} type="area" height={60} width="100%" />
                ) : (
                    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled', fontSize: getResponsiveFontSize('sm') }}>
                        Đang chờ dữ liệu
                    </Box>
                )}
            </Box>
        </Box>
    );
}
