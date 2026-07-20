'use client';

import { useMemo } from 'react';
import { Box } from '@mui/material';
import ChartSectionTitle from 'components/common/ChartSectionTitle';
import { ErrorState } from 'components/states';
import SessionDiagnosis from './SessionDiagnosis';
import PhaseFnxChart from './PhaseFnxChart';
import FnxTrendChart from './FnxTrendChart';
import BasketPerformanceChart, { RANGE_DAYS, type PerfRange } from './BasketPerformanceChart';
import TopTradesSection from './TopTradesSection';
import AdvancedPanel from './AdvancedPanel';
import { useResponsiveRange } from '../hooks/useResponsiveRange';
import type { PhaseDaily, PhaseComment, PhasePerfRow, PhaseCommentIndicator, PhaseTrading } from '../types';

interface MarketPhaseTabProps {
  daily: PhaseDaily[];
  comment: PhaseComment | null;
  perf: PhasePerfRow[];
  indicators: PhaseCommentIndicator[];
  trading: PhaseTrading[];
  error: string | null;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * Nội dung riêng của Tab ① (dưới slider): chẩn đoán phiên + chỉ số nâng cao + hiệu suất 3 rổ + top lệnh (cuối).
 * Hero + biểu đồ giai đoạn đã tách sang SharedPhaseHeader (hiển thị chung trên slider).
 */
export default function MarketPhaseTab({ daily, comment, perf, indicators, trading, error }: MarketPhaseTabProps) {
  // Timeframe DÙNG CHUNG cho biểu đồ hiệu suất + section top lệnh (lift lên đây).
  const [range, setRange] = useResponsiveRange<PerfRange>('1Y', '6M');
  // Ngày sớm nhất của cửa sổ timeframe (lọc trade theo exit_date, khớp biểu đồ).
  const windowStart = useMemo(() => {
    const dates = [...new Set(perf.map((p) => p.date))].sort();
    return dates[Math.max(0, dates.length - RANGE_DAYS[range])] ?? '';
  }, [perf, range]);

  if (error) return <ErrorState message={error} />;
  if (!daily || daily.length === 0) return null; // header đã hiện loading/empty

  const latest = daily[daily.length - 1];
  const updateStr = formatDate(latest.date);

  return (
    <Box>
      <Box>
        <ChartSectionTitle
          title="DIỄN BIẾN FINEXT INDEX VÀ PHÂN TÍCH PHIÊN"
          description="Diễn biến giai lịch sử các giai đoạn thị trường và phân tích phiên hiện tại"
          updateTime={comment ? formatDate(comment.date) : updateStr}
        />
        <Box sx={{ mt: 0 }}>
          <PhaseFnxChart daily={daily} />
        </Box>
        {comment && (
          <Box sx={{ mt: 3 }}>
            <SessionDiagnosis paragraphs={[comment.market_cmt]} generatedAt={comment.generated_at} label="Nhận định thị trường" dropCap />
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
        {/* Ô FINEXT AI mới: 3 đoạn điều kiện/cấu trúc/rủi ro (market_cmt ở khối trên) — dưới bảng chỉ số chi tiết. */}
        {comment && (
          <Box sx={{ mt: 3 }}>
            <SessionDiagnosis paragraphs={[comment.condition_cmt, comment.structure_cmt, comment.risk_cmt]} generatedAt={comment.generated_at} showGlyph={false} label="Nhận định chỉ số" />
          </Box>
        )}
      </Box>

      {perf.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <ChartSectionTitle
            title="Hiệu suất các danh mục đầu tư"
            description="Hiệu suất đầu tư tích lũy của các danh mục hệ thông của FINEXT so với chỉ số chung thị trường ướng ơngS"
            updateTime={updateStr}
          />
          <Box sx={{ mt: 1.5 }}>
            <BasketPerformanceChart perf={perf} range={range} onRangeChange={setRange} />
          </Box>
        </Box>
      )}

      {trading.length > 0 && (
        <Box sx={{ mt: 4 }}>

          <Box sx={{ mt: 1.5 }}>
            <TopTradesSection trades={trading} windowStart={windowStart} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
