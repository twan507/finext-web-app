'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Box, useTheme } from '@mui/material';
import { ApexOptions } from 'apexcharts';
import type { LineSeries } from '../WidgetRenderer';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

// Line chart ≤3 series, height 260, theme-aware theo theme.palette.mode.
export default function LineChart({ categories, series }: { categories?: string[]; series: LineSeries[] }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const chartSeries = useMemo(() => series.map((s) => ({ name: s.name, data: s.points.map((p) => Number(p) || 0) })), [series]);

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: 'line',
        background: 'transparent',
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 300 }
      },
      theme: { mode: theme.palette.mode },
      colors: [theme.palette.primary.main, theme.palette.info.main, theme.palette.warning.main],
      stroke: { width: 2, curve: 'smooth' },
      dataLabels: { enabled: false },
      grid: { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', strokeDashArray: 4 },
      xaxis: {
        categories: categories ?? [],
        labels: { style: { colors: theme.palette.text.secondary } },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: { labels: { style: { colors: theme.palette.text.secondary } } },
      legend: { show: series.length > 1, labels: { colors: theme.palette.text.secondary } },
      tooltip: { theme: theme.palette.mode }
    }),
    [theme, isDark, categories, series]
  );

  return (
    <Box sx={{ width: '100%' }}>
      <Chart key={theme.palette.mode} options={options} series={chartSeries} type="line" height={260} width="100%" />
    </Box>
  );
}
