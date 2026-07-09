'use client';

import { Box, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, alpha, useTheme } from '@mui/material';
import { getGlassCard, getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import type { PhaseBasket, PhaseRank, PhaseTrading } from '../types';
import { getStatusMeta } from '../basketMeta';

interface HoldingsTableProps {
  basket: PhaseBasket;
  heldRanks: PhaseRank[]; // các dòng phase_rank có held=1 (để lấy tên/hạng/trạng thái)
  trades: PhaseTrading[]; // sổ lệnh của rổ (để lấy giá vào/hiện tại + lãi/lỗ vị thế mở)
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
export default function HoldingsTable({ basket, heldRanks, trades }: HoldingsTableProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

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

  // Lãi/lỗ danh mục = trung bình theo tỷ trọng của các vị thế đang mở (tạm tính).
  let wsum = 0;
  let psum = 0;
  for (const r of rows) {
    if (r.trade && r.trade.return_pct != null) {
      wsum += r.weight;
      psum += r.weight * r.trade.return_pct;
    }
  }
  const portfolioPnl = wsum > 0 ? psum / wsum : null;

  const colorPct = (v?: number | null) => ((v ?? 0) >= 0 ? theme.palette.trend.up : theme.palette.trend.down);
  const headSx = { fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', fontWeight: fontWeight.semibold, whiteSpace: 'nowrap', borderColor: theme.palette.divider, bgcolor: theme.palette.background.paper };
  const cellSx = { fontSize: getResponsiveFontSize('sm'), borderColor: theme.palette.divider, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

  return (
    <Box sx={{ borderRadius: `${borderRadius.lg}px`, ...getGlassCard(isDark), overflow: 'hidden' }}>
      {isHolding ? (
        <Stack direction="row" spacing={3} sx={{ p: { xs: 2, md: 2.5 }, flexWrap: 'wrap', gap: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Số mã nắm giữ</Typography>
            <Typography sx={{ fontSize: '1.15rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{rows.length}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Tỷ trọng cổ phiếu</Typography>
            <Typography sx={{ fontSize: '1.15rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(Math.min(basket.market_exposure ?? 0, 1) * 100)}%
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Lãi/lỗ danh mục (tạm tính)</Typography>
            <Typography sx={{ fontSize: '1.15rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: colorPct(portfolioPnl) }}>{pct(portfolioPnl)}</Typography>
          </Box>
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

      <TableContainer sx={{ maxHeight: 460 }}>
        <Table stickyHeader size="small">
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
                    {r.rank?.ten && <Typography component="span" sx={{ color: 'text.disabled', fontSize: getResponsiveFontSize('xs'), ml: 0.75 }}>{r.rank.ten}</Typography>}
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
    </Box>
  );
}
