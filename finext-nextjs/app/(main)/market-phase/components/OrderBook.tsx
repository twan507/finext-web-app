'use client';

import { Box, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import AmbientCard from './AmbientCard';
import { getPhaseMeta } from '../phaseMeta';
import type { PhaseTrading } from '../types';

interface OrderBookProps {
  trades: PhaseTrading[];
  accent: string; // màu nhận diện rổ (ambient glow của card)
  conservativeLayout?: boolean; // Phòng Thủ: đổi Vào/Ra → Ngày mua/Ngày bán, cột Lý do căn phải + hiển thị chip
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

export default function OrderBook({ trades, accent, conservativeLayout = false }: OrderBookProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const bd = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const bdHead = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  const closed = trades.filter((t) => t.status === 'closed');
  // Lãi TB = TB return lệnh THẮNG (>0); Lỗ TB = TB return lệnh THUA (<0). Tách riêng để lãi không bị "hòa" vào lỗ.
  const winners = closed.filter((t) => (t.return_pct ?? 0) > 0);
  const losers = closed.filter((t) => (t.return_pct ?? 0) < 0);
  const winRate = closed.length ? (winners.length / closed.length) * 100 : 0;
  const avgWin = winners.length ? winners.reduce((s, t) => s + (t.return_pct ?? 0), 0) / winners.length : null;
  const avgLoss = losers.length ? losers.reduce((s, t) => s + (t.return_pct ?? 0), 0) / losers.length : null;
  const recentClosed = closed.slice(0, 100);
  const colorPct = (v?: number) => ((v ?? 0) >= 0 ? theme.palette.trend.up : theme.palette.trend.down);
  // Phòng Thủ: "Lý do" → chip. downtrend = đỏ "Thị trường rủi ro" · rebalance = vàng "Tái cơ cấu" · giá trị lạ = chip trung tính giữ nguyên chữ.
  const reasonChip = (reason?: string | null): { label: string; color: string } | null => {
    if (!reason) return null;
    const r = reason.toLowerCase();
    if (r.includes('downtrend')) return { label: 'Thị trường rủi ro', color: getPhaseMeta('downtrend').color(theme) };
    if (r.includes('rebalance')) return { label: 'Tái cơ cấu', color: getPhaseMeta('transition').color(theme) };
    return { label: reason, color: theme.palette.text.secondary };
  };

  // Header trong suốt (đồng bộ demo), cho phép wrap để cột co lại tránh trượt ngang.
  const headSx = {
    fontSize: getResponsiveFontSize('xs'),
    color: 'text.secondary',
    fontWeight: fontWeight.semibold,
    borderColor: bdHead,
  };
  // height cố định: row có/không chip cao bằng nhau → không flick khi đổi phiên.
  const cellSx = { fontSize: getResponsiveFontSize('sm'), borderColor: bd, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', height: 40 };

  return (
    <AmbientCard
      glowColor={accent}
      filled={false}
      rootSx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      sx={{ p: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <Stack direction="row" spacing={3} sx={{ p: { xs: 2, md: 2.5 }, flexWrap: 'wrap', gap: 1.5 }}>
        <Stat label="Số lệnh (đã đóng)" value={`${closed.length}`} />
        <Stat label="Tỷ lệ thắng" value={`${winRate.toFixed(0)}%`} color={winRate >= 50 ? theme.palette.trend.up : theme.palette.text.primary} />
        <Stat label="Lãi TB/lệnh" value={avgWin == null ? '—' : pct(avgWin)} color={avgWin == null ? undefined : colorPct(avgWin)} />
        <Stat label="Lỗ TB/lệnh" value={avgLoss == null ? '—' : pct(avgLoss)} color={avgLoss == null ? undefined : colorPct(avgLoss)} />
      </Stack>

      <TableContainer sx={{ flex: 1, minHeight: 0, maxHeight: { xs: 420, lg: 'none' } }}>
        <Table
          size="small"
          stickyHeader
          sx={{
            '& .MuiTableHead-root, & .MuiTableRow-root': { bgcolor: 'transparent' },
            // header cell cần nền ĐỤC để sticky che nội dung cuộn; dùng bg page (card đang trong suốt) → liền mạch, không phải paper.
            '& .MuiTableCell-head': { bgcolor: theme.palette.background.default },
            '& .MuiTableBody-root .MuiTableRow-root:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell sx={headSx}>Mã</TableCell>
              <TableCell sx={headSx}>{conservativeLayout ? 'Ngày mua' : 'Vào'}</TableCell>
              <TableCell sx={headSx}>{conservativeLayout ? 'Ngày bán' : 'Ra'}</TableCell>
              <TableCell align="right" sx={headSx}>Số phiên</TableCell>
              <TableCell align="right" sx={headSx}>Lãi/lỗ</TableCell>
              <TableCell align={conservativeLayout ? 'right' : undefined} sx={headSx}>Lý do</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {recentClosed.map((t, i) => {
              const chip = conservativeLayout ? reasonChip(t.exit_reason) : null;
              return (
                <TableRow key={`c-${t.ticker}-${i}`} hover>
                  <TableCell sx={{ ...cellSx, fontWeight: fontWeight.semibold }}>{t.ticker}</TableCell>
                  <TableCell sx={cellSx}>{fmtDate(t.entry_date)}</TableCell>
                  <TableCell sx={cellSx}>{fmtDate(t.exit_date)}</TableCell>
                  <TableCell align="right" sx={cellSx}>{t.n_days ?? '—'}</TableCell>
                  <TableCell align="right" sx={{ ...cellSx, color: colorPct(t.return_pct) }}>{pct(t.return_pct)}</TableCell>
                  <TableCell align={conservativeLayout ? 'right' : undefined} sx={cellSx}>
                    {conservativeLayout ? (
                      chip ? (
                        <Box
                          component="span"
                          sx={{ display: 'inline-block', px: 1, py: 0.25, borderRadius: 999, fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold, color: chip.color, bgcolor: alpha(chip.color, 0.12) }}
                        >
                          {chip.label}
                        </Box>
                      ) : (
                        '—'
                      )
                    ) : (
                      t.exit_reason ?? '—'
                    )}
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
