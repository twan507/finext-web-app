'use client';
import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { useTheme } from '@mui/material';
import { SubscriptionDistributionItem } from '../types';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface Props { data: SubscriptionDistributionItem[]; }

const SubscriptionDonut: React.FC<Props> = ({ data }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const series = useMemo(() => data.map((d) => d.count), [data]);
    const labels = useMemo(() => data.map((d) => d.license_name || d.license_key), [data]);

    const options: ApexOptions = {
        chart: { type: 'donut', background: 'transparent' },
        theme: { mode: isDark ? 'dark' : 'light' },
        labels,
        legend: { position: 'bottom' },
        dataLabels: { enabled: true, formatter: (val: number) => `${val.toFixed(0)}%` },
        plotOptions: { pie: { donut: { size: '55%' } } },
    };

    return <Chart options={options} series={series} type="donut" height="300px" />;
};

export default SubscriptionDonut;
