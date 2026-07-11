'use client';

import { useMemo, useRef, useState } from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import type { PhaseIndustryRow } from '../types';

// H2 "Wave Streaks": gộp các phiên ON liên tiếp của mỗi ngành thành dải sóng liền (bo tròn),
// sóng đang chạy (chạm phiên cuối) có glow + chấm pulse. Chỉ render ngành TỪNG có sóng (giấu universe).
// Hover: crosshair dọc + tooltip liệt kê ngành đang có sóng ở phiên đó.
const SESSIONS = 60;
const LABEL_W = 180;
const UNIT_W = 16;
const ROW_H = 26;
const BAR_H = 12;

interface SectorWaveStripProps {
  industry: PhaseIndustryRow[];
  /** Ngành đang trong sóng ở phiên mới nhất → in đậm + chấm. */
  liveSectors: Set<string>;
  /** Mã ngành → tên đầy đủ (thiếu → fallback về mã). */
  nameByCode: Map<string, string>;
}

interface Bar {
  x: number;
  w: number;
  live: boolean;
}
interface Row {
  name: string;
  bars: Bar[];
}

function fmtD(s: string): string {
  const d = String(s).slice(0, 10);
  const [y, m, dd] = d.split('-');
  return dd && m && y ? `${dd}/${m}/${y}` : d;
}

export default function SectorWaveStrip({ industry, liveSectors, nameByCode }: SectorWaveStripProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const primary = theme.palette.primary.main;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  const { rows, ticks, W, H, n, dates, onBySession } = useMemo(() => {
    const recent = industry.slice(-SESSIONS);
    const n = recent.length;
    const set = new Set<string>();
    for (const r of recent) for (const k of Object.keys(r)) if (k !== 'date' && Number(r[k]) === 1) set.add(k);
    const totalOf = (name: string) => recent.reduce((s, r) => s + (Number(r[name]) === 1 ? 1 : 0), 0);
    // Sort: ngành có sóng NHIỀU nhất trong 60 phiên ở trên → ít nhất ở dưới.
    const names = Array.from(set).sort((a, b) => totalOf(b) - totalOf(a));

    const rows: Row[] = names.map((name) => {
      const arr = recent.map((r) => (Number(r[name]) === 1 ? 1 : 0));
      const bars: Bar[] = [];
      let i = 0;
      while (i < n) {
        if (arr[i] === 1) {
          let j = i;
          while (j < n && arr[j] === 1) j++;
          bars.push({ x: LABEL_W + i * UNIT_W, w: Math.max((j - i) * UNIT_W - 3, UNIT_W * 0.6), live: j === n });
          i = j;
        } else i++;
      }
      return { name, bars };
    });

    const ticks: { x: number; label: string }[] = [];
    let prev = '';
    recent.forEach((r, i) => {
      const m = String(r.date).slice(0, 7);
      if (m !== prev) {
        if (prev) ticks.push({ x: LABEL_W + i * UNIT_W, label: 'T' + Number(String(r.date).slice(5, 7)) });
        prev = m;
      }
    });

    const dates = recent.map((r) => String(r.date));
    const onBySession = recent.map((r) => names.filter((nm) => Number(r[nm]) === 1));

    return { rows, ticks, W: LABEL_W + n * UNIT_W, H: names.length * ROW_H + 22, n, dates, onBySession };
  }, [industry]);

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
    const i = Math.max(0, Math.min(n - 1, Math.floor((vbX - LABEL_W) / UNIT_W)));
    setHover({ i, x: e.clientX, y: e.clientY });
  };

  const hi = hover?.i ?? -1;
  const crossX = LABEL_W + hi * UNIT_W + UNIT_W / 2;

  return (
    <Box
      sx={{
        overflowX: 'auto',
        position: 'relative',
        '@keyframes wavePulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
        '& .wave-live-dot': { animation: 'wavePulse 1.8s ease-in-out infinite' },
      }}
    >
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 560, display: 'block' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={alpha(primary, isDark ? 0.55 : 0.5)} />
            <stop offset="1" stopColor={primary} />
          </linearGradient>
          <filter id="waveGlow" x="-40%" y="-150%" width="180%" height="400%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={t.x} y1={0} x2={t.x} y2={H - 20} stroke={alpha(theme.palette.text.primary, 0.06)} />
            <text x={t.x + 3} y={H - 6} fontSize={10} fill={theme.palette.text.disabled}>
              {t.label}
            </text>
          </g>
        ))}

        {rows.map((row, r) => {
          const cy = r * ROW_H + ROW_H / 2;
          const live = liveSectors.has(row.name);
          return (
            <g key={row.name}>
              <text x={0} y={cy + 4} fontSize={11} fontWeight={live ? 700 : 400} fill={live ? theme.palette.text.primary : theme.palette.text.secondary}>
                {(live ? '● ' : '') + (nameByCode.get(row.name) ?? row.name)}
              </text>
              <rect x={LABEL_W} y={cy - 0.5} width={W - LABEL_W} height={1} fill={alpha(theme.palette.text.primary, 0.05)} />
              {row.bars.map((b, bi) => (
                <rect
                  key={bi}
                  x={b.x}
                  y={cy - BAR_H / 2}
                  width={b.w}
                  height={BAR_H}
                  rx={BAR_H / 2}
                  fill="url(#waveGrad)"
                  opacity={b.live ? 1 : isDark ? 0.6 : 0.72}
                  filter={b.live ? 'url(#waveGlow)' : undefined}
                />
              ))}
              {row.bars
                .filter((b) => b.live)
                .map((b, bi) => (
                  <circle key={`d${bi}`} className="wave-live-dot" cx={b.x + b.w - 3} cy={cy} r={3.2} fill={isDark ? '#e9ddff' : primary} filter="url(#waveGlow)" />
                ))}
            </g>
          );
        })}

        {hi >= 0 && (
          <line x1={crossX} y1={0} x2={crossX} y2={H - 20} stroke={alpha(theme.palette.text.primary, isDark ? 0.45 : 0.4)} strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" />
        )}
      </svg>

      {hover && (
        <Box
          sx={{
            position: 'fixed',
            zIndex: 1500,
            pointerEvents: 'none',
            left: Math.min(hover.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 2000) - 250),
            top: hover.y + 14,
            minWidth: 160,
            maxWidth: 240,
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
          <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.semibold, color: 'text.primary', mb: 0.75 }}>{fmtD(dates[hover.i])}</Typography>
          {onBySession[hover.i].length > 0 ? (
            onBySession[hover.i].map((code) => (
              <Box key={code} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.15 }}>
                <Box sx={{ width: 7, height: 7, borderRadius: '2px', bgcolor: primary, flexShrink: 0 }} />
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {nameByCode.get(code) ?? code}
                </Typography>
              </Box>
            ))
          ) : (
            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.disabled' }}>Không có ngành trong sóng</Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
