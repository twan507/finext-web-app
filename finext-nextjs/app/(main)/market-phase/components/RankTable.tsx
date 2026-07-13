'use client';

import { useMemo } from 'react';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import AmbientCard from './AmbientCard';
import type { PhaseRank, IndexMapRow } from '../types';
import { getStatusMeta, STATUS_ORDER } from '../basketMeta';

interface RankTableProps {
  rows: PhaseRank[];
  /** CORE: hiện cột Ngành (tên đầy đủ) và BỎ cột Hạng — vì rank ở CORE là hạng TRONG NGÀNH nên trùng số nhiều mã. */
  showSector?: boolean;
  /** Map mã ngành → tên đầy đủ (ref_db.index_map) — chỉ dùng khi showSector. */
  indexMap?: IndexMapRow[];
  accent: string; // màu nhận diện rổ (ambient glow của card)
  /** Phòng Thủ: đổi "Hạng"→"Xếp hạng", layout snug (max-content) + padding co ở mobile. */
  conservativeLayout?: boolean;
}

export default function RankTable({ rows, showSector = false, indexMap = [], accent, conservativeLayout = false }: RankTableProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  // Trạng thái ƯU TIÊN TRƯỚC hạng: Tiềm năng → Chờ tín hiệu → Quan sát; cùng nhóm mới xét hạng.
  const sorted = [...rows].sort((a, b) => {
    const sa = STATUS_ORDER[a.status] ?? 99;
    const sb = STATUS_ORDER[b.status] ?? 99;
    if (sa !== sb) return sa - sb;
    return (a.rank ?? 999) - (b.rank ?? 999);
  });
  // Mã ngành → tên đầy đủ; thiếu (BE chưa restart) → fallback về mã.
  const sectorName = useMemo(
    () => new Map(indexMap.filter((m) => m.ticker_name).map((m) => [m.ticker, m.ticker_name as string] as const)),
    [indexMap],
  );
  const bd = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const bdHead = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  // Co padding ngang trên mobile (xs/sm) — mọi rổ.
  const compactPx = { px: { xs: 1, sm: 1.25, md: 2 } };
  // Header trong suốt (đồng bộ với demo): không nền paper; tiêu đề KHÔNG wrap → minWidth max-content khít đúng 1 dòng.
  const headSx = {
    fontSize: getResponsiveFontSize('xs'),
    color: 'text.secondary',
    fontWeight: fontWeight.semibold,
    borderColor: bdHead,
    whiteSpace: 'nowrap',
    ...compactPx,
  };
  // height cố định: row có/không chip cao bằng nhau → không flick khi đổi phiên.
  const cellSx = { fontSize: getResponsiveFontSize('sm'), borderColor: bd, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', height: 40, ...compactPx };
  const fmtMom = (v?: number) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`);
  const fmtVma = (v?: number) => (v == null ? '—' : `${v.toFixed(1)} tỷ`);

  return (
    <AmbientCard glowColor={accent} filled={false} sx={{ p: 0 }}>
      <TableContainer>
        <Table
          size="small"
          sx={{
            // Auto-layout + minWidth max-content → mỗi cột khít bề rộng tối thiểu của tiêu đề/nội dung (1 dòng);
            // card rộng hơn thì bảng fill, hẹp hơn (mobile) thì TableContainer cuộn ngang.
            minWidth: 'max-content',
            width: '100%',
            '& .MuiTableHead-root, & .MuiTableCell-head, & .MuiTableRow-root': { bgcolor: 'transparent' },
            '& .MuiTableBody-root .MuiTableRow-root:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
          }}
        >
          <TableHead>
            <TableRow>
              {!showSector && <TableCell sx={headSx}>{conservativeLayout ? 'Xếp hạng' : 'Hạng'}</TableCell>}
              <TableCell sx={headSx}>Mã</TableCell>
              {showSector && <TableCell sx={headSx}>Ngành</TableCell>}
              <TableCell align="right" sx={headSx}>{'% biến động 6T'}</TableCell>
              <TableCell align="right" sx={headSx}>Thanh khoản</TableCell>
              <TableCell align="right" sx={headSx}>Trạng thái</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((r, i) => {
              const st = getStatusMeta(r.status);
              // Nắm giữ/Cân nhắc = accent của rổ (Cân nhắc đã trộn xám sẵn trong basketMeta).
              const sc = st.color(theme, accent);
              return (
                <TableRow key={`${r.ticker}-${i}`} hover>
                  {!showSector && <TableCell sx={cellSx}>{r.rank ?? '—'}</TableCell>}
                  <TableCell sx={{ ...cellSx, fontWeight: fontWeight.semibold }}>{r.ticker}</TableCell>
                  {showSector && <TableCell sx={cellSx}>{r.sector ? (sectorName.get(r.sector) ?? r.sector) : '—'}</TableCell>}
                  <TableCell align="right" sx={{ ...cellSx, color: (r.mom120 ?? 0) >= 0 ? theme.palette.trend.up : theme.palette.trend.down }}>
                    {fmtMom(r.mom120)}
                  </TableCell>
                  <TableCell align="right" sx={cellSx}>{fmtVma(r.vma60)}</TableCell>
                  <TableCell align="right" sx={cellSx}>
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-block',
                        px: 1,
                        py: 0.25,
                        borderRadius: 999,
                        fontSize: getResponsiveFontSize('xs'),
                        fontWeight: fontWeight.semibold,
                        color: sc,
                        bgcolor: alpha(sc, 0.12),
                        opacity: st.op ?? 1, // Cân nhắc = 0.5, đồng bộ với nhãn + ô heatmap
                      }}
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
    </AmbientCard>
  );
}
