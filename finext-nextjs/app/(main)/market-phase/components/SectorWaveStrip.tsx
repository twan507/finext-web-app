'use client';

import { useMemo, useRef, useState } from 'react';
import { Box, Stack, Tooltip, Typography, useTheme, alpha } from '@mui/material';
import { getGlassCard, getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import type { PhaseIndustryRow } from '../types';
import { getStatusMeta } from '../basketMeta';

// Heatmap ngành kiểu GitHub-contribution — tầng NGÀNH của rổ Sóng Ngành.
// phase_industry (schema 2026-07-12): mỗi ô = 1 ngành × 1 phiên, màu theo trạng thái.
// Ô dùng CHUNG bảng trạng thái với chip cổ phiếu (RANK_STATUS_META) → tên + màu luôn khớp nhau.
// Tầng ngành KHÔNG có cho_tin_hieu (không có cổng vào giá) nên chỉ 4 mức. ĐANG NẮM ⟺ >= 2.
// Chỉ render ngành từng có tín hiệu (>=1) trong cửa sổ → không lộ universe.
const SESSIONS = 60;
const LABEL_W = 180;
const CELL = 13; // ô vuông
const GAP = 3;
const UNIT = CELL + GAP; // bước ngang = bước dọc → lưới vuông đều
const ROW_H = UNIT;
const AXIS_H = 22;
/** Khoảng GIÃN THÊM giữa 2 kỳ tái cơ cấu — tách nhóm bằng khoảng cách thay vì vẽ vạch. */
const CYCLE_GAP = 7;

// Giá trị phase_industry → trạng thái. Nắm giữ + Cân nhắc CÙNG TÔNG (accent của rổ = tím cho Sóng Ngành),
// Cân nhắc đã TRỘN XÁM sẵn (trầm hơn) trong basketMeta → ở đây chỉ hạ nhẹ còn 0.8, KHÔNG hạ sâu (hạ sâu nhìn mờ xấu).
// Tiềm năng (xanh lá) / Quan sát (xám) = ngoài rổ.
// `op` = sắc độ của Ô LƯỚI (ô không phải chữ nên mờ sâu được: Cân nhắc 0.5, ô trống 0.16).
// Phần CHỮ (nhãn ngành, chip bên bảng) dùng StatusMeta.op = 0.7 — 0.5 sẽ khó đọc.
const LV: { key: string; op: number; desc: string }[] = [
  { key: 'ngoai', op: 0.16, desc: 'Chưa được khuyến nghị — ngành đang trong diện theo dõi.' },
  { key: 'ung_vien', op: 0.85, desc: 'Ngành đang mạnh lên — dự kiến được mua vào ở kỳ tái cơ cấu tới.' },
  { key: 'vung_buffer', op: 0.5, desc: 'Vẫn đang nắm giữ nhưng sức mạnh đã yếu đi — có thể bị thay thế ở kỳ tái cơ cấu tới.' },
  { key: 'trong_ro', op: 1, desc: 'Ngành đang được khuyến nghị nắm giữ — danh mục đang phân bổ vốn vào cổ phiếu của ngành này.' },
];
/** Thứ tự hiển thị (legend + tooltip): Nắm giữ → Cân nhắc → Tiềm năng → Quan sát. */
const LV_ORDER = [3, 2, 1, 0];
/** Pha rủi ro (100% tiền mặt): mọi ô mờ hẳn về 0.1 — danh mục thực tế KHÔNG nắm ngành nào. */
const RISK_OP = 0.1;

interface SectorWaveStripProps {
  industry: PhaseIndustryRow[];
  /** Ngành ĐANG NẮM (>=2) ở phiên mới nhất → nhãn in đậm + chấm. */
  liveSectors: Set<string>;
  /** Mã ngành → tên đầy đủ (thiếu → fallback về mã). */
  nameByCode: Map<string, string>;
  /** Các phiên 100% tiền mặt (phase_daily.market_exposure == 0) → làm mờ ĐÚNG những CỘT đó.
   *  phase_industry không còn tự về 0 khi downtrend nên phải ghép ở tầng web. Key = date slice(0,10). */
  cashDates?: Set<string>;
  /** Màu chủ đề của rổ (Sóng Ngành = tím) → dùng cho Nắm giữ + Cân nhắc, khớp chip bảng vận hành. */
  accent?: string;
  /** Số phiên còn lại tới kỳ cơ cấu NGÀNH tiếp theo (null = data chưa có → ẩn dòng). */
  nextRebalance?: number | null;
  /** Các phiên vừa cơ cấu (bắt đầu chu kỳ mới) → vẽ vạch đứt dọc phân tách các kỳ. Key = date slice(0,10). */
  rebalanceDates?: Set<string>;
}

interface Row {
  name: string;
  cells: number[]; // giá trị 0..3 theo từng phiên
}

function fmtD(s: string): string {
  const d = String(s).slice(0, 10);
  const [y, m, dd] = d.split('-');
  return dd && m && y ? `${dd}/${m}/${y}` : d;
}

export default function SectorWaveStrip({ industry, liveSectors, nameByCode, cashDates, accent, nextRebalance, rebalanceDates }: SectorWaveStripProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  const { rows, ticks, W, H, n, dates, stateBySession, riskBySession, xs } = useMemo(() => {
    const recent = industry.slice(-SESSIONS);
    const n = recent.length;
    const val = (r: PhaseIndustryRow, k: string) => Number(r[k]) || 0;

    // Ngành từng có tín hiệu (>=1) trong cửa sổ.
    const set = new Set<string>();
    for (const r of recent) for (const k of Object.keys(r)) if (k !== 'date' && val(r, k) >= 1) set.add(k);

    const heldOf = (name: string) => recent.reduce((s, r) => s + (val(r, name) >= 2 ? 1 : 0), 0);
    const anyOf = (name: string) => recent.reduce((s, r) => s + (val(r, name) >= 1 ? 1 : 0), 0);
    // Nắm nhiều phiên nhất lên trên; hoà → xét tổng phiên có tín hiệu.
    const names = Array.from(set).sort((a, b) => heldOf(b) - heldOf(a) || anyOf(b) - anyOf(a));

    const rows: Row[] = names.map((name) => ({ name, cells: recent.map((r) => val(r, name)) }));

    const dates = recent.map((r) => String(r.date));
    // Tooltip: chỉ ngành CÓ tín hiệu (bỏ Quan sát cho gọn), mức cao → thấp (Nắm giữ → Cân nhắc → Tiềm năng).
    const stateBySession = recent.map((r) =>
      names
        .map((nm) => ({ code: nm, v: val(r, nm) }))
        .filter((x) => x.v >= 1)
        .sort((a, b) => b.v - a.v),
    );
    // Phiên 100% tiền mặt → cả CỘT mờ hẳn (danh mục thực tế không nắm gì ở phiên đó).
    const riskBySession = recent.map((r) => cashDates?.has(String(r.date).slice(0, 10)) ?? false);

    // ── Phân kỳ tái cơ cấu: KHÔNG vẽ vạch, chỉ GIÃN KHOẢNG CÁCH giữa 2 kỳ (Cycle Gap) ──
    // Mắt tự gom các cột cùng kỳ thành 1 khối (Gestalt proximity) — cách GitHub tách tháng trên
    // contribution graph. Lưới giữ sạch tuyệt đối, không thêm "mực".
    // LƯU Ý: backend phase_rank chỉ trả 60 phiên dòng sector; nếu vì lý do gì đó ngắn hơn cửa sổ
    // heatmap thì chỉ suy được vài mốc ở cuối → lịch cơ cấu có nhịp CỐ ĐỊNH nên suy ngược chu kỳ
    // (khoảng cách 2 mốc liên tiếp) về đầu chart cho đủ.
    const known = recent.map((_, i) => i).filter((i) => i > 0 && (rebalanceDates?.has(String(recent[i].date).slice(0, 10)) ?? false));
    const boundaries = new Set(known);
    if (known.length >= 2) {
      const cycle = known[known.length - 1] - known[known.length - 2];
      if (cycle > 0) for (let i = known[0] - cycle; i > 0; i -= cycle) boundaries.add(i);
    }
    // xs[i] = x THẬT của cột i (đã cộng dồn gap của mọi ranh giới kỳ trước nó) → mọi thứ đọc từ đây,
    // không còn công thức LABEL_W + i*UNIT vì bước cột không còn đều.
    const xs: number[] = [];
    let extra = 0;
    for (let i = 0; i < n; i++) {
      if (boundaries.has(i)) extra += CYCLE_GAP;
      xs.push(LABEL_W + i * UNIT + extra);
    }

    const ticks: { x: number; label: string }[] = [];
    let prev = '';
    recent.forEach((r, i) => {
      const m = String(r.date).slice(0, 7);
      if (m !== prev) {
        if (prev) ticks.push({ x: xs[i], label: 'T' + Number(String(r.date).slice(5, 7)) });
        prev = m;
      }
    });

    const W = (xs[n - 1] ?? LABEL_W) + CELL + GAP;
    return { rows, ticks, W, H: names.length * ROW_H + AXIS_H, n, dates, stateBySession, riskBySession, xs };
  }, [industry, cashDates, rebalanceDates]);

  if (rows.length === 0 || n === 0) return null;

  const onMove = (e: React.MouseEvent) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vbX = ((e.clientX - rect.left) / rect.width) * W;
    if (vbX < LABEL_W) {
      setHover(null);
      return;
    }
    // Bước cột KHÔNG đều (đã chèn CYCLE_GAP giữa các kỳ) → không chia UNIT được, phải tìm cột gần nhất.
    let i = 0;
    let best = Infinity;
    for (let k = 0; k < n; k++) {
      const d = Math.abs(vbX - (xs[k] + CELL / 2));
      if (d < best) {
        best = d;
        i = k;
      }
    }
    setHover({ i, x: e.clientX, y: e.clientY });
  };

  const hi = hover?.i ?? -1;
  const lvOf = (v: number) => LV[v] ?? LV[0];
  const lvMeta = (v: number) => getStatusMeta(lvOf(v).key);
  const lvColor = (v: number) => lvMeta(v).color(theme, accent);
  const lvLabel = (v: number) => lvMeta(v).label;
  /** Màu "ô" — dùng cho ô lưới + swatch legend + chấm tooltip (đều là ô, mờ sâu được). */
  const cellTone = (v: number) => alpha(lvColor(v), lvOf(v).op);
  /** Màu ô trên lưới — phiên 100% tiền mặt thì mọi mức mờ hẳn về 0.1. */
  const cellFill = (v: number, risk: boolean) => alpha(lvColor(v), risk ? RISK_OP : lvOf(v).op);
  /** Màu CHỮ (nhãn ngành) — dùng op của trạng thái (Cân nhắc 0.7), khớp chip bên bảng. */
  const labelTone = (v: number) => alpha(lvColor(v), lvMeta(v).op ?? 1);
  const latestIsRisk = riskBySession[n - 1] ?? false;
  const glassTooltipSx = { ...getGlassCard(isDark), color: theme.palette.text.primary, px: 1.25, py: 1, borderRadius: `${borderRadius.md}px`, maxWidth: 260 };

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Legend (Nắm giữ → Quan sát) — hover từng mục để xem giải thích. */}
      <Stack direction="row" alignItems="center" sx={{ mb: 0.75, flexWrap: 'wrap', gap: { xs: 1.25, md: 2 } }}>
        {LV_ORDER.map((v) => (
          <Tooltip
            key={v}
            placement="top"
            slotProps={{ tooltip: { sx: glassTooltipSx } }}
            title={
              <Box>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: fontWeight.bold, color: labelTone(v) }}>{lvLabel(v)}</Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25, lineHeight: 1.5 }}>{lvOf(v).desc}</Typography>
              </Box>
            }
          >
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Box sx={{ width: 11, height: 11, borderRadius: '3px', bgcolor: cellTone(v), flexShrink: 0 }} />
              <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', whiteSpace: 'nowrap' }}>{lvLabel(v)}</Typography>
            </Stack>
          </Tooltip>
        ))}
      </Stack>

      {/* Lịch cơ cấu NGÀNH (nhịp riêng, khác tầng cổ phiếu) — ẩn nếu data chưa có next_rebalance_in ở dòng sector. */}
      {nextRebalance != null && (
        <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', mb: 1.25 }}>
          Kì tái cơ cấu ngành tiếp theo còn{' '}
            {nextRebalance} phiên
        </Typography>
      )}

      <Box sx={{ overflowX: 'auto' }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 560, display: 'block' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          {/* Kỳ tái cơ cấu KHÔNG vẽ vạch — đã tách bằng khoảng cách (xs đã cộng dồn CYCLE_GAP). */}
          {ticks.map((t, i) => (
            <text key={i} x={t.x} y={H - 6} fontSize={10} fill={theme.palette.text.disabled}>
              {t.label}
            </text>
          ))}

          {rows.map((row, r) => {
            const y = r * ROW_H + GAP / 2;
            // Phiên mới nhất là tiền mặt → KHÔNG đánh dấu "đang nắm" (thực tế danh mục đã bán sạch).
            const live = !latestIsRisk && liveSectors.has(row.name);
            const lastV = row.cells[n - 1] ?? 0; // ngành đang nắm → 3 (Nắm giữ) hoặc 2 (Cân nhắc)
            return (
              <g key={row.name}>
                {/* Nhãn ngành đang nắm tô ĐÚNG màu + độ mờ chữ của trạng thái (Cân nhắc 0.7) — không tô trắng. */}
                <text x={0} y={y + CELL / 2 + 4} fontSize={11} fontWeight={live ? 700 : 400} fill={live ? labelTone(lastV) : theme.palette.text.secondary}>
                  {(live ? '● ' : '') + (nameByCode.get(row.name) ?? row.name)}
                </text>
                {row.cells.map((v, i) => (
                  <rect key={i} x={xs[i]} y={y} width={CELL} height={CELL} rx={3} fill={cellFill(v, riskBySession[i])} />
                ))}
              </g>
            );
          })}

          {/* Crosshair kiểu lưới: khung bao quanh CỘT phiên đang hover. */}
          {hi >= 0 && (
            <rect
              x={xs[hi] - 2}
              y={-1}
              width={CELL + 4}
              height={rows.length * ROW_H + 2}
              rx={4}
              fill="none"
              stroke={alpha(theme.palette.text.primary, isDark ? 0.5 : 0.42)}
              strokeWidth={1}
              pointerEvents="none"
            />
          )}
        </svg>
      </Box>

      {hover && (
        <Box
          sx={{
            position: 'fixed',
            zIndex: 1500,
            pointerEvents: 'none',
            left: Math.min(hover.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 2000) - 400),
            top: hover.y + 14,
            minWidth: 300,
            maxWidth: 380,
            maxHeight: 360,
            overflow: 'hidden',
            bgcolor: isDark ? 'rgba(18,20,26,0.94)' : 'rgba(255,255,255,0.97)',
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            p: 1.25,
            boxShadow: isDark ? '0 8px 28px rgba(0,0,0,0.6)' : '0 8px 28px rgba(0,0,0,0.18)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.semibold, color: 'text.primary', mb: riskBySession[hover.i] ? 0.25 : 0.75 }}>
            {fmtD(dates[hover.i])}
          </Typography>
          {riskBySession[hover.i] && (
            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.disabled', mb: 0.75, fontStyle: 'italic' }}>
              Phiên rủi ro — danh mục 100% tiền mặt
            </Typography>
          )}
          {stateBySession[hover.i].length > 0 ? (
            stateBySession[hover.i].map(({ code, v }) => (
              <Box key={code} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.2 }}>
                <Box sx={{ width: 9, height: 9, borderRadius: '2px', bgcolor: cellTone(v), flexShrink: 0 }} />
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {nameByCode.get(code) ?? code}
                </Typography>
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: labelTone(v), fontWeight: fontWeight.bold, flexShrink: 0 }}>{lvLabel(v)}</Typography>
              </Box>
            ))
          ) : (
            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.disabled' }}>Chưa có ngành nào được khuyến nghị.</Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
