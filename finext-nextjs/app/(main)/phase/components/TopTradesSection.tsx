'use client';

import { Box, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, useTheme } from '@mui/material';
import { getGlassCard, getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import type { PhaseTrading } from '../types';
import { SERIES } from './BasketPerformanceChart';

interface TopTradesSectionProps {
  trades: PhaseTrading[];
  /** Ngày sớm nhất của timeframe đang chọn (lọc theo exit_date). '' = không lọc. */
  windowStart: string;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}
function pct(v?: number): string {
  return v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}

// 3 danh mục (bỏ benchmark FNX dashed).
const PRODUCTS = SERIES.filter((s) => !s.dashed);

export default function TopTradesSection({ trades, windowStart }: TopTradesSectionProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // 2 hàng trên (tên danh mục + tên cột) giữ màu cũ (glass của card). Dòng dữ liệu = nền bg (default).
  const headSx = {
    fontSize: getResponsiveFontSize('xs'),
    color: 'text.secondary',
    fontWeight: fontWeight.semibold,
    whiteSpace: 'nowrap',
    borderColor: theme.palette.divider,
    py: 0.75,
  };
  const cellSx = {
    fontSize: getResponsiveFontSize('sm'),
    borderColor: theme.palette.divider,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    bgcolor: theme.palette.background.default,
    py: 0.75,
  };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: { xs: 2, md: 2.5 } }}>
      {PRODUCTS.map((cfg) => {
        const color = cfg.color(theme);
        const top = trades
          .filter((t) => t.product === cfg.product && t.status === 'closed' && t.exit_date && (!windowStart || (t.exit_date as string) >= windowStart))
          .sort((a, b) => (b.return_pct ?? 0) - (a.return_pct ?? 0))
          .slice(0, 10);

        return (
          <Box key={cfg.product} sx={{ borderRadius: `${borderRadius.lg}px`, ...getGlassCard(isDark), overflow: 'hidden' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color, flexShrink: 0 }} />
              <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.semibold, color }}>{cfg.name}</Typography>
            </Stack>

            {top.length === 0 ? (
              <Typography sx={{ p: 2, fontSize: getResponsiveFontSize('xs'), color: 'text.disabled', fontStyle: 'italic' }}>
                Chưa có lệnh trong khoảng này.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={headSx}>Mã</TableCell>
                      <TableCell sx={headSx}>Ngày bán</TableCell>
                      <TableCell align="right" sx={headSx}>Số phiên</TableCell>
                      <TableCell align="right" sx={headSx}>Lãi</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {top.map((t, i) => (
                      <TableRow key={`${t.ticker}-${i}`} hover>
                        <TableCell sx={{ ...cellSx, fontWeight: fontWeight.semibold }}>{t.ticker}</TableCell>
                        <TableCell sx={cellSx}>{fmtDate(t.exit_date)}</TableCell>
                        <TableCell align="right" sx={cellSx}>{t.n_days ?? '—'}</TableCell>
                        <TableCell align="right" sx={{ ...cellSx, color: (t.return_pct ?? 0) >= 0 ? theme.palette.trend.up : theme.palette.trend.down, fontWeight: fontWeight.semibold }}>
                          {pct(t.return_pct)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
