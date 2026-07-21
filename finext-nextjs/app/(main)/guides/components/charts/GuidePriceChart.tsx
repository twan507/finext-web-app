'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { GuideChartFrame, ChartLoading } from './GuideChartFrame';
import { DEMO_PRICE_DATA, DEMO_INTRADAY_DATA } from './demoChartData';
import type { TimeRange } from '../../../home/components/marketSection/MarketIndexChart';

const MarketIndexChart = dynamic(
  () => import('../../../home/components/marketSection/MarketIndexChart'),
  { ssr: false, loading: () => <ChartLoading height={320} /> }
);

export default function GuidePriceChart() {
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');
  return (
    <GuideChartFrame
      title="Biểu đồ giá dạng nến kèm khối lượng"
      icon="mdi:chart-line"
      caption="Thử bấm khung thời gian (1D, 1M, 1Q, 1Y) và đổi giữa nến với đường để cảm nhận thao tác."
    >
      <MarketIndexChart
        symbol="DEMO"
        title="Chỉ số minh hoạ"
        eodData={DEMO_PRICE_DATA}
        intradayData={DEMO_INTRADAY_DATA}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        height={320}
      />
    </GuideChartFrame>
  );
}
