'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Typography, alpha, useTheme, type Theme } from '@mui/material';
import { decomposeColor, recomposeColor } from '@mui/material/styles';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

// ── Helpers dùng chung ──────────────────────────────────────────────
// Nội suy tuyến tính giữa 2 màu (RGB).
function lerpColor(a: string, b: string, t: number): string {
  const ca = decomposeColor(a).values;
  const cb = decomposeColor(b).values;
  const v = [0, 1, 2].map((i) => Math.round(ca[i] + (cb[i] - ca[i]) * t)) as [number, number, number];
  return recomposeColor({ type: 'rgb', values: v });
}
// Màu của dải gradient đỏ→trung tính→xanh tại vị trí pct (0..100).
function gradientColorAt(theme: Theme, pct: number): string {
  const p = Math.max(0, Math.min(100, pct));
  const { down, ref, up } = theme.palette.trend;
  return p <= 50 ? lerpColor(down, ref, p / 50) : lerpColor(ref, up, (p - 50) / 50);
}
export function divColor(theme: Theme, v: number | null | undefined): string {
  if (typeof v !== 'number' || isNaN(v)) return theme.palette.text.disabled;
  return v > 0 ? theme.palette.trend.up : v < 0 ? theme.palette.trend.down : theme.palette.trend.ref;
}
export function fmtDiv(v: number | null | undefined, pct = false): string {
  if (typeof v !== 'number' || isNaN(v)) return '—';
  const sign = v >= 0 ? '+' : '−';
  return pct ? `${sign}${Math.abs(v * 100).toFixed(1)}%` : `${sign}${Math.abs(v).toFixed(2)}`;
}
function has(v: number | null | undefined): v is number {
  return typeof v === 'number' && !isNaN(v);
}

const endLabel = { fontSize: '0.66rem', color: 'text.disabled' } as const;

