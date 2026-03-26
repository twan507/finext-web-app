'use client';
import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { useTheme } from '@mui/material';
import { TransactionStatusStats } from '../types';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface Props { data: TransactionStatusStats; }

const TransactionDonut: React.FC<Props> = ({ data }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const series = useMemo(() => [data.succeeded, data.pending, data.canceled], [data]);

    const options: ApexOptions = {
        chart: { type: 'donut', background: 'transparent' },
        theme: { mode: isDark ? 'dark' : 'light' },
        labels: ['Thành công', 'Chờ xử lý', 'Đã hủy'],
        colors: [theme.palette.success.main, theme.palette.warning.main, theme.palette.error.main],
        legend: { position: 'bottom' },
        dataLabels: { enabled: true, formatter: (val: number) => `${val.toFixed(0)}%` },
        plotOptions: { pie: { donut: { size: '55%' } } },
    };

    return <Chart options={options} series={series} type="donut" height="300px" />;
};

export default TransactionDonut;
