'use client';

import { Box, useTheme, Skeleton } from '@mui/material';
import { fontWeight, getResponsiveFontSize } from 'theme/tokens';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface FlowBarChartProps {
    flowIn: number;
    flowOut: number;
    flowNeutral: number;
    chartHeight: string;
    isLoading?: boolean;
}

export default function FlowBarChart({ flowIn, flowOut, flowNeutral, chartHeight, isLoading = false }: FlowBarChartProps) {
    const theme = useTheme();

    const colors = [theme.palette.trend.up, theme.palette.trend.down, theme.palette.trend.ref];

    const chartOptions: ApexOptions = {
        chart: {
            type: 'bar',
            background: 'transparent',
            toolbar: { show: false },
            fontFamily: 'inherit',
            animations: { enabled: false },
        },
        plotOptions: {
            bar: {
                columnWidth: '50%',
                distributed: true,
                borderRadius: 4,
                borderRadiusApplication: 'end',
                dataLabels: {
                    position: 'top',
                },
            }
        },
        colors: colors,
        dataLabels: {
            enabled: true,
            formatter: function (val: number) {
                return val.toFixed(1) + ' tỷ';
            },
            style: {
                fontSize: getResponsiveFontSize('sm').md,
                fontWeight: String(fontWeight.semibold),
                colors: [theme.palette.text.secondary],
            },
            offsetY: -10,
            dropShadow: { enabled: false },
            background: { enabled: false },
        },
        xaxis: {
            categories: ['Tiền vào', 'Tiền ra', 'Không đổi'],
            labels: {
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: getResponsiveFontSize('sm').md,
                    fontWeight: fontWeight.medium,
                },
                offsetY: 4.1,
            },
            axisBorder: {
                show: true,
                color: theme.palette.divider,
            },
            axisTicks: { show: false },
        },
        yaxis: {
            min: 0,
            tickAmount: 4,
            forceNiceScale: true,
            labels: {
                style: {
                    colors: theme.palette.text.secondary,
                    fontSize: getResponsiveFontSize('sm').md,
                },
                formatter: function (val: number) {
                    return val.toFixed(0) + ' tỷ';
                },
            },
        },
        grid: {
            borderColor: theme.palette.divider,
            strokeDashArray: 0,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
            padding: { top: 0, bottom: 0, left: 15, right: 0 },
        },
        legend: { show: false },
        tooltip: { enabled: false },
        states: {
            hover: { filter: { type: 'none' } },
            active: { filter: { type: 'none' } },
        },
    };

    const series = [{
        name: 'Giá trị',
        data: [flowIn, flowOut, flowNeutral],
    }];



    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', my: -1 }}>
                <Box sx={{ width: '100%', height: chartHeight }}>
                    {isLoading ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', pt: 2 }}>
                            <Box sx={{ display: 'flex', flex: 1, gap: 1 }}>
                                {/* Y-axis labels */}
                                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', py: 1 }}>
                                    {[...Array(5)].map((_, i) => (
                                        <Skeleton key={i} variant="text" width={45} height={16} />
                                    ))}
                                </Box>
                                {/* Bars */}
                                <Box sx={{ display: 'flex', flex: 1, alignItems: 'flex-end', gap: 2, pb: 1, justifyContent: 'center' }}>
                                    {[65, 50, 35].map((h, i) => (
                                        <Skeleton
                                            key={i}
                                            variant="rectangular"
                                            sx={{
                                                width: '12%',
                                                height: `${h}%`,
                                                borderRadius: '4px 4px 0 0',
                                            }}
                                        />
                                    ))}
                                </Box>
                            </Box>
                            {/* X-axis labels */}
                            <Box sx={{ display: 'flex', gap: 2, pl: 6, justifyContent: 'center' }}>
                                {[1, 2, 3].map((i) => (
                                    <Skeleton key={i} variant="text" width={60} height={16} />
                                ))}
                            </Box>
                        </Box>
                    ) : (
                        <Chart key={theme.palette.mode} options={chartOptions} series={series} type="bar" height="100%" width="100%" />
                    )}
                </Box>
            </Box>
        </Box>
    );
}

