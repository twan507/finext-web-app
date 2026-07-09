'use client';

import { useMemo } from 'react';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, alpha, useTheme } from '@mui/material';
import ChartSectionTitle from 'components/common/ChartSectionTitle';
import { getGlassCard, getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import type { PhaseRank, PhaseIndustryRow } from '../types';
import { getStatusMeta } from '../basketMeta';
import PortfolioComment from './PortfolioComment';

const HEATMAP_SESSIONS = 40;

interface IndustrySectionProps {
  sectorRanks: PhaseRank[];
  industry: PhaseIndustryRow[];
  sectorCmt?: string | null;
  generatedAt?: string;
  updateTime?: string;
}

function sectorName(r: PhaseRank): string {
  return r.ten || (r.sector ?? '') || r.ticker || '—';
}

/** Tầng NGÀNH cho tab Sóng Ngành (CORE): rank ngành + heatmap + diễn giải ngành. */
export default function IndustrySection({ sectorRanks, industry, sectorCmt, generatedAt, updateTime }: IndustrySectionProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const sortedSectors = useMemo(() => [...sectorRanks].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)), [sectorRanks]);

  // CHỈ ngành từng có value 1 (không render cột always-0 để không lộ universe).
  const activeSectors = useMemo(() => {
    const set = new Set<string>();
    for (const row of industry) {
      for (const k of Object.keys(row)) {
        if (k !== 'date' && Number(row[k]) === 1) set.add(k);
      }
    }
    return Array.from(set).sort();
  }, [industry]);

  const recent = useMemo(() => industry.slice(-HEATMAP_SESSIONS), [industry]);

  const headSx = {
    fontSize: getResponsiveFontSize('xs'),
    color: 'text.secondary',
    fontWeight: fontWeight.semibold,
    whiteSpace: 'nowrap',
    borderColor: theme.palette.divider,
    bgcolor: theme.palette.background.paper,
  };
  const cellSx = { fontSize: getResponsiveFontSize('sm'), borderColor: theme.palette.divider, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

  return (
    <Box>
      <ChartSectionTitle title="Sức mạnh ngành" description="Xếp hạng ngành và trạng thái luân chuyển của danh mục Sóng Ngành." updateTime={updateTime} />

      {sortedSectors.length > 0 && (
        <Box sx={{ mt: 1.5, borderRadius: `${borderRadius.lg}px`, ...getGlassCard(isDark), overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 360 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={headSx}>Hạng</TableCell>
                  <TableCell sx={headSx}>Ngành</TableCell>
                  <TableCell align="right" sx={headSx}>Điểm mạnh</TableCell>
                  <TableCell sx={headSx}>Trạng thái</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedSectors.map((r, i) => {
                  const st = getStatusMeta(r.status);
                  return (
                    <TableRow key={`${sectorName(r)}-${i}`} hover>
                      <TableCell sx={cellSx}>{r.rank ?? '—'}</TableCell>
                      <TableCell sx={{ ...cellSx, fontWeight: fontWeight.semibold }}>{sectorName(r)}</TableCell>
                      <TableCell align="right" sx={cellSx}>{r.composite != null ? r.composite.toFixed(2) : '—'}</TableCell>
                      <TableCell sx={cellSx}>
                        <Box
                          component="span"
                          sx={{ display: 'inline-block', px: 1, py: 0.25, borderRadius: 999, fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold, color: st.color(theme), bgcolor: alpha(st.color(theme), 0.12) }}
                        >
                          {st.label}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {activeSectors.length > 0 && recent.length > 0 && (
        <Box sx={{ mt: 2, borderRadius: `${borderRadius.lg}px`, ...getGlassCard(isDark), p: { xs: 1.5, md: 2 }, overflowX: 'auto' }}>
          <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', mb: 1 }}>
            Các ngành hệ thống đang theo dõi ({HEATMAP_SESSIONS} phiên gần nhất) — ô đậm = đang trong luân chuyển.
          </Typography>
          <Box sx={{ display: 'inline-flex', flexDirection: 'column', gap: '3px', minWidth: 'min-content' }}>
            {activeSectors.map((sec) => (
              <Box key={sec} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 110, flexShrink: 0, fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {sec}
                </Box>
                <Box sx={{ display: 'flex', gap: '2px' }}>
                  {recent.map((row, idx) => {
                    const on = Number(row[sec]) === 1;
                    return <Box key={idx} sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: on ? theme.palette.primary.main : alpha(theme.palette.text.disabled, 0.12) }} />;
                  })}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {sectorCmt && (
        <Box sx={{ mt: 2 }}>
          <PortfolioComment text={sectorCmt} generatedAt={generatedAt} />
        </Box>
      )}
    </Box>
  );
}
