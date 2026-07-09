'use client';

import { Box } from '@mui/material';
import ChartSectionTitle from 'components/common/ChartSectionTitle';
import { ErrorState } from 'components/states';
import SessionDiagnosis from './SessionDiagnosis';
import BasketPerformanceChart from './BasketPerformanceChart';
import AdvancedPanel from './AdvancedPanel';
import type { PhaseDaily, PhaseComment, PhasePerfRow, PhaseCommentIndicator } from '../types';

interface MarketPhaseTabProps {
  daily: PhaseDaily[];
  comment: PhaseComment | null;
  perf: PhasePerfRow[];
  indicators: PhaseCommentIndicator[];
  error: string | null;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * Nội dung riêng của Tab ① (dưới slider): chẩn đoán phiên + hiệu suất 3 rổ + chỉ số nâng cao.
 * Hero + biểu đồ giai đoạn đã tách sang SharedPhaseHeader (hiển thị chung trên slider).
 */
export default function MarketPhaseTab({ daily, comment, perf, indicators, error }: MarketPhaseTabProps) {
  if (error) return <ErrorState message={error} />;
  if (!daily || daily.length === 0) return null; // header đã hiện loading/empty

  const latest = daily[daily.length - 1];
  const updateStr = formatDate(latest.date);

  return (
    <Box>
      {comment && (
        <Box>
          <ChartSectionTitle title="Chẩn đoán phiên" description="Diễn giải trạng thái thị trường của phiên gần nhất." updateTime={formatDate(comment.date)} />
          <Box sx={{ mt: 1.5 }}>
            <SessionDiagnosis comment={comment} />
          </Box>
        </Box>
      )}

      {perf.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <ChartSectionTitle
            title="Hiệu suất 3 danh mục so với thị trường"
            description="Hiệu suất tích luỹ của 3 danh mục so với FNX-Index, tính lại theo cửa sổ thời gian đã chọn."
            updateTime={updateStr}
          />
          <Box sx={{ mt: 1.5 }}>
            <BasketPerformanceChart perf={perf} />
          </Box>
        </Box>
      )}

      <AdvancedPanel daily={latest} indicators={indicators} />
    </Box>
  );
}
