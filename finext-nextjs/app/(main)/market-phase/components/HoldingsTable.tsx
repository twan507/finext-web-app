'use client';

import { Box, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import AmbientCard from './AmbientCard';
import type { PhaseBasket, PhaseRank, PhaseTrading } from '../types';
import { getStatusMeta } from '../basketMeta';

export interface HoldingStat {
  label: string;
  value: string;
  tone?: 'up' | 'down' | 'neutral';
}

interface HoldingsTableProps {
  basket: PhaseBasket;
  heldRanks: PhaseRank[]; // các dòng phase_rank có held=1 (để lấy tên/hạng/trạng thái)
  trades: PhaseTrading[]; // sổ lệnh của rổ (để lấy giá vào/hiện tại + lãi/lỗ vị thế mở)
  accent: string; // màu nhận diện rổ (ambient glow của card)
  stats: HoldingStat[]; // header tổng hợp (lãi/lỗ danh mục · số mã giữ · sắp ra · chờ vào)
}

function pct(v?: number | null): string {
  return v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}
function price(v?: number): string {
  return v == null ? '—' : v.toFixed(2);
}

/**
 * Bảng cổ phiếu đang nắm giữ (hoặc "dự kiến" khi phòng thủ tiền mặt) — kèm lãi/lỗ từng mã + lãi/lỗ danh mục.
 * Lãi/lỗ lấy từ vị thế đang mở trong phase_trading (MTM tạm tính). Downtrend (held rỗng) → hiện danh mục dự kiến từ book, không có lãi/lỗ.
 */
export default function HoldingsTable({ basket, heldRanks, trades, accent, stats }: HoldingsTableProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const toneColor = (t?: HoldingStat['tone']) => (t === 'up' ? theme.palette.trend.up : t === 'down' ? theme.palette.trend.down : theme.palette.text.primary);
  // Border mảnh (đồng bộ demo) thay cho divider (0.12) đậm của hệ cũ.
  const bd = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const bdHead = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  const held = basket.held ?? {};
  const book = basket.book ?? {};
  const isHolding = Object.keys(held).length > 0;
  const weights = isHolding ? held : book;

  const openByTicker = new Map<string, PhaseTrading>();
  for (const t of trades) if (t.status === 'open') openByTicker.set(t.ticker, t);
  const rankByTicker = new Map<string, PhaseRank>();
  for (const r of heldRanks) rankByTicker.set(r.ticker, r);

  const rows = Object.keys(weights)
    .map((tk) => ({ ticker: tk, weight: weights[tk], rank: rankByTicker.get(tk), trade: openByTicker.get(tk) }))
    .sort((a, b) => {
      const ra = a.rank?.rank ?? 999;
      const rb = b.rank?.rank ?? 999;
      if (ra !== rb) return ra - rb;
      return b.weight - a.weight;
    });

  // KPI tổng hợp (số mã/tỷ trọng/lãi-lỗ) đã chuyển lên hero AI (BasketAiHero); bảng chỉ giữ dữ liệu chi tiết.
  const colorPct = (v?: number | null) => ((v ?? 0) >= 0 ? theme.palette.trend.up : theme.palette.trend.down);
  // Header trong suốt (đồng bộ demo), cho phép wrap để cột co lại tránh trượt ngang.
  const headSx = { fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', fontWeight: fontWeight.semibold, borderColor: bdHead };
  const cellSx = { fontSize: getResponsiveFontSize('sm'), borderColor: bd, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

  return (
    <AmbientCard glowColor={accent} filled={false} sx={{ p: 0 }}>
      {isHolding ? (
        <Stack direction="row" spacing={3} sx={{ p: { xs: 2, md: 2.5 }, flexWrap: 'wrap', gap: 1.5 }}>
          {stats.map((s) => (
            <Box key={s.label}>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{s.label}</Typography>
              <Typography sx={{ fontSize: '1.15rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: toneColor(s.tone) }}>{s.value}</Typography>
            </Box>
          ))}
        </Stack>
      ) : (
        <Box sx={{ p: { xs: 2, md: 2.5 } }}>
          <Box sx={{ p: 1.5, borderRadius: `${borderRadius.md}px`, bgcolor: alpha(theme.palette.trend.ref, 0.12), border: `1px solid ${alpha(theme.palette.trend.ref, 0.4)}` }}>
            <Typography sx={{ fontWeight: fontWeight.bold, color: theme.palette.trend.ref }}>100% TIỀN MẶT — đang phòng thủ</Typography>
            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', mt: 0.5 }}>
              Danh mục dự kiến dưới đây sẽ được mua khi thị trường bật lại.
            </Typography>
          </Box>
        </Box>
      )}

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
              <TableCell sx={headSx}>Mã</TableCell>
              <TableCell align="right" sx={headSx}>{isHolding ? 'Tỷ trọng' : 'Tỷ trọng dự kiến'}</TableCell>
              {isHolding && (
                <>
                  <TableCell align="right" sx={headSx}>Giá vào</TableCell>
                  <TableCell align="right" sx={headSx}>Hiện tại</TableCell>
                  <TableCell align="right" sx={headSx}>Số phiên</TableCell>
                </>
              )}
              <TableCell sx={headSx}>Trạng thái</TableCell>
              {isHolding && (
                <TableCell align="right" sx={headSx}>Lãi/lỗ</TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => {
              const st = r.rank ? getStatusMeta(r.rank.status) : null;
              return (
                <TableRow key={r.ticker} hover>
                  <TableCell sx={cellSx}>
                    <Typography component="span" sx={{ fontWeight: fontWeight.semibold, fontSize: 'inherit' }}>{r.ticker}</Typography>
                    {r.rank?.ten && (
                      <Typography
                        component="span"
                        title={r.rank.ten}
                        sx={{ color: 'text.disabled', fontSize: getResponsiveFontSize('xs'), ml: 0.75, display: 'inline-block', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }}
                      >
                        {r.rank.ten}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={cellSx}>{(r.weight * 100).toFixed(1)}%</TableCell>
                  {isHolding && (
                    <>
                      <TableCell align="right" sx={cellSx}>{price(r.trade?.entry_price)}</TableCell>
                      <TableCell align="right" sx={cellSx}>{price(r.trade?.exit_price)}</TableCell>
                      <TableCell align="right" sx={cellSx}>{r.trade?.n_days ?? '—'}</TableCell>
                    </>
                  )}
                  <TableCell sx={cellSx}>
                    {st ? (
                      <Box component="span" sx={{ display: 'inline-block', px: 1, py: 0.25, borderRadius: 999, fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold, color: st.color(theme), bgcolor: alpha(st.color(theme), 0.12) }}>
                        {st.label}
                      </Box>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  {isHolding && (
                    <TableCell align="right" sx={{ ...cellSx, color: colorPct(r.trade?.return_pct), fontWeight: fontWeight.semibold }}>
                      {pct(r.trade?.return_pct)}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </AmbientCard>
  );
}
