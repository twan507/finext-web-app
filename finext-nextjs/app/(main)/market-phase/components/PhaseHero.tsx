'use client';

import { Box, Typography, alpha, useTheme } from '@mui/material';
import {
  getGlassCard,
  getGlassEdgeLight,
  getResponsiveFontSize,
  fontWeight,
  borderRadius,
} from 'theme/tokens';
import type { PhaseDaily, PhaseLabel } from '../types';
import { getPhaseMeta } from '../phaseMeta';

interface PhaseHeroProps {
  daily: PhaseDaily;
  streak: number;
  prevPhaseEn?: string | null;
  history?: PhaseLabel[];
}

function intensityZone(v: number): string {
  if (v >= 0.5) return 'Rất tích cực';
  if (v >= 0.15) return 'Tích cực';
  if (v > -0.15) return 'Trung tính';
  if (v > -0.5) return 'Hơi thận trọng';
  return 'Thận trọng';
}

export default function PhaseHero({ daily, streak, prevPhaseEn, history = [] }: PhaseHeroProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const meta = getPhaseMeta(daily.phase_label);
  const phaseColor = meta.color(theme);
  const primary = theme.palette.primary.main;

  const pct = Math.round(Math.min(daily.market_exposure ?? 0, 1) * 100);
  const onSeg = Math.round(pct / 10);
  const intensity = daily.market_intensity ?? 0;
  const markerPct = Math.max(0, Math.min(100, ((intensity + 1) / 2) * 100));
  const intensityColor =
    intensity > 0.02 ? theme.palette.trend.up : intensity < -0.02 ? theme.palette.trend.down : theme.palette.trend.ref;

  const cellSx = {
    position: 'relative',
    zIndex: 1,
    p: { xs: 2.5, md: 3 },
    display: 'flex',
    flexDirection: 'column',
    gap: 1.25,
    justifyContent: 'center',
    minWidth: 0,
  } as const;
  const eyebrow = {
    fontSize: getResponsiveFontSize('xs'),
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: 'text.secondary',
    fontWeight: fontWeight.semibold,
  };
  const divider = `1px solid ${theme.palette.divider}`;

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: `${borderRadius.lg}px`,
        ...getGlassCard(isDark),
        // Top edge: ánh sáng theo màu pha (ambient signal) thay cho highlight trắng
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: `linear-gradient(90deg, transparent, ${alpha(phaseColor, isDark ? 0.7 : 0.55)}, transparent)`,
          boxShadow: `0 0 12px ${alpha(phaseColor, isDark ? 0.5 : 0.28)}`,
          pointerEvents: 'none',
          zIndex: 2,
        },
        '&::after': getGlassEdgeLight(isDark),
      }}
    >
      {/* Lớp ambient glow: tint cả card theo màu pha (góc trên-trái) + primary (góc dưới-phải) */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 620px 340px at 12% -10%, ${alpha(phaseColor, isDark ? 0.16 : 0.1)}, transparent 60%), radial-gradient(ellipse 520px 320px at 90% 115%, ${alpha(primary, isDark ? 0.1 : 0.06)}, transparent 60%)`,
        }}
      />

      <Box sx={{ position: 'relative', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.15fr 1fr 1.2fr' } }}>
        {/* ── Trạng thái thị trường ── */}
        <Box sx={{ ...cellSx, borderBottom: { xs: divider, md: 'none' }, borderRight: { md: divider } }}>
          <Typography sx={eyebrow}>Trạng thái thị trường</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                flexShrink: 0,
                borderRadius: `${borderRadius.md}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                color: phaseColor,
                background: `linear-gradient(145deg, ${alpha(phaseColor, 0.22)}, ${alpha(phaseColor, 0.05)})`,
                border: `1px solid ${alpha(phaseColor, 0.4)}`,
                boxShadow: isDark
                  ? `0 0 24px ${alpha(phaseColor, 0.25)}, inset 0 1px 0 ${alpha('#ffffff', 0.12)}`
                  : `0 2px 12px ${alpha(phaseColor, 0.18)}`,
              }}
            >
              {meta.glyph}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: '1.6rem',
                  fontWeight: fontWeight.extrabold,
                  color: phaseColor,
                  lineHeight: 1,
                  letterSpacing: '0.03em',
                  textShadow: isDark ? `0 0 22px ${alpha(phaseColor, 0.45)}` : 'none',
                }}
              >
                {meta.en}
              </Typography>
              <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary', mt: 0.5 }}>{meta.vn}</Typography>
            </Box>
          </Box>

          {/* Dải lịch sử pha 10 phiên gần nhất (cũ → mới) */}
          {history.length > 0 ? (
            <Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {history.map((h, i) => {
                  const c = getPhaseMeta(h).color(theme);
                  const isLast = i === history.length - 1;
                  return (
                    <Box
                      key={i}
                      sx={{
                        width: 14,
                        height: 20,
                        borderRadius: '4px',
                        bgcolor: alpha(c, isLast ? 0.95 : 0.7),
                        boxShadow: isLast && isDark ? `0 0 10px ${alpha(c, 0.8)}` : 'none',
                      }}
                    />
                  );
                })}
              </Box>
              <Typography sx={{ fontSize: '0.66rem', color: 'text.disabled', mt: 0.5 }}>10 phiên gần nhất</Typography>
            </Box>
          ) : null}

          <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary' }}>
            Giữ nguyên pha{' '}
            <Box component="span" sx={{ color: 'text.primary', fontWeight: fontWeight.semibold }}>
              {streak} phiên
            </Box>
            {prevPhaseEn ? (
              <>
                {' · đổi từ '}
                <Box component="span" sx={{ color: 'text.primary', fontWeight: fontWeight.semibold }}>
                  {prevPhaseEn}
                </Box>
              </>
            ) : null}
          </Typography>
        </Box>

        {/* ── Tỷ trọng nắm giữ gợi ý ── */}
        <Box sx={{ ...cellSx, borderBottom: { xs: divider, md: 'none' }, borderRight: { md: divider } }}>
          <Typography sx={eyebrow}>Tỷ trọng nắm giữ gợi ý</Typography>
          <Typography
            sx={{
              fontSize: '3.2rem',
              fontWeight: fontWeight.extrabold,
              lineHeight: 0.95,
              fontVariantNumeric: 'tabular-nums',
              background: `linear-gradient(180deg, ${theme.palette.text.primary}, ${primary})`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {pct}
            <Box component="span" sx={{ fontSize: '1.2rem', fontWeight: fontWeight.bold, color: 'text.secondary' }}>
              %
            </Box>
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <Box
                key={i}
                sx={{
                  flex: 1,
                  height: 9,
                  borderRadius: '3px',
                  background:
                    i < onSeg
                      ? `linear-gradient(90deg, ${primary}, ${theme.palette.primary.light})`
                      : theme.palette.component.chart.gridLine,
                  boxShadow: i < onSeg && isDark ? `0 0 10px ${alpha(primary, 0.55)}` : 'none',
                }}
              />
            ))}
          </Box>
          <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary' }}>
            Còn lại{' '}
            <Box component="span" sx={{ color: 'text.primary', fontWeight: fontWeight.semibold }}>
              {100 - pct}%
            </Box>{' '}
            tiền mặt
          </Typography>
        </Box>

        {/* ── Cường độ thị trường (bullet phân kỳ) ── */}
        <Box sx={cellSx}>
          <Typography sx={eyebrow}>Cường độ thị trường</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
            <Typography
              sx={{
                fontSize: '2rem',
                fontWeight: fontWeight.extrabold,
                color: intensityColor,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                textShadow: isDark ? `0 0 18px ${alpha(intensityColor, 0.4)}` : 'none',
              }}
            >
              {intensity >= 0 ? '+' : '−'}
              {Math.abs(intensity).toFixed(2)}
            </Typography>
            <Box
              component="span"
              sx={{
                fontSize: '0.7rem',
                fontWeight: fontWeight.semibold,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                px: 1,
                py: 0.4,
                borderRadius: 999,
                color: intensityColor,
                bgcolor: alpha(intensityColor, 0.12),
                border: `1px solid ${alpha(intensityColor, 0.35)}`,
              }}
            >
              {intensityZone(intensity)}
            </Box>
          </Box>
          <Box
            sx={{
              position: 'relative',
              height: 12,
              borderRadius: 999,
              mt: 0.75,
              background: `linear-gradient(90deg, ${theme.palette.trend.down}, ${alpha(theme.palette.trend.ref, 0.5)} 50%, ${theme.palette.trend.up})`,
            }}
          >
            <Box sx={{ position: 'absolute', top: -4, bottom: -4, left: '50%', width: 2, transform: 'translateX(-50%)', bgcolor: 'text.disabled' }} />
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
                border: `3px solid ${intensityColor}`,
                boxShadow: isDark ? `0 0 14px ${alpha(intensityColor, 0.7)}` : `0 1px 4px ${alpha(intensityColor, 0.4)}`,
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: 'text.disabled' }}>
            <span>−1 · Giảm mạnh</span>
            <span>+1 · Tăng mạnh</span>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
