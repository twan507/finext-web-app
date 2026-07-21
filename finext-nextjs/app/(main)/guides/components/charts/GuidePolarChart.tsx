'use client';

import dynamic from 'next/dynamic';
import { Box, useTheme } from '@mui/material';
import { GuideChartFrame, ChartLoading } from './GuideChartFrame';
import { DEMO_BREADTH, DEMO_SCREENER_MATCH } from './demoChartData';

const BreadthPolarChart = dynamic(
  () => import('../../../home/components/marketSection/BreadthPolarChart'),
  { ssr: false, loading: () => <ChartLoading height={240} /> }
);

interface GuidePolarChartProps {
  variant: 'breadth' | 'screener';
}

export default function GuidePolarChart({ variant }: GuidePolarChartProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const muted = isDark ? '#3a3a3a' : '#d6d6d6';

  const config =
    variant === 'breadth'
      ? {
          title: 'Độ rộng thị trường trong phiên',
          icon: 'mdi:chart-arc',
          caption: 'Tỷ lệ số mã tăng, giảm và đứng giá cho thấy tâm lý chung của phiên.',
          series: [...DEMO_BREADTH.series],
          labels: [...DEMO_BREADTH.labels],
          colors: [theme.palette.trend.up, theme.palette.trend.down, theme.palette.trend.ref]
        }
      : {
          title: 'Bộ lọc thu hẹp thị trường',
          icon: 'mdi:filter-outline',
          caption: 'Từ hơn một nghìn mã, bộ lọc chỉ giữ lại nhóm nhỏ khớp đúng tiêu chí của bạn.',
          series: [...DEMO_SCREENER_MATCH.series],
          labels: [...DEMO_SCREENER_MATCH.labels],
          colors: [theme.palette.primary.main, muted]
        };

  return (
    <GuideChartFrame title={config.title} icon={config.icon} caption={config.caption}>
      <Box sx={{ maxWidth: 340, mx: 'auto' }}>
        <BreadthPolarChart
          series={config.series}
          labels={config.labels}
          colors={config.colors}
          chartHeight="260px"
        />
      </Box>
    </GuideChartFrame>
  );
}
