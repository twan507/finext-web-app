'use client';

import { Box, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, alpha, useMediaQuery, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import AmbientCard from './AmbientCard';
import type { PhaseBasket, PhaseRank, PhaseTrading } from '../types';
import { getStatusMeta } from '../basketMeta';
import { getPhaseMeta } from '../phaseMeta';

export interface HoldingStat {
  label: string;
  value: string;
  tone?: 'up' | 'down' | 'neutral';
}

interface HoldingsTableProps {
  basket: PhaseBasket;
  ranks: PhaseRank[]; // toàn bộ phase_rank level='stock' của phiên (mã giữ → tên/trạng thái; mã book → thanh khoản/đà giá)
  trades: PhaseTrading[]; // sổ lệnh của rổ (để lấy giá mua/hiện tại + lãi/lỗ vị thế mở)
  accent: string; // màu nhận diện rổ (ambient glow của card)
  stats: HoldingStat[]; // header tổng hợp (lãi/lỗ danh mục · số mã giữ · sắp ra · chờ vào)
  isLatest: boolean; // phiên mới nhất? false → ẩn cột Giá hiện tại + Lãi/lỗ (quá khứ không có MTM)
  selectedDate: string; // phiên đang xem — chọn trade mở tại phiên để lấy Giá mua
  conservativeLayout?: boolean; // Phòng Thủ: đổi nhãn cột "Biến động giá 6T" → "+/- giá 6 tháng"
}

function pct(v?: number | null): string {
  return v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}
function price(v?: number): string {
  return v == null ? '—' : v.toFixed(2);
}
// Thanh khoản (vma60) — tỷ đồng, đồng bộ RankTable.
function vma(v?: number | null): string {
  return v == null ? '—' : `${v.toFixed(1)} tỷ`;
}
// Ngày (giả định UTC literal, đồng bộ OrderBook/SessionStrip).
function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}
// Thứ tự nhóm trạng thái khi xếp bảng nắm giữ (Nắm giữ → Cân nhắc → Tiềm năng → Quan sát).
const STATUS_ORDER: Record<string, number> = { trong_ro: 0, vung_buffer: 1, ung_vien: 2, ngoai: 3 };

/**
 * Bảng cổ phiếu đang nắm giữ (hoặc "dự kiến" khi phòng thủ tiền mặt) — kèm lãi/lỗ từng mã + lãi/lỗ danh mục.
 * Lãi/lỗ lấy từ vị thế đang mở trong phase_trading (MTM tạm tính). Downtrend (held rỗng) → hiện danh mục dự kiến từ book, không có lãi/lỗ.
 */
