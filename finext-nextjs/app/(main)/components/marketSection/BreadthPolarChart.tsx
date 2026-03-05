'use client';

import { Box, Typography, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface BreadthPolarChartProps {
    title?: string;
    series: number[];
    labels: string[];
    colors: string[];
    chartHeight: string;
}

export default function BreadthPolarChart({ title, series, labels, colors, chartHeight }: BreadthPolarChartProps) {
    const theme = useTheme();

    const total = series.reduce((a, b) => a + b, 0);
    const hasData = total > 0 && series.some(v => !isNaN(v));

    const LEGEND_HEIGHT = 30;
    const chartHeightNum = parseInt(chartHeight, 10);
    const adjustedChartHeight = !isNaN(chartHeightNum) ? `${chartHeightNum - LEGEND_HEIGHT}px` : chartHeight;

    const chartOptions: ApexOptions = {
        chart: {
            type: 'polarArea',
            background: 'transparent',
            toolbar: { show: false },
            fontFamily: 'inherit',
            animations: { enabled: false },
            sparkline: { enabled: false },
            selection: { enabled: false },
            events: {
                click: undefined,
                dataPointSelection: undefined,
            },
        },
        states: {
            hover: { filter: { type: 'none' } },
            active: { filter: { type: 'none' } },
        },
        labels: labels,
        colors: colors,
        stroke: {
            show: false,
            width: 0
        },
        fill: {
            opacity: 1
        },
        legend: {
            show: false
        },
        dataLabels: {
            enabled: hasData,
            formatter: function (val: number) {
                if (isNaN(val) || val === null || val === undefined) return '';
                return val.toFixed(1) + '%';
            },
            style: {
                fontSize: '0.75rem',
                fontWeight: String(fontWeight.semibold),
                colors: [theme.palette.text.primary],
            },
            background: {
                enabled: false,
            },
            dropShadow: {
                enabled: false
            },
        },
        plotOptions: {
            pie: {
                dataLabels: {
                    offset: 0,
                    minAngleToShowLabel: 5
                }
            },
            polarArea: {
                rings: {
                    strokeWidth: 0
                },
                spokes: {
                    strokeWidth: 0
                },
            }
        },
        yaxis: {
            show: false
        },
        tooltip: {
            enabled: false,
        }
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {title && (
                <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('lg'), fontWeight: fontWeight.semibold, mb: 0, textTransform: 'uppercase' }}>
                    {title}
                </Typography>
            )}
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', my: -1 }}>
                <Box sx={{
                    width: '100%', maxWidth: '280px', height: adjustedChartHeight,
                    '& .apexcharts-datalabels text, & .apexcharts-datalabel, & .apexcharts-data-labels text': {
                        stroke: theme.palette.background.default,
                        strokeWidth: 3,
                        strokeLinejoin: 'round',
                        paintOrder: 'stroke',
                    },
                }}>
                    <Chart key={theme.palette.mode} options={chartOptions} series={series} type="polarArea" height="100%" width="100%" />
                </Box>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 0.6, mb: 1, flexWrap: 'wrap' }}>
                {labels.map((label, index) => (
                    <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colors[index] }} />
                        <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.medium }}>
                            {label}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
