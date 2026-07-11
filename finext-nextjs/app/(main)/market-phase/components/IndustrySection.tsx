'use client';

import { useMemo } from 'react';
import { Box, Stack, Typography, alpha } from '@mui/material';
import ChartSectionTitle from 'components/common/ChartSectionTitle';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import AmbientCard from './AmbientCard';
import type { PhaseRank, PhaseIndustryRow, IndexMapRow } from '../types';
import SectorWaveStrip from './SectorWaveStrip';
import SectorStrengthChart from './SectorStrengthChart';

interface IndustrySectionProps {
  sectorRanks: PhaseRank[]; // FULL lịch sử (level='sector', product=CORE) — cho line chart sức mạnh
  industry: PhaseIndustryRow[]; // phase_industry WIDE — cho heatmap wave streaks
  indexMap: IndexMapRow[]; // map mã ngành → tên đầy đủ (ref_db.index_map)
  accent: string; // màu nhận diện rổ CORE (ambient glow)
  sectorCmt?: string | null; // nhận định ngành FINEXT AI (phase_comment_basket.sector_cmt)
  generatedAt?: string;
  updateTime?: string;
}

function formatTime(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Tầng NGÀNH tab Sóng Ngành (CORE): heatmap luân chuyển + line chart sức mạnh + nhận định ngành AI, 1 card kính. */
export default function IndustrySection({ sectorRanks, industry, indexMap, accent, sectorCmt, generatedAt, updateTime }: IndustrySectionProps) {
  const { activeSectors, liveSectors } = useMemo(() => {
    const active = new Set<string>();
    for (const r of industry) for (const k of Object.keys(r)) if (k !== 'date' && Number(r[k]) === 1) active.add(k);
    const last = industry[industry.length - 1];
    const live = new Set<string>();
    if (last) for (const k of Object.keys(last)) if (k !== 'date' && Number(last[k]) === 1) live.add(k);
    return { activeSectors: active, liveSectors: live };
  }, [industry]);

  // Map mã ngành → tên đầy đủ; thiếu (BE chưa restart) → fallback về mã.
  const nameByCode = useMemo(
    () => new Map(indexMap.filter((m) => m.ticker_name).map((m) => [m.ticker, m.ticker_name as string] as const)),
    [indexMap],
  );

  const cap = { fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', fontWeight: fontWeight.semibold, mb: 1 } as const;
  const metaDot = <Box component="span" sx={{ color: 'text.secondary', fontWeight: fontWeight.medium, fontSize: getResponsiveFontSize('sm'), lineHeight: 1 }}>·</Box>;

  return (
    <Box>
      <ChartSectionTitle title="Luân chuyển sóng ngành" description="Nhịp luân chuyển các ngành và tương quan sức mạnh theo thời gian." updateTime={updateTime} />
      <Box sx={{ mt: 1.5 }}>
        <AmbientCard glowColor={accent} filled={false} sx={{ p: { xs: 2, md: 2.5 } }}>
          <SectorWaveStrip industry={industry} liveSectors={liveSectors} nameByCode={nameByCode} />

          <Box sx={{ height: '1px', bgcolor: 'divider', my: 2.5, opacity: 0.5 }} />

          <SectorStrengthChart sectorRanks={sectorRanks} activeSectors={activeSectors} nameByCode={nameByCode} />

          {sectorCmt && sectorCmt.trim() && (
            <>
              <Box sx={{ height: '1px', bgcolor: 'divider', my: 2.5, opacity: 0.5 }} />
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap' }}>
                <Box
                  component="span"
                  sx={{
                    fontSize: getResponsiveFontSize('xs'),
                    fontWeight: fontWeight.bold,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: accent,
                    bgcolor: alpha(accent, 0.14),
                    borderRadius: 999,
                    px: 1.25,
                    py: 0.4,
                  }}
                >
                  ✦ FINEXT AI
                </Box>
                {metaDot}
                <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary', fontWeight: fontWeight.medium }}>Nhận định ngành</Typography>
                {formatTime(generatedAt) && (
                  <>
                    {metaDot}
                    <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.disabled' }}>Cập nhật lúc {formatTime(generatedAt)}</Typography>
                  </>
                )}
              </Stack>
              <Typography sx={{ fontSize: getResponsiveFontSize('md'), lineHeight: 1.6, color: 'text.secondary', whiteSpace: 'pre-line', textAlign: 'justify' }}>{sectorCmt}</Typography>
            </>
          )}
        </AmbientCard>
      </Box>
    </Box>
  );
}
