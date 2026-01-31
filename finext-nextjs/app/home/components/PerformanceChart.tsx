'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { getResponsiveFontSize } from 'theme/tokens';

// Dynamically import ApexCharts to avoid SSR issues
const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const PerformanceChart = () => {
    const series = [
        {
            name: 'Your Portfolio',
            data: [100, 115, 135, 150, 170, 199],
        },
        {
            name: 'S&P 500',
            data: [100, 110, 118, 126, 137, 155],
        }
    ];

    const options: ApexOptions = {
        chart: {
            type: 'line',
            toolbar: {
                show: false,
            },
            zoom: {
                enabled: false,
            }
        },
        colors: ['#8b5cf6', '#c084fc'],
        stroke: {
            width: [3, 2],
            curve: 'smooth',
            dashArray: [0, 5],
        },
        xaxis: {
            categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            labels: {
                show: true,
                style: {
                    colors: '#9ca3af',
                    fontSize: getResponsiveFontSize('xs').md,
                },
            },
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        yaxis: {
            show: false,
        },
        grid: {
            show: false,
        },
        legend: {
            show: false,
        },
        tooltip: {
            enabled: true,
            theme: 'dark',
        },
        markers: {
            size: 0,
        },
    };

    return (
        <div className="chart-container" style={{ height: '200px' }}>
            <ApexChart options={options} series={series} type="line" height="100%" />
        </div>
    );
};

export default PerformanceChart;