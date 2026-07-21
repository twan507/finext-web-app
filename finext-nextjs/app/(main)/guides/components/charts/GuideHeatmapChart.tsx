'use client';

import dynamic from 'next/dynamic';
import { GuideChartFrame, ChartLoading } from './GuideChartFrame';
import { DEMO_HEATMAP } from './demoChartData';

const UniTreeMap = dynamic(() => import('components/common/UniTreeMap'), {
  ssr: false,
  loading: () => <ChartLoading height={360} />
});

export default function GuideHeatmapChart() {
  return (
    <GuideChartFrame
      title="Bản đồ cổ phiếu dạng lưới"
      icon="mdi:view-grid-outline"
      caption="Mỗi ô là một cổ phiếu — ô càng lớn là giao dịch càng sôi động, màu xanh là tăng giá, đỏ là giảm."
    >
      <UniTreeMap data={DEMO_HEATMAP} chartHeight="360px" seriesName="Cổ phiếu" />
    </GuideChartFrame>
  );
}
