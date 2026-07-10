'use client';

import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import AmbientCard from './AmbientCard';
import type { PhaseRank } from '../types';
import { getStatusMeta } from '../basketMeta';

interface RankTableProps {
  rows: PhaseRank[];
  /** CORE: hiện thêm cột Ngành (hạng trong ngành). */
  showSector?: boolean;
  accent: string; // màu nhận diện rổ (ambient glow của card)
}

export default function RankTable({ rows, showSector = false, accent }: RankTableProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const sorted = [...rows].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const bd = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const bdHead = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  // Header trong suốt (đồng bộ với demo): không nền paper, cho phép wrap để cột co lại tránh trượt ngang.
  const headSx = {
    fontSize: getResponsiveFontSize('xs'),
    color: 'text.secondary',
    fontWeight: fontWeight.semibold,
    borderColor: bdHead,
  };
  const cellSx = { fontSize: getResponsiveFontSize('sm'), borderColor: bd, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
  const fmtMom = (v?: number) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`);
  const fmtVma = (v?: number) => (v == null ? '—' : `${v.toFixed(1)} tỷ`);

  return (
    <AmbientCard glowColor={accent} filled={false} sx={{ p: 0 }}>
      <TableContainer>
        <Table
          size="small"
          sx={{
            '& .MuiTableHead-root, & .MuiTableCell-head, & .MuiTableRow-root': { bgcolor: 'transparent' },
            '& .MuiTableBody-root .MuiTableRow-root:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
          }}
        >
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
                  <TableCell sx={{ ...cellSx, fontWeight: fontWeight.semibold }}>{r.ticker}</TableCell>
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
    </AmbientCard>
  );
}
