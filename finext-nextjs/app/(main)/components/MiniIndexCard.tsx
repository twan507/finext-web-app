'use client';

import { useEffect, useState, useMemo } from 'react';
import { Box, Typography, Skeleton, useTheme } from '@mui/material';
import dynamic from 'next/dynamic';
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
}

const getChangeColor = (pctChange: number): string => {
    if (Math.abs(pctChange) < 0.01) return '#eab308';
    return pctChange > 0 ? '#22c55e' : '#ef4444';
};

// Màu nền fill cho chip %
const getChipBgColor = (pctChange: number): string => {
    if (Math.abs(pctChange) < 0.01) return '#eab308';
    return pctChange > 0 ? '#22c55e' : '#ef4444';
};

// Mũi tên tam giác
const getArrow = (pctChange: number): string => {
    if (Math.abs(pctChange) < 0.01) return '';
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

export default function MiniIndexCard({ symbol, itdData }: MiniIndexCardProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [tickerName, setTickerName] = useState<string>(symbol);
    const [lastPrice, setLastPrice] = useState<number | null>(null);
    const [baselinePrice, setBaselinePrice] = useState<number | null>(null);
    const [diff, setDiff] = useState<number | null>(null);
    const [pctChange, setPctChange] = useState<number | null>(null);

    // Check if data is loading (itdData is empty array initially)
    const isLoading = itdData.length === 0;

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

    const lineColor = lastPrice != null && baselinePrice != null && lastPrice >= baselinePrice ? '#22c55e' : '#ef4444';
    const changeColor = getChangeColor(pctChange ?? 0);
    const chipBgColor = getChipBgColor(pctChange ?? 0);
    const arrow = getArrow(pctChange ?? 0);

    const chartOptions: ApexOptions = useMemo(() => ({
        chart: {
            type: 'area',
            sparkline: { enabled: true },
            animations: { enabled: false }
        },
        stroke: { curve: 'smooth', width: 1.5 },
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
            }
        },
        fill: {
            type: 'gradient',
            gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1, stops: [0, 100] }
        },
        yaxis: {
            show: false,
            min: chartData.length > 0 ? Math.min(...chartData.map(d => d.value)) * 0.9995 : undefined,
            max: chartData.length > 0 ? Math.max(...chartData.map(d => d.value)) * 1.0005 : undefined
        }
    }), [lineColor, isDark, chartData, baselinePrice]);

    const chartSeries = useMemo(() => [{ name: symbol, data: chartData.map(d => d.value) }], [symbol, chartData]);

    const formatNumber = (num: number | null | undefined): string => {
        if (num == null) return '--';
        return num >= 1000
            ? num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : num.toFixed(2);
    };

    const formatDiff = (num: number | null | undefined): string => {
        if (num == null) return '--';
        const absNum = Math.abs(num);
        return absNum >= 1000
            ? absNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : absNum.toFixed(2);
    };

    const formatPctChange = (num: number | null | undefined): string => {
        if (num == null) return '--%';
        return `${Math.abs(num).toFixed(2)}%`;
    };

    if (isLoading && chartData.length === 0) {
        return (
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', width: 'calc((100% - 60px) / 6)', minWidth: 140 }}>
                <Skeleton variant="text" width="60%" height={22} />
                <Skeleton variant="text" width="90%" height={30} sx={{ mt: 0.5 }} />
                <Skeleton variant="rectangular" width="100%" height={60} sx={{ mt: 1, borderRadius: 1 }} />
            </Box>
        );
    }

    return (
        <Box sx={{
            p: 1.5, borderRadius: 2, bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
            width: 'calc((100% - 60px) / 6)', minWidth: 140, transition: 'all 0.2s ease',
            '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }
        }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tickerName}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, flexWrap: 'nowrap' }}>
                <Typography sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1, fontSize: '1.0rem' }}>
                    {formatNumber(lastPrice)}
                </Typography>
                <Typography sx={{ color: changeColor, fontWeight: 500, fontSize: '0.8rem', lineHeight: 1, mt: 0.2 }}>
                    {diff != null && diff !== 0 && (pctChange ?? 0) > 0 ? '+' : diff != null && diff !== 0 && (pctChange ?? 0) < 0 ? '-' : ''}{formatDiff(diff)}
                </Typography>
                <Box component="span" sx={{
                    px: 0.5,
                    py: 0.4,
                    borderRadius: 1,
                    bgcolor: chipBgColor,
                    color: '#fff',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    lineHeight: 1,
                }}>
                    {arrow && <span style={{ fontSize: '0.6rem', lineHeight: 1 }}>{arrow}</span>}
                    {formatPctChange(pctChange)}
                </Box>
            </Box>

            <Box sx={{ height: 60, mt: 1, mx: -0.5 }}>
                {chartData.length > 0 ? (
                    <ReactApexChart options={chartOptions} series={chartSeries} type="area" height={60} width="100%" />
                ) : (
                    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled', fontSize: '0.85rem' }}>
                        Không có dữ liệu
                    </Box>
                )}
            </Box>
        </Box>
    );
}
