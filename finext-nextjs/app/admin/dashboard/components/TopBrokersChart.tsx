'use client';
import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { useTheme } from '@mui/material';
import { TopBrokerItem, formatCurrency } from '../types';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface Props { data: TopBrokerItem[]; }

const TopBrokersChart: React.FC<Props> = ({ data }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const series = useMemo(() => [{
        name: 'Doanh thu',
        data: data.map((d) => d.total_revenue),
    }], [data]);

    const options: ApexOptions = {
        chart: { type: 'bar', toolbar: { show: false }, background: 'transparent' },
        theme: { mode: isDark ? 'dark' : 'light' },
        plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
        colors: [theme.palette.info.main],
        xaxis: { labels: { formatter: (val: string) => formatCurrency(Number(val)) } },
        tooltip: { y: { formatter: (val: number) => formatCurrency(val) } },
        dataLabels: { enabled: false },
        grid: { borderColor: theme.palette.divider },
        labels: data.map((d) => d.broker_name || d.broker_code),
    };

    return <Chart options={options} series={series} type="bar" height="300px" />;
};

export default TopBrokersChart;
