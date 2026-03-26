'use client';
import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { useTheme } from '@mui/material';
import { TopPromotionItem } from '../types';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface Props { data: TopPromotionItem[]; }

const TopPromotionsChart: React.FC<Props> = ({ data }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const series = useMemo(() => [{
        name: 'Lượt sử dụng',
        data: data.map((d) => d.usage_count),
    }], [data]);

    const options: ApexOptions = {
        chart: { type: 'bar', toolbar: { show: false }, background: 'transparent' },
        theme: { mode: isDark ? 'dark' : 'light' },
        plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
        colors: [theme.palette.secondary.main],
        dataLabels: { enabled: true },
        grid: { borderColor: theme.palette.divider },
        labels: data.map((d) => d.code),
    };

    return <Chart options={options} series={series} type="bar" height="300px" />;
};

export default TopPromotionsChart;