// ── DivergingBullet: thanh phân kỳ tâm 0 + marker glow (đồng ngôn ngữ cường độ hero) ──
export function DivergingBullet({
  value,
  domain,
  leftLabel,
  rightLabel,
}: {
  value: number | null | undefined;
  domain: number;
  leftLabel: string;
  rightLabel: string;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const on = has(value);
  const v = on ? value : 0;
  const color = divColor(theme, value);
  const pos = Math.max(0, Math.min(100, ((v + domain) / (2 * domain)) * 100));
  const left = Math.min(50, pos);
  const width = Math.abs(pos - 50);
  return (
    <Box>
      <Box sx={{ position: 'relative', height: 8, borderRadius: 999, background: alpha(theme.palette.text.primary, 0.07) }}>
        <Box sx={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: '1.5px', transform: 'translateX(-50%)', bgcolor: alpha(theme.palette.text.primary, 0.22) }} />
        {on && (
          <>
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${left}%`,
                width: `${width}%`,
                borderRadius: 999,
                background: v >= 0 ? `linear-gradient(90deg, ${alpha(color, 0.25)}, ${color})` : `linear-gradient(90deg, ${color}, ${alpha(color, 0.25)})`,
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: `${pos}%`,
                width: 12,
                height: 12,
                borderRadius: '50%',
                transform: 'translate(-50%, -50%)',
                bgcolor: theme.palette.background.default,
                border: `2.5px solid ${color}`,
                boxShadow: isDark ? `0 0 10px ${alpha(color, 0.6)}` : `0 1px 3px ${alpha(color, 0.4)}`,
              }}
            />
          </>
        )}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography sx={endLabel}>{leftLabel}</Typography>
        <Typography sx={endLabel}>{rightLabel}</Typography>
      </Box>
    </Box>
  );
}

// ── Segments10: 10 đoạn tím, domain 0..1 (đồng ngôn ngữ thanh tỷ trọng hero) ──
export function Segments10({ value, leftLabel, rightLabel }: { value: number | null | undefined; leftLabel: string; rightLabel: string }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const primary = theme.palette.primary.main;
  const onSeg = has(value) ? Math.round(Math.max(0, Math.min(1, value)) * 10) : 0;
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              height: 8,
              borderRadius: '3px',
              background: i < onSeg ? `linear-gradient(90deg, ${primary}, ${theme.palette.primary.light})` : theme.palette.component.chart.gridLine,
              boxShadow: i < onSeg && isDark && (i === 0 || i === onSeg - 1) ? `0 0 8px ${alpha(primary, 0.5)}` : 'none',
            }}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography sx={endLabel}>{leftLabel}</Typography>
        <Typography sx={endLabel}>{rightLabel}</Typography>
      </Box>
    </Box>
  );
}

// ── StatBar: số nổi bật + thước mảnh có vạch mốc + marker (cho chỉ số có ngưỡng/biên kinh tế) ──
export function StatBar({
  markerPct,
  refPct,
  refPct2,
  color,
  leftLabel,
  refLabel,
  refLabel2,
  rightLabel,
  status,
  breaker = false,
}: {
  markerPct: number;
  refPct: number;
  refPct2?: number; // ngưỡng trên (vd +10%) — tô vùng xanh từ đây tới max
  color: string;
  leftLabel: string;
  refLabel: string;
  refLabel2?: string;
  rightLabel: string;
  status?: { text: string; color: string };
  breaker?: boolean;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const danger = theme.palette.trend.down;
  const up = theme.palette.trend.up;
  const pos = markerPct >= refPct;
  const fillLeft = Math.min(refPct, markerPct);
  const fillWidth = Math.abs(markerPct - refPct);
  // Thanh gradient (breaker): marker lấy màu theo vị trí trên dải; còn lại giữ màu truyền vào.
  const mColor = breaker ? gradientColorAt(theme, markerPct) : color;

  // Chip căn giữa theo marker; chạm mép thì clamp sát mép (đo bề rộng chip thật).
  const barRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const [pillX, setPillX] = useState<number | null>(null);
  useEffect(() => {
    const compute = () => {
      const bar = barRef.current;
      const pill = pillRef.current;
      if (!bar || !pill) return;
      const bw = bar.clientWidth;
      const half = pill.offsetWidth / 2;
      const center = (markerPct / 100) * bw;
      setPillX(Math.max(half, Math.min(bw - half, center)));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [markerPct, status?.text]);

  return (
    <Box>
      {status ? (
        <Box sx={{ position: 'relative', height: 22, mb: 1 }}>
          <Box
            ref={pillRef}
            sx={{
              position: 'absolute',
              top: 0,
              left: pillX != null ? `${pillX}px` : `${markerPct}%`,
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              fontSize: '0.64rem',
              fontWeight: fontWeight.bold,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              px: 1,
              py: 0.4,
              borderRadius: 999,
              color: mColor,
              bgcolor: alpha(mColor, 0.12),
              border: `1px solid ${alpha(mColor, 0.35)}`,
            }}
          >
            {status.text}
          </Box>
        </Box>
      ) : null}
      <Box ref={barRef} sx={{ position: 'relative', height: 10, borderRadius: 999, background: breaker ? 'transparent' : alpha(theme.palette.text.primary, 0.07) }}>
        {breaker ? (
          // px_ret20: vùng đỏ [đầu → −10%] + vùng xanh [+10% → max]; giữa để trống
          <>
            <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${refPct}%`, borderRadius: '999px 0 0 999px', background: `linear-gradient(90deg, ${alpha(danger, 0.4)}, ${alpha(danger, 0.12)})` }} />
            {refPct2 != null && (
              <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: `${refPct2}%`, right: 0, borderRadius: '0 999px 999px 0', background: `linear-gradient(90deg, ${alpha(up, 0.12)}, ${alpha(up, 0.4)})` }} />
            )}
          </>
        ) : (
          // corr60: fill từ mốc (tâm 0) → marker, sign-colored (như DivergingBullet)
          fillWidth > 0 && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${fillLeft}%`,
                width: `${fillWidth}%`,
                borderRadius: 999,
                background: pos ? `linear-gradient(90deg, ${alpha(color, 0.25)}, ${color})` : `linear-gradient(90deg, ${color}, ${alpha(color, 0.25)})`,
              }}
            />
          )
        )}
        <Box
          sx={{
            position: 'absolute',
            top: -4,
            bottom: -4,
            left: `${refPct}%`,
            width: '2px',
            transform: 'translateX(-50%)',
            bgcolor: breaker ? danger : alpha(theme.palette.text.primary, 0.35),
            boxShadow: breaker ? `0 0 6px ${alpha(danger, 0.7)}` : 'none',
          }}
        />
        {breaker && refPct2 != null && (
          <Box sx={{ position: 'absolute', top: -4, bottom: -4, left: `${refPct2}%`, width: '2px', transform: 'translateX(-50%)', bgcolor: up, boxShadow: `0 0 6px ${alpha(up, 0.7)}` }} />
        )}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: `${markerPct}%`,
            width: 16,
            height: 16,
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: theme.palette.background.default,
            border: `3px solid ${mColor}`,
            boxShadow: isDark ? `0 0 12px ${alpha(mColor, 0.6)}` : `0 1px 4px ${alpha(mColor, 0.4)}`,
          }}
        />
      </Box>
      <Box sx={{ position: 'relative', height: 14, mt: 0.5 }}>
        <Typography sx={{ ...endLabel, position: 'absolute', left: 0 }}>{leftLabel}</Typography>
        <Typography
          sx={{ ...endLabel, position: 'absolute', left: `${refPct}%`, transform: 'translateX(-50%)', color: breaker ? danger : 'text.disabled', fontWeight: breaker ? fontWeight.bold : 400 }}
        >
          {refLabel}
        </Typography>
        {breaker && refPct2 != null && refLabel2 && (
          <Typography sx={{ ...endLabel, position: 'absolute', left: `${refPct2}%`, transform: 'translateX(-50%)', color: up, fontWeight: fontWeight.bold }}>{refLabel2}</Typography>
        )}
        <Typography sx={{ ...endLabel, position: 'absolute', right: 0 }}>{rightLabel}</Typography>
      </Box>
    </Box>
  );
}

// ── NoteItem: 1 dòng diễn giải (chấm màu + tên + giá trị + comment nguyên văn) ──
export function NoteItem({
  color,
  label,
  value,
  valueColor,
  comment,
}: {
  color: string;
  label: string;
  value?: string;
  valueColor?: string;
  comment: string;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1.25 }}>
      <Box sx={{ width: 7, height: 7, borderRadius: '2px', mt: '7px', flexShrink: 0, bgcolor: color }} />
      <Typography component="div" sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', lineHeight: 1.6, whiteSpace: 'pre-line', textAlign: 'justify' }}>
        <Box component="span" sx={{ color: 'text.primary', fontWeight: fontWeight.semibold }}>
          {label}
        </Box>
        {value ? (
          <Box component="span" sx={{ ml: 0.75, fontWeight: fontWeight.bold, color: valueColor, fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </Box>
        ) : null}
        <Box component="span" sx={{ color: 'text.disabled', mx: 0.75 }}>
          —
        </Box>
        {comment}
      </Typography>
    </Box>
  );
}

// ── IndicatorBlock: khung 1 chỉ số (heading + value + viz + comment nguyên văn) ──
export function IndicatorBlock({
  heading,
  value,
  valueColor,
  children,
  comment,
}: {
  heading: string;
  value?: string;
  valueColor?: string;
  children: React.ReactNode;
  comment?: string;
}) {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
        <Typography sx={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary', fontWeight: fontWeight.semibold }}>
          {heading}
        </Typography>
        {value != null && (
          <Typography sx={{ fontSize: '1.15rem', fontWeight: fontWeight.extrabold, color: valueColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</Typography>
        )}
      </Box>
      <Box sx={{ mt: 1 }}>{children}</Box>
      {comment && (
        <Typography sx={{ mt: 1, fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', lineHeight: 1.55, whiteSpace: 'pre-line', textAlign: 'justify' }}>{comment}</Typography>
      )}
    </Box>
  );
}