export default function HoldingsTable({ basket, ranks, trades, accent, stats, isLatest, selectedDate, conservativeLayout = false }: HoldingsTableProps) {
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
  const showLive = isHolding && isLatest; // cột MTM (Hiện tại/Số phiên/Lãi-lỗ) chỉ có ở phiên mới nhất
  // Trạng thái thị trường (banner "danh mục dự kiến" khi 100% tiền mặt) — màu theo pha (downtrend = đỏ).
  const marketPhase = getPhaseMeta((basket.market_phase ?? '').toLowerCase());
  const marketPhaseColor = marketPhase.color(theme);

  // Vị thế "đang mở tại phiên đang xem": entry_date <= S và (chưa thoát hoặc thoát sau S).
  // (slice(0,10) để so sánh theo ngày, không phụ thuộc date/datetime.)
  const sKey = selectedDate.slice(0, 10);
  const openByTicker = new Map<string, PhaseTrading>();
  for (const t of trades) {
    const entry = (t.entry_date ?? '').slice(0, 10);
    const exit = t.exit_date ? t.exit_date.slice(0, 10) : null;
    if (entry <= sKey && (exit === null || exit > sKey)) openByTicker.set(t.ticker, t);
  }
  const rankByTicker = new Map<string, PhaseRank>();
  for (const r of ranks) rankByTicker.set(r.ticker, r);

  const rows = Object.keys(weights)
    .map((tk) => ({ ticker: tk, weight: weights[tk], rank: rankByTicker.get(tk), trade: openByTicker.get(tk) }))
    // Xếp: trạng thái → ngày mua (mới→cũ) → lãi→lỗ. (State tiền mặt không có trade → 2 khoá sau trung tính, giữ ổn định.)
    .sort((a, b) => {
      const sa = STATUS_ORDER[a.rank?.status ?? ''] ?? 99;
      const sb = STATUS_ORDER[b.rank?.status ?? ''] ?? 99;
      if (sa !== sb) return sa - sb;
      const da = a.trade?.entry_date ?? '';
      const db = b.trade?.entry_date ?? '';
      if (da !== db) return da < db ? 1 : -1; // ngày mua mới nhất lên trên
      return (b.trade?.return_pct ?? 0) - (a.trade?.return_pct ?? 0); // lãi cao → lỗ
    });

  // KPI tổng hợp (số mã/tỷ trọng/lãi-lỗ) đã chuyển lên hero AI (BasketAiHero); bảng chỉ giữ dữ liệu chi tiết.
  const colorPct = (v?: number | null) => ((v ?? 0) >= 0 ? theme.palette.trend.up : theme.palette.trend.down);
  // Lãi/lỗ làm tròn về 0.0 → hiện '0.0%' (không dấu +/-) + tô vàng (hoà vốn). isFlat bám đúng chuỗi toFixed của pct.
  const flatYellow = getPhaseMeta('transition').color(theme);
  const isFlat = (v?: number | null) => v != null && ['0.0', '-0.0'].includes((v * 100).toFixed(1));
  const pnlText = (v?: number | null) => (isFlat(v) ? '0.0%' : pct(v));
  const pnlColor = (v?: number | null) => (isFlat(v) ? flatYellow : colorPct(v));
  // Phòng Thủ: co padding ngang trên mobile (xs/sm) + tiêu đề không wrap (để minWidth max-content tự khít 1 dòng).
  const compactPx = conservativeLayout ? { px: { xs: 1, sm: 1.25, md: 2 }, whiteSpace: 'nowrap' } : {};
  // Header trong suốt (đồng bộ demo).
  const headSx = { fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', fontWeight: fontWeight.semibold, borderColor: bdHead, ...compactPx };
  // height cố định: row có/không chip cao bằng nhau → không flick khi đổi phiên.
  const cellSx = { fontSize: getResponsiveFontSize('sm'), borderColor: bd, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', height: 40, ...compactPx };
  // Phòng Thủ trên mobile (<600px): bỏ cột Ngày mua + Giá mua + tên doanh nghiệp (chỉ giữ mã) để tiết kiệm chiều ngang.
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const mobileHide = isMobile && conservativeLayout;
  const showEntryDate = conservativeLayout && isHolding && !isMobile; // "Ngày mua" (vốn chỉ có ở Phòng Thủ)
  const showEntryPrice = isHolding && !mobileHide; // "Giá mua"
  const showName = !mobileHide; // tên công ty cạnh mã

  // nOther/otherW chỉ dùng cho tab non-conservative (fixed layout: Mã 36% + chia đều 64%). Phòng Thủ auto-layout nên bỏ % cột.
  const nOther = isHolding ? (showEntryDate ? 1 : 0) + (showEntryPrice ? 1 : 0) + (showLive ? 2 : 0) + 2 : 2;
  const otherW = `${(64 / nOther).toFixed(2)}%`;
  const wMa = conservativeLayout ? {} : { width: '36%' };
  const wOther = conservativeLayout ? {} : { width: otherW };

  return (
    <AmbientCard glowColor={accent} filled={false} sx={{ p: 0 }}>
      {isHolding ? (
        // Phòng Thủ: hàng thống kê tràn ra + cuộn ngang (không wrap), đồng bộ với bảng bên dưới.
        <Stack
          direction="row"
          spacing={3}
          sx={{
            p: { xs: 2, md: 2.5 },
            gap: 1.5,
            flexWrap: conservativeLayout ? 'nowrap' : 'wrap',
            ...(conservativeLayout ? { overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } } : {}),
          }}
        >
          {stats.map((s) => (
            <Box key={s.label} sx={{ flexShrink: 0 }}>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>{s.label}</Typography>
              <Typography sx={{ fontSize: '1.15rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: toneColor(s.tone) }}>{s.value}</Typography>
            </Box>
          ))}
        </Stack>
      ) : (
        // Compact + cùng cấu trúc 2 dòng như stats header → chiều cao khớp, tránh flick khi đổi phiên.
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: { xs: 2, md: 2.5 } }}>
          <Box sx={{ width: 4, alignSelf: 'stretch', minHeight: 34, borderRadius: 2, bgcolor: marketPhaseColor, flexShrink: 0 }} />
          <Box>
            <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.primary', fontWeight: fontWeight.semibold }}>
              Thị trường đang ở trạng thái{' '}
              <Box component="span" sx={{ color: marketPhaseColor, fontWeight: fontWeight.bold }}>
                {marketPhase.en}
              </Box>
            </Typography>
            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', mt: 0.25 }}>Đây chỉ là danh mục tham khảo.</Typography>
          </Box>
        </Stack>
      )}

      <TableContainer>
        <Table
          size="small"
          sx={{
            // Phòng Thủ: auto-layout + minWidth max-content → sàn TỰ khít bề rộng tiêu đề (1 dòng); rộng hơn thì fill card, hẹp hơn thì cuộn.
            // CORE: giữ tableLayout fixed (Mã 36% + chia đều) như cũ.
            ...(conservativeLayout ? { minWidth: 'max-content', width: '100%' } : { tableLayout: 'fixed' }),
            '& .MuiTableHead-root, & .MuiTableCell-head, & .MuiTableRow-root': { bgcolor: 'transparent' },
            '& .MuiTableBody-root .MuiTableRow-root:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...headSx, ...wMa }}>Mã</TableCell>
              {isHolding ? (
                <>
                  {showEntryDate && <TableCell align="right" sx={{ ...headSx, ...wOther }}>Ngày mua</TableCell>}
                  {showEntryPrice && <TableCell align="right" sx={{ ...headSx, ...wOther }}>Giá mua</TableCell>}
                  {showLive && <TableCell align="right" sx={{ ...headSx, ...wOther }}>Giá hiện tại</TableCell>}
                  <TableCell align="right" sx={{ ...headSx, ...wOther }}>Số phiên</TableCell>
                  <TableCell align="right" sx={{ ...headSx, ...wOther }}>Trạng thái</TableCell>
                  {showLive && <TableCell align="right" sx={{ ...headSx, ...wOther }}>Lãi/lỗ</TableCell>}
                </>
              ) : (
                <>
                  <TableCell align="right" sx={{ ...headSx, ...wOther }}>{'% biến động 6T'}</TableCell>
                  <TableCell align="right" sx={{ ...headSx, ...wOther }}>Thanh khoản</TableCell>
                </>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => {
              const st = r.rank ? getStatusMeta(r.rank.status) : null; // badge Trạng thái (chỉ dùng khi đang giữ)
              return (
                <TableRow key={r.ticker} hover>
                  <TableCell sx={cellSx}>
                    {/* Ticker (đậm, không co) + tên công ty (cắt "..." chỉ khi hết chỗ của cột Mã) */}
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, minWidth: 0 }}>
                      <Typography component="span" sx={{ fontWeight: fontWeight.semibold, fontSize: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>{r.ticker}</Typography>
                      {showName && r.rank?.ten && (
                        <Typography
                          component="span"
                          title={r.rank.ten}
                          // Phòng Thủ (auto-layout): hiện FULL tên, cột Mã tự nới. CORE (fixed 36%): flex:1 + cắt "…" cho vừa cột.
                          sx={{ color: 'text.disabled', fontSize: getResponsiveFontSize('xs'), whiteSpace: 'nowrap', ...(conservativeLayout ? {} : { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }) }}
                        >
                          {r.rank.ten}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  {isHolding ? (
                    <>
                      {showEntryDate && <TableCell align="right" sx={cellSx}>{fmtDate(r.trade?.entry_date)}</TableCell>}
                      {showEntryPrice && <TableCell align="right" sx={cellSx}>{price(r.trade?.entry_price)}</TableCell>}
                      {showLive && <TableCell align="right" sx={cellSx}>{price(r.trade?.exit_price)}</TableCell>}
                      <TableCell align="right" sx={cellSx}>{r.trade?.n_days ?? '—'}</TableCell>
                      <TableCell align="right" sx={cellSx}>
                        {st ? (
                          <Box component="span" sx={{ display: 'inline-block', px: 1, py: 0.25, borderRadius: 999, fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold, color: st.color(theme), bgcolor: alpha(st.color(theme), 0.12) }}>
                            {st.label}
                          </Box>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      {showLive && (
                        <TableCell align="right" sx={{ ...cellSx, color: pnlColor(r.trade?.return_pct), fontWeight: fontWeight.semibold }}>
                          {pnlText(r.trade?.return_pct)}
                        </TableCell>
                      )}
                    </>
                  ) : (
                    <>
                      <TableCell align="right" sx={{ ...cellSx, color: colorPct(r.rank?.mom120) }}>{pct(r.rank?.mom120)}</TableCell>
                      <TableCell align="right" sx={cellSx}>{vma(r.rank?.vma60)}</TableCell>
                    </>
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
