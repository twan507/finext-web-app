'use client';

import { useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import ChartSectionTitle from 'components/common/ChartSectionTitle';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import AmbientCard from './AmbientCard';
import type { PhaseRank, PhaseIndustryRow, IndexMapRow } from '../types';
import SectorWaveStrip from './SectorWaveStrip';
import SectorStrengthChart from './SectorStrengthChart';
import BasketAiHero from './BasketAiHero';

interface IndustrySectionProps {
  sectorRanks: PhaseRank[]; // FULL lịch sử (level='sector', product=CORE) — cho line chart sức mạnh
  industry: PhaseIndustryRow[]; // phase_industry WIDE — cho heatmap wave streaks
  indexMap: IndexMapRow[]; // map mã ngành → tên đầy đủ (ref_db.index_map)
  accent: string; // màu nhận diện rổ CORE (ambient glow)
  sectorCmt?: string | null; // nhận định ngành FINEXT AI (phase_comment_basket.sector_cmt)
  generatedAt?: string;
  updateTime?: string;
  /** Phiên MỚI NHẤT đang 100% tiền mặt → banner cảnh báo. */
  isCash?: boolean;
  /** TẤT CẢ phiên có market_exposure == 0 → heatmap làm mờ đúng những CỘT đó (phase_industry
   *  không còn tự về 0 khi downtrend — schema 2026-07-12). */
  cashDates?: Set<string>;
}

/** Tầng NGÀNH tab Sóng Ngành (CORE): card biểu đồ (line sức mạnh + heatmap) + card nhận định ngành AI tách riêng. */
export default function IndustrySection({ sectorRanks, industry, indexMap, accent, sectorCmt, generatedAt, updateTime, isCash = false, cashDates }: IndustrySectionProps) {
  // phase_industry 2026-07-12: 0=ngoài rổ · 1=tiềm năng · 2=vùng buffer · 3=trong rổ → ĐANG NẮM ⟺ >= 2.
  const { activeSectors, liveSectors, holdSectors } = useMemo(() => {
    const active = new Set<string>(); // từng NẮM trong lịch sử → chip legend của line chart
    for (const r of industry) for (const k of Object.keys(r)) if (k !== 'date' && Number(r[k]) >= 2) active.add(k);
    const last = industry[industry.length - 1];
    const live = new Set<string>(); // đang NẮM (>=2) ở phiên mới nhất → in đậm nhãn heatmap
    const hold = new Set<string>(); // riêng "Nắm giữ" (=3) → line chart tô màu đúng nhóm này
    if (last)
      for (const k of Object.keys(last)) {
        if (k === 'date') continue;
        const v = Number(last[k]);
        if (v >= 2) live.add(k);
        if (v === 3) hold.add(k);
      }
    return { activeSectors: active, liveSectors: live, holdSectors: hold };
  }, [industry]);

  // Map mã ngành → tên đầy đủ; thiếu (BE chưa restart) → fallback về mã.
  const nameByCode = useMemo(
    () => new Map(indexMap.filter((m) => m.ticker_name).map((m) => [m.ticker, m.ticker_name as string] as const)),
    [indexMap],
  );

  // Lịch cơ cấu NGÀNH — lấy từ dòng rank level='sector' (nhịp riêng, KHÔNG dùng chung với tầng cổ phiếu).
  // Bộ đếm next_rebalance_in đếm lùi rồi RESET → phiên nào giá trị tăng so với phiên trước = phiên vừa cơ cấu.
  const { nextRebalance, rebalanceDates } = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const r of sectorRanks) if (r.next_rebalance_in != null) byDate.set(r.date.slice(0, 10), r.next_rebalance_in);
    const dates = [...byDate.keys()].sort();
    const marks = new Set<string>();
    for (let i = 1; i < dates.length; i++) {
      if ((byDate.get(dates[i]) ?? 0) > (byDate.get(dates[i - 1]) ?? 0)) marks.add(dates[i]);
    }
    return { nextRebalance: dates.length ? (byDate.get(dates[dates.length - 1]) ?? null) : null, rebalanceDates: marks };
  }, [sectorRanks]);

  return (
    <Box>
      <ChartSectionTitle title="Luân chuyển sóng ngành" description="Nhịp luân chuyển các ngành và tương quan sức mạnh theo thời gian." updateTime={updateTime} />
      <Box sx={{ mt: 1.5 }}>
        <AmbientCard glowColor={accent} filled={false} sx={{ p: { xs: 2, md: 2.5 } }}>
          {/* 100% tiền mặt: phase_industry KHÔNG còn tự về 0 → nói rõ đang không nắm, và tô xám dải sóng. */}
          {isCash && (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
              <Box sx={{ width: 4, alignSelf: 'stretch', minHeight: 34, borderRadius: 2, bgcolor: 'text.disabled', flexShrink: 0 }} />
              <Box>
                <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.primary', fontWeight: fontWeight.semibold }}>
                  Đang 100% tiền mặt — chưa nắm ngành nào
                </Typography>
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', mt: 0.25 }}>
                  Dưới đây là các ngành đang mạnh — sẽ mua lại khi thị trường bật lên.
                </Typography>
              </Box>
            </Stack>
          )}
          {/* Line tương quan sức mạnh TRÊN → heatmap trạng thái ngành DƯỚI. */}
          <SectorStrengthChart sectorRanks={sectorRanks} activeSectors={activeSectors} nameByCode={nameByCode} holdSectors={holdSectors} />

          <Box sx={{ height: '1px', bgcolor: 'divider', my: 2.5, opacity: 0.5 }} />

          {/* cashDates: heatmap tự làm mờ ĐÚNG những cột (phiên) 100% tiền mặt. accent: Nắm giữ/Cân nhắc theo màu rổ. */}
          <SectorWaveStrip
            industry={industry}
            liveSectors={liveSectors}
            nameByCode={nameByCode}
            cashDates={cashDates}
            accent={accent}
            nextRebalance={nextRebalance}
            rebalanceDates={rebalanceDates}
          />

        </AmbientCard>
      </Box>

      {/* Nhận định ngành = comment ĐẦU TIÊN của tab → tách hẳn ra CARD RIÊNG có khung + drop cap
          (trước đây nằm lọt trong card biểu đồ, không có khung). */}
      {sectorCmt && sectorCmt.trim() && (
        <Box sx={{ mt: 2.5 }}>
          <BasketAiHero text={sectorCmt} generatedAt={generatedAt} accent={accent} label="Nhận định ngành" dropCap framed />
        </Box>
      )}
    </Box>
  );
}
