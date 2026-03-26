'use client';
import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { useTheme } from '@mui/material';
import { UserGrowthItem } from '../types';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface Props { data: UserGrowthItem[]; }

const UserGrowthChart: React.FC<Props> = ({ data }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const series = useMemo(() => [
        { name: 'Tổng users', data: data.map((d) => d.total_users) },
        { name: 'Users mới', data: data.map((d) => d.new_users) },
    ], [data]);

    const options: ApexOptions = {
        chart: { type: 'line', toolbar: { show: false }, background: 'transparent' },
        theme: { mode: isDark ? 'dark' : 'light' },
        colors: [theme.palette.primary.main, theme.palette.success.main],
        xaxis: { categories: data.map((d) => d.date) },
        stroke: { curve: 'smooth', width: [2, 2] },
        dataLabels: { enabled: false },
        grid: { borderColor: theme.palette.divider },
        legend: { position: 'top' },
    };

    return <Chart options={options} series={series} type="line" height="350px" />;
};

export default UserGrowthChart;
