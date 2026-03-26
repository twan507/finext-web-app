'use client';
import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { useTheme } from '@mui/material';
import { RevenueTrendItem, formatCurrency } from '../types';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface Props { data: RevenueTrendItem[]; }

const RevenueTrendChart: React.FC<Props> = ({ data }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const series = useMemo(() => [{
        name: 'Doanh thu',
        data: data.map((d) => d.revenue),
    }], [data]);

    const options: ApexOptions = {
        chart: { type: 'area', toolbar: { show: false }, background: 'transparent' },
        theme: { mode: isDark ? 'dark' : 'light' },
        colors: [theme.palette.primary.main],
        xaxis: { categories: data.map((d) => d.date) },
        yaxis: { labels: { formatter: (val: number) => formatCurrency(val) } },
        tooltip: { y: { formatter: (val: number) => formatCurrency(val) } },
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
        stroke: { curve: 'smooth', width: 2 },
        dataLabels: { enabled: false },
        grid: { borderColor: theme.palette.divider },
    };

    return <Chart options={options} series={series} type="area" height="350px" />;
};

export default RevenueTrendChart;
