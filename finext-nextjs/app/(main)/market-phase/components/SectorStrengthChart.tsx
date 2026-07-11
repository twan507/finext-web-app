'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, useMediaQuery, useTheme, alpha } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import type { PhaseRank } from '../types';

// A "Focus + Context": 12 ngành cùng 1 trục composite (tương quan thật); ngành bật tô màu + neon glow + nhãn mép phải,
// còn lại là đường "bóng mờ". Chip legend (ngành từng có sóng) → bật/tắt. Hover: crosshair dọc + tooltip (chỉ ngành bật).
const W = 1040;
const H = 320;
const PL = 40;
const PT = 14;
const PB = 24;
const LABEL_LEAD = 8; // khoảng cách điểm cuối đường → nhãn (cách xa line)
const LABEL_PAD = 0; // đệm mép phải sau nhãn (nhỏ để nhãn sát mép)

function sectorName(r: PhaseRank): string {
  return r.ten || (r.sector ?? '') || r.ticker || '—';
}
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  return d;
}
function fmtD(s: string): string {
  const d = String(s).slice(0, 10);
  const [y, m, dd] = d.split('-');
  return dd && m && y ? `${dd}/${m}/${y}` : d;
}
function valueStr(v: number | null): string {
  return v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2);
}

interface Series {
  name: string;
  vals: (number | null)[];
  rankLast: number;
  last: number | null;
}

interface SectorStrengthChartProps {
  sectorRanks: PhaseRank[]; // FULL lịch sử (level='sector')
  activeSectors: Set<string>; // ngành từng có sóng → hiện chip legend
  nameByCode: Map<string, string>; // mã ngành → tên đầy đủ (thiếu → fallback về mã)
}

