'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

// Dynamically import ApexCharts to avoid SSR issues
const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const AssetAllocationChart = () => {
    const series = [45, 25, 20, 10];

    const options: ApexOptions = {
        chart: {
            type: 'donut',
        },
        labels: ['Technology', 'Finance', 'Crypto', 'Other'],
        colors: ['#8b5cf6', '#c084fc', '#a78bfa', '#ddd6fe'],
        plotOptions: {
            pie: {
                donut: {
                    size: '70%',
                },
            },
        },
        dataLabels: {
            enabled: false,
        },
        legend: {
            show: false,
        },
        tooltip: {
            enabled: true,
            y: {
                formatter: (val) => `${val}%`
            }
        },
        states: {
            hover: {
                // SỬA LỖI: Thêm 'as any' để bỏ qua lỗi type-checking không chính xác
                filter: {
                    type: 'lighten',
                    value: 0.05,
                } as any, 
            }
        }
    };

    return (
        <div className="chart-container" style={{ height: '200px' }}>
             <ApexChart options={options} series={series} type="donut" height="100%" />
        </div>
    );
};

export default AssetAllocationChart;