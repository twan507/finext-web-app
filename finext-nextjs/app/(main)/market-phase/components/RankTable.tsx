'use client';

import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, alpha, useTheme } from '@mui/material';
import { getGlassCard, getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import type { PhaseRank } from '../types';
import { getStatusMeta } from '../basketMeta';

interface RankTableProps {
  rows: PhaseRank[];
  /** CORE: hiện thêm cột Ngành (hạng trong ngành). */
  showSector?: boolean;
}

export default function RankTable({ rows, showSector = false }: RankTableProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const sorted = [...rows].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

  const headSx = {
    fontSize: getResponsiveFontSize('xs'),
    color: 'text.secondary',
    fontWeight: fontWeight.semibold,
    whiteSpace: 'nowrap',
    borderColor: theme.palette.divider,
    bgcolor: theme.palette.background.paper,
  };
  const cellSx = { fontSize: getResponsiveFontSize('sm'), borderColor: theme.palette.divider, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
  const fmtMom = (v?: number) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`);
  const fmtVma = (v?: number) => (v == null ? '—' : `${v.toFixed(1)} tỷ`);

  return (
    <Box sx={{ borderRadius: `${borderRadius.lg}px`, ...getGlassCard(isDark), overflow: 'hidden' }}>
      <TableContainer sx={{ maxHeight: 480 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headSx}>Hạng</TableCell>
              <TableCell sx={headSx}>Mã</TableCell>
              {showSector && <TableCell sx={headSx}>Ngành</TableCell>}
              <TableCell align="right" sx={headSx}>Đà giá 6T</TableCell>
              <TableCell align="right" sx={headSx}>Thanh khoản</TableCell>
              <TableCell sx={headSx}>Trạng thái</TableCell>
              <TableCell align="right" sx={headSx}>Tới cơ cấu</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((r, i) => {
              const st = getStatusMeta(r.status);
              return (
                <TableRow key={`${r.ticker}-${i}`} hover>
                  <TableCell sx={cellSx}>{r.rank ?? '—'}</TableCell>
                  <TableCell sx={cellSx}>
                    <Typography component="span" sx={{ fontWeight: fontWeight.semibold, fontSize: 'inherit' }}>
                      {r.ticker}
                    </Typography>
                    {r.ten && (
                      <Typography component="span" sx={{ color: 'text.disabled', fontSize: getResponsiveFontSize('xs'), ml: 0.75 }}>
                        {r.ten}
                      </Typography>
                    )}
                  </TableCell>
                  {showSector && <TableCell sx={cellSx}>{r.sector ?? '—'}</TableCell>}
                  <TableCell align="right" sx={{ ...cellSx, color: (r.mom120 ?? 0) >= 0 ? theme.palette.trend.up : theme.palette.trend.down }}>
                    {fmtMom(r.mom120)}
                  </TableCell>
                  <TableCell align="right" sx={cellSx}>{fmtVma(r.vma60)}</TableCell>
                  <TableCell sx={cellSx}>
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-block',
                        px: 1,
                        py: 0.25,
                        borderRadius: 999,
                        fontSize: getResponsiveFontSize('xs'),
                        fontWeight: fontWeight.semibold,
                        color: st.color(theme),
                        bgcolor: alpha(st.color(theme), 0.12),
                      }}
                    >
                      {st.label}
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={cellSx}>{r.next_rebalance_in != null ? `${r.next_rebalance_in} phiên` : '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