export default function SectorStrengthChart({ sectorRanks, activeSectors, nameByCode }: SectorStrengthChartProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const [pr, setPr] = useState(120); // lề phải động — đo bằng getBBox nhãn thật

  const { dates, series, top3, min, max } = useMemo(() => {
    const dates = Array.from(new Set(sectorRanks.map((r) => r.date))).sort();
    const byName = new Map<string, Map<string, PhaseRank>>();
    for (const r of sectorRanks) {
      const nm = sectorName(r);
      if (!byName.has(nm)) byName.set(nm, new Map());
      byName.get(nm)!.set(r.date, r);
    }
    const last = dates[dates.length - 1];
    const series: Series[] = Array.from(byName.entries()).map(([name, m]) => {
      const vals = dates.map((d) => m.get(d)?.composite ?? null);
      const lr = m.get(last);
      return { name, vals, rankLast: lr?.rank ?? 999, last: lr?.composite ?? null };
    });
    let min = Infinity;
    let max = -Infinity;
    for (const s of series) for (const v of s.vals) if (v != null) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    if (!isFinite(min)) { min = -1; max = 1; }
    min = Math.floor(min * 2) / 2 - 0.1;
    max = Math.ceil(max * 2) / 2 + 0.1;
    const top3 = [...series].sort((a, b) => a.rankLast - b.rankLast).slice(0, 3).map((s) => s.name);
    return { dates, series, top3, min, max };
  }, [sectorRanks]);

  const [focused, setFocused] = useState<Set<string>>(() => new Set(top3));

  // Đo bề rộng THẬT của nhãn mép phải (getBBox = đơn vị viewBox) → PR sát khít, không dư.
  const measurePr = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let maxW = 0;
    svg.querySelectorAll<SVGTextElement>('.str-edge-label').forEach((t) => {
      try {
        maxW = Math.max(maxW, t.getBBox().width);
      } catch {
        /* getBBox có thể ném nếu chưa layout */
      }
    });
    if (maxW <= 0) return;
    const next = Math.min(Math.max(Math.ceil(maxW) + LABEL_LEAD + LABEL_PAD, 40), W - PL - 300);
    setPr((cur) => (Math.abs(cur - next) > 0.5 ? next : cur));
  }, []);

  useLayoutEffect(() => {
    measurePr();
  });

  // Đo lại sau khi FONT load xong (đo bằng font fallback rộng hơn → dư lề) + sau 1 frame layout.
  useEffect(() => {
    const id = requestAnimationFrame(() => measurePr());
    if (typeof document !== 'undefined' && document.fonts) document.fonts.ready.then(() => measurePr());
    return () => cancelAnimationFrame(id);
  }, [measurePr]);

  const palette = [theme.palette.primary.main, theme.palette.trend.up, theme.palette.warning.main, '#3b82f6', '#ec4899', '#06b6d4', '#f97316', '#22d3ee'];
  const ghost = alpha(theme.palette.text.primary, isDark ? 0.1 : 0.14);

  if (dates.length < 2) return null;

  const n = dates.length - 1;
  const focusedList = series.filter((s) => focused.has(s.name)).sort((a, b) => a.rankLast - b.rankLast);
  const colorOf = (name: string) => palette[Math.max(0, focusedList.findIndex((s) => s.name === name)) % palette.length];

  // Nhãn mép phải: mobile chỉ SỐ (tên xem ở chip trên); desktop tên + số.
  const labelText = (s: Series) => (isMobile ? valueStr(s.last) : `${nameByCode.get(s.name) ?? s.name} ${valueStr(s.last)}`);

  const innerW = W - PL - pr;
  const X = (i: number) => PL + (i / n) * innerW;
  const Y = (v: number) => PT + ((max - v) / (max - min)) * (H - PT - PB);

  const grid: number[] = [];
  for (let g = Math.ceil(min * 2) / 2; g <= max; g += 0.5) grid.push(g);

  const toggle = (name: string) =>
    setFocused((prev) => {
      const nx = new Set(prev);
      if (nx.has(name)) nx.delete(name);
      else nx.add(name);
      return nx;
    });

  const onMove = (e: React.MouseEvent) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vbX = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.max(0, Math.min(n, Math.round(((vbX - PL) / innerW) * n)));
    setHover({ i, x: e.clientX, y: e.clientY });
  };

  const hi = hover?.i ?? -1;
  const tipRows =
    hi >= 0 ? focusedList.map((s) => ({ name: s.name, c: colorOf(s.name), v: s.vals[hi] })).sort((a, b) => (b.v ?? -99) - (a.v ?? -99)) : [];

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
        {series
          .filter((s) => activeSectors.has(s.name))
          .sort((a, b) => a.rankLast - b.rankLast)
          .map((s) => {
            const on = focused.has(s.name);
            const c = on ? colorOf(s.name) : undefined;
            return (
              <Box
                key={s.name}
                component="button"
                onClick={() => toggle(s.name)}
                sx={{
                  cursor: 'pointer',
                  fontSize: getResponsiveFontSize('xs'),
                  fontWeight: fontWeight.semibold,
                  borderRadius: 999,
                  px: 1,
                  py: 0.25,
                  border: '1px solid transparent',
                  color: on ? (isDark ? '#0d1117' : '#fff') : theme.palette.text.disabled,
                  bgcolor: on ? c : alpha(theme.palette.text.primary, 0.05),
                  transition: 'background-color 120ms',
                }}
              >
                {nameByCode.get(s.name) ?? s.name}
              </Box>
            );
          })}
      </Box>

      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <filter id="strGlow" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {grid.map((g, i) => (
          <g key={i}>
            <line x1={PL} y1={Y(g)} x2={W - pr} y2={Y(g)} stroke={alpha(theme.palette.text.primary, g === 0 ? 0.16 : 0.05)} strokeDasharray={g === 0 ? undefined : '2 4'} />
            <text x={2} y={Y(g) + 3} fontSize={10} fill={theme.palette.text.disabled} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {g > 0 ? '+' : ''}
              {g.toFixed(1)}
            </text>
          </g>
        ))}

        {[0, Math.floor(n / 2), n].map((i) => (
          <text key={i} x={X(i) - 12} y={H - 6} fontSize={10} fill={theme.palette.text.disabled}>
            {String(dates[i]).slice(8, 10)}/{String(dates[i]).slice(5, 7)}
          </text>
        ))}

        {series
          .filter((s) => !focused.has(s.name))
          .map((s) => (
            <path key={s.name} d={smoothPath(s.vals.map((v, i) => [X(i), Y(v ?? min)]))} fill="none" stroke={ghost} strokeWidth={1.3} />
          ))}

        {focusedList.map((s) => {
          const c = colorOf(s.name);
          const pts = s.vals.map((v, i) => [X(i), Y(v ?? min)] as [number, number]);
          const d = smoothPath(pts);
          const [ex, ey] = pts[pts.length - 1];
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={c} strokeWidth={5} opacity={0.16} filter="url(#strGlow)" />
              <path d={d} fill="none" stroke={c} strokeWidth={1.9} />
              <circle cx={ex} cy={ey} r={3.4} fill={c} filter="url(#strGlow)" />
              <text className="str-edge-label" x={ex + LABEL_LEAD} y={ey + 4} fontSize={11} fontWeight={700} fill={c} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {labelText(s)}
              </text>
            </g>
          );
        })}

        {hi >= 0 && (
          <>
            <line x1={X(hi)} y1={PT} x2={X(hi)} y2={H - PB} stroke={alpha(theme.palette.text.primary, isDark ? 0.45 : 0.4)} strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" />
            {focusedList.map((s) =>
              s.vals[hi] == null ? null : <circle key={s.name} cx={X(hi)} cy={Y(s.vals[hi] as number)} r={3} fill={colorOf(s.name)} pointerEvents="none" />,
            )}
          </>
        )}
      </svg>

      {hover && tipRows.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            zIndex: 1500,
            pointerEvents: 'none',
            left: Math.min(hover.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 2000) - 250),
            top: hover.y + 14,
            minWidth: 170,
            maxWidth: 260,
            maxHeight: 280,
            overflowY: 'auto',
            bgcolor: isDark ? 'rgba(18,20,26,0.94)' : 'rgba(255,255,255,0.97)',
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            p: 1.25,
            boxShadow: isDark ? '0 8px 28px rgba(0,0,0,0.6)' : '0 8px 28px rgba(0,0,0,0.18)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.semibold, color: 'text.primary', mb: 0.75 }}>{fmtD(dates[hi])}</Typography>
          {tipRows.map((r) => (
            <Box key={r.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.15 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: r.c, flexShrink: 0 }} />
              <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                {nameByCode.get(r.name) ?? r.name}
              </Typography>
              <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold, color: r.c, fontVariantNumeric: 'tabular-nums' }}>{valueStr(r.v)}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
