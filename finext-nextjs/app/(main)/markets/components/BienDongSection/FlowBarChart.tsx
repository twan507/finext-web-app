'use client';

import { Box, useTheme } from '@mui/material';
import { fontWeight, getResponsiveFontSize } from 'theme/tokens';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface FlowBarChartProps {
    flowIn: number;
    flowOut: number;
    flowNeutral: number;
    chartHeight: string;
}

export default function FlowBarChart({ flowIn, flowOut, flowNeutral, chartHeight }: FlowBarChartProps) {
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
                columnWidth: '25%',
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
                colors: [theme.palette.text.primary],
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
            },
            axisBorder: {
                show: true,
                color: theme.palette.divider,
            },
            axisTicks: { show: false },
        },
        yaxis: {
            min: 0,
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
                    <Chart key={theme.palette.mode} options={chartOptions} series={series} type="bar" height="100%" width="100%" />
                </Box>
            </Box>
        </Box>
    );
}
