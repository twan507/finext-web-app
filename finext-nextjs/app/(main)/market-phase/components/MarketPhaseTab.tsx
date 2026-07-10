'use client';

import { Box } from '@mui/material';
import ChartSectionTitle from 'components/common/ChartSectionTitle';
import { ErrorState } from 'components/states';
import SessionDiagnosis from './SessionDiagnosis';
import PhaseFnxChart from './PhaseFnxChart';
import FnxTrendChart from './FnxTrendChart';
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
 * Nội dung riêng của Tab ① (dưới slider): chẩn đoán phiên + chỉ số nâng cao + hiệu suất 3 rổ (cuối).
 * Hero + biểu đồ giai đoạn đã tách sang SharedPhaseHeader (hiển thị chung trên slider).
 */
export default function MarketPhaseTab({ daily, comment, perf, indicators, error }: MarketPhaseTabProps) {
  if (error) return <ErrorState message={error} />;
  if (!daily || daily.length === 0) return null; // header đã hiện loading/empty

  const latest = daily[daily.length - 1];
  const updateStr = formatDate(latest.date);

  return (
    <Box>
      <Box>
        <ChartSectionTitle
          title="DIỄN BIẾN VÀ PHÂN TÍCH PHIÊN"
          description="Diễn biến giai lịch sử các giai đoạn thị trường và phân tích phiên hiện tại"
          updateTime={comment ? formatDate(comment.date) : updateStr}
        />
        <Box sx={{ mt: 0 }}>
          <PhaseFnxChart daily={daily} />
        </Box>
        {comment && (
          <Box sx={{ mt: 3 }}>
            <SessionDiagnosis comment={comment} />
          </Box>
        )}
      </Box>

      <Box sx={{ mt: 4 }}>
        <ChartSectionTitle title="Chi tiết các chỉ số" description="Phân tích và diễn giải chi tiết các chỉ số sử dụng để định vị pha thị trường" updateTime={updateStr} />
        <Box sx={{ mt: 1.5 }}>
          <FnxTrendChart />
        </Box>
        <Box sx={{ mt: 2.5 }}>
          <AdvancedPanel daily={latest} indicators={indicators} />
        </Box>
      </Box>

      {perf.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <ChartSectionTitle
            title="Hiệu suất các danh mục đầu tư vs thị trường"
            description="Hiệu suất đầu tư tích lũy của các danh mục hệ thông của FINEXT so với chỉ số chung thị trường ướng ơngS"
            updateTime={updateStr}
          />
          <Box sx={{ mt: 1.5 }}>
            <BasketPerformanceChart perf={perf} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
