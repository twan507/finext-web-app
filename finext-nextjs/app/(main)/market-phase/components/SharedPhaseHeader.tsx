'use client';

import { Box } from '@mui/material';
import ChartSectionTitle from 'components/common/ChartSectionTitle';
import { LoadingState, EmptyState, ErrorState } from 'components/states';
import PhaseHero from './PhaseHero';
import PhaseFnxChart from './PhaseFnxChart';
import { getPhaseMeta } from '../phaseMeta';
import type { PhaseDaily } from '../types';

interface SharedPhaseHeaderProps {
  daily: PhaseDaily[];
  isLoading: boolean;
  error: string | null;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Phần dùng chung cho cả 4 tab (đặt TRÊN slider): hero + biểu đồ giai đoạn. */
export default function SharedPhaseHeader({ daily, isLoading, error }: SharedPhaseHeaderProps) {
  if (isLoading) return <LoadingState variant="spinner" message="Đang tải dữ liệu giai đoạn thị trường..." />;
  if (error) return <ErrorState message={error} />;
  if (!daily || daily.length === 0) return <EmptyState title="Chưa có dữ liệu" description="Dữ liệu giai đoạn thị trường sẽ cập nhật cuối phiên." />;

  const latest = daily[daily.length - 1];

  let streak = 1;
  for (let i = daily.length - 2; i >= 0; i--) {
    if (daily[i].phase_label === latest.phase_label) streak++;
    else break;
  }
  let prevPhaseVn: string | null = null;
  for (let i = daily.length - 1 - streak; i >= 0; i--) {
    if (daily[i].phase_label !== latest.phase_label) {
      prevPhaseVn = getPhaseMeta(daily[i].phase_label).vn;
      break;
    }
  }
  const updateStr = formatDate(latest.date);

  return (
    <Box>
      <PhaseHero daily={latest} streak={streak} prevPhaseVn={prevPhaseVn} />

      <Box sx={{ mt: 4 }}>
        <ChartSectionTitle
          title="Diễn biến & giai đoạn thị trường"
          description="Chỉ số FNX-Index với nền màu theo pha thị trường (tăng giá / giảm giá / đi ngang / chuyển pha)."
          updateTime={updateStr}
        />
        <Box sx={{ mt: 1.5 }}>
          <PhaseFnxChart daily={daily} />
        </Box>
      </Box>
    </Box>
  );
}
