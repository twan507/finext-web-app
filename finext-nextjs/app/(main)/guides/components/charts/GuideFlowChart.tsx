'use client';

import dynamic from 'next/dynamic';
import { Box } from '@mui/material';
import { GuideChartFrame, ChartLoading } from './GuideChartFrame';
import { DEMO_FLOW } from './demoChartData';

const FlowBarChart = dynamic(
  () => import('../../../home/components/marketSection/FlowBarChart'),
  { ssr: false, loading: () => <ChartLoading height={240} /> }
);

export default function GuideFlowChart() {
  return (
    <GuideChartFrame
      title="Dòng tiền vào và ra thị trường"
      icon="mdi:cash-multiple"
      caption="So sánh nhanh lượng tiền đổ vào, rút ra và phần đứng ngoài trong phiên (đơn vị: tỷ đồng)."
    >
      <Box sx={{ maxWidth: 420, mx: 'auto' }}>
        <FlowBarChart
          flowIn={DEMO_FLOW.flowIn}
          flowOut={DEMO_FLOW.flowOut}
          flowNeutral={DEMO_FLOW.flowNeutral}
          chartHeight="260px"
        />
      </Box>
    </GuideChartFrame>
  );
}
