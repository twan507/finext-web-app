'use client';

import { Box, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, alpha, useTheme } from '@mui/material';
import { getGlassCard, getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import type { PhaseTrading } from '../types';

interface OrderBookProps {
  trades: PhaseTrading[];
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

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontSize: '1.15rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}>{value}</Typography>
    </Box>
  );
}

export default function OrderBook({ trades }: OrderBookProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const open = trades.filter((t) => t.status === 'open');
  const closed = trades.filter((t) => t.status === 'closed');
  const wins = closed.filter((t) => (t.return_pct ?? 0) > 0).length;
  const winRate = closed.length ? (wins / closed.length) * 100 : 0;
  const avg = closed.length ? closed.reduce((s, t) => s + (t.return_pct ?? 0), 0) / closed.length : 0;
  const recentClosed = closed.slice(0, 30);
  const colorPct = (v?: number) => ((v ?? 0) >= 0 ? theme.palette.trend.up : theme.palette.trend.down);

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
    <Box sx={{ borderRadius: `${borderRadius.lg}px`, ...getGlassCard(isDark), overflow: 'hidden' }}>
      <Stack direction="row" spacing={3} sx={{ p: { xs: 2, md: 2.5 }, flexWrap: 'wrap', gap: 1.5 }}>
        <Stat label="Số lệnh (đã đóng)" value={`${closed.length}`} />
        <Stat label="Tỷ lệ thắng" value={`${winRate.toFixed(0)}%`} color={winRate >= 50 ? theme.palette.trend.up : theme.palette.text.primary} />
        <Stat label="Lợi nhuận TB/lệnh" value={pct(avg)} color={colorPct(avg)} />
        {open.length > 0 && <Stat label="Đang giữ" value={`${open.length}`} />}
      </Stack>

      <TableContainer sx={{ maxHeight: 420 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headSx}>Mã</TableCell>
              <TableCell sx={headSx}>Vào</TableCell>
              <TableCell sx={headSx}>Ra</TableCell>
              <TableCell align="right" sx={headSx}>Số phiên</TableCell>
              <TableCell align="right" sx={headSx}>Lãi/lỗ</TableCell>
              <TableCell sx={headSx}>Lý do</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {open.map((t, i) => (
              <TableRow key={`o-${t.ticker}-${i}`} hover sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                <TableCell sx={{ ...cellSx, fontWeight: fontWeight.semibold }}>{t.ticker}</TableCell>
                <TableCell sx={cellSx}>{fmtDate(t.entry_date)}</TableCell>
                <TableCell sx={cellSx}>Đang giữ</TableCell>
                <TableCell align="right" sx={cellSx}>{t.n_days ?? '—'}</TableCell>
                <TableCell align="right" sx={{ ...cellSx, color: colorPct(t.return_pct) }}>
                  {pct(t.return_pct)}{' '}
                  <Typography component="span" sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.disabled' }}>
                    tạm tính
                  </Typography>
                </TableCell>
                <TableCell sx={cellSx}>{t.exit_reason ?? 'đang giữ'}</TableCell>
              </TableRow>
            ))}
            {recentClosed.map((t, i) => (
              <TableRow key={`c-${t.ticker}-${i}`} hover>
                <TableCell sx={{ ...cellSx, fontWeight: fontWeight.semibold }}>{t.ticker}</TableCell>
                <TableCell sx={cellSx}>{fmtDate(t.entry_date)}</TableCell>
                <TableCell sx={cellSx}>{fmtDate(t.exit_date)}</TableCell>
                <TableCell align="right" sx={cellSx}>{t.n_days ?? '—'}</TableCell>
                <TableCell align="right" sx={{ ...cellSx, color: colorPct(t.return_pct) }}>{pct(t.return_pct)}</TableCell>
                <TableCell sx={cellSx}>{t.exit_reason ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography sx={{ p: 1.5, fontSize: getResponsiveFontSize('xs'), color: 'text.disabled', fontStyle: 'italic' }}>
        Sổ lệnh mô phỏng theo mô hình (backtest).
      </Typography>
    </Box>
  );
}
