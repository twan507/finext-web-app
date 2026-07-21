'use client';

import dynamic from 'next/dynamic';
import { Box, Typography, useTheme } from '@mui/material';
import { ApexOptions } from 'apexcharts';
import { GuideChartFrame, ChartLoading } from './GuideChartFrame';
import { DEMO_SCREENER_MATCH } from './demoChartData';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

const Chart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
  loading: () => <ChartLoading height={220} />,
});

// Đồng hồ (radialBar) thể hiện tỷ lệ mã khớp bộ lọc trên tổng số mã.
// Với tỷ lệ lệch lớn (chỉ vài phần trăm khớp), dạng đồng hồ đọc rõ ràng và
// cân đối hơn nhiều so với biểu đồ polar area (vốn co nhỏ phần khớp thành chấm).
export default function GuideScreenerGauge() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const primary = theme.palette.primary.main;
  const muted = isDark ? '#3a3a3a' : '#d6d6d6';

  const { matched, total } = DEMO_SCREENER_MATCH;
  const pct = total > 0 ? (matched / total) * 100 : 0;
  const pctText = pct.toFixed(1).replace('.', ',') + '%';

  const options: ApexOptions = {
    chart: {
      type: 'radialBar',
      background: 'transparent',
      fontFamily: 'inherit',
      animations: { enabled: false },
    },
    colors: [primary],
    labels: ['Khớp bộ lọc'],
    stroke: { lineCap: 'round' },
    plotOptions: {
      radialBar: {
        startAngle: -135,
        endAngle: 135,
        hollow: { size: '58%' },
        track: {
          background: muted,
          strokeWidth: '100%',
          margin: 0,
        },
        dataLabels: {
          name: {
            show: true,
            offsetY: 22,
            fontSize: '0.8rem',
            fontWeight: String(fontWeight.medium),
            color: theme.palette.text.secondary,
          },
          value: {
            show: true,
            offsetY: -12,
            fontSize: '1.75rem',
            fontWeight: String(fontWeight.bold),
            color: theme.palette.text.primary,
            formatter: () => pctText,
          },
        },
      },
    },
  };

  return (
    <GuideChartFrame
      title="Bộ lọc thu hẹp thị trường"
      icon="mdi:filter-outline"
      caption="Từ hơn một nghìn mã, bộ lọc chỉ giữ lại nhóm nhỏ khớp đúng tiêu chí của bạn."
    >
      <Box sx={{ maxWidth: 300, mx: 'auto' }}>
        <Chart options={options} series={[pct]} type="radialBar" height={240} width="100%" />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: -0.5, flexWrap: 'wrap' }}>
        <LegendDot color={primary} label={`${matched.toLocaleString('vi-VN')} mã khớp`} />
        <LegendDot color={muted} label={`${(total - matched).toLocaleString('vi-VN')} mã chưa khớp`} />
      </Box>
    </GuideChartFrame>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
      <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.medium }}>
        {label}
      </Typography>
    </Box>
  );
}
