'use client';

import dynamic from 'next/dynamic';
import { Box, useTheme } from '@mui/material';
import { GuideChartFrame, ChartLoading } from './GuideChartFrame';
import { DEMO_BREADTH } from './demoChartData';

const BreadthPolarChart = dynamic(
  () => import('../../../home/components/marketSection/BreadthPolarChart'),
  { ssr: false, loading: () => <ChartLoading height={240} /> }
);

export default function GuidePolarChart() {
  const theme = useTheme();

  return (
    <GuideChartFrame
      title="Độ rộng thị trường trong phiên"
      icon="mdi:chart-arc"
      caption="Tỷ lệ số mã tăng, giảm và đứng giá cho thấy tâm lý chung của phiên."
    >
      <Box sx={{ maxWidth: 340, mx: 'auto' }}>
        <BreadthPolarChart
          series={[...DEMO_BREADTH.series]}
          labels={[...DEMO_BREADTH.labels]}
          colors={[theme.palette.trend.up, theme.palette.trend.down, theme.palette.trend.ref]}
          chartHeight="260px"
        />
      </Box>
    </GuideChartFrame>
  );
}
