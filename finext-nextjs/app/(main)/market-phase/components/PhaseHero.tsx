'use client';

import { Box, Typography, alpha, useTheme } from '@mui/material';
import {
  getGlassCard,
  getGlassHighlight,
  getGlassEdgeLight,
  getResponsiveFontSize,
  fontWeight,
  borderRadius,
} from 'theme/tokens';
import type { PhaseDaily } from '../types';
import { getPhaseMeta } from '../phaseMeta';

interface PhaseHeroProps {
  daily: PhaseDaily;
  streak: number;
  prevPhaseVn?: string | null;
}

function intensityZone(v: number): string {
  if (v >= 0.5) return 'Rất tích cực';
  if (v >= 0.15) return 'Tích cực';
  if (v > -0.15) return 'Trung tính';
  if (v > -0.5) return 'Hơi thận trọng';
  return 'Thận trọng';
}

export default function PhaseHero({ daily, streak, prevPhaseVn }: PhaseHeroProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const meta = getPhaseMeta(daily.phase_label);
  const phaseColor = meta.color(theme);

  const pct = Math.round(Math.min(daily.market_exposure ?? 0, 1) * 100);
  const intensity = daily.market_intensity ?? 0;
  const markerPct = Math.max(0, Math.min(100, ((intensity + 1) / 2) * 100));
  const intensityColor =
    intensity > 0.02 ? theme.palette.trend.up : intensity < -0.02 ? theme.palette.trend.down : theme.palette.trend.ref;

  const cellSx = {
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
        '&::before': getGlassHighlight(isDark),
        '&::after': getGlassEdgeLight(isDark),
      }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr 1.25fr' } }}>
        {/* Chip phase */}
        <Box sx={{ ...cellSx, borderBottom: { xs: divider, md: 'none' }, borderRight: { md: divider } }}>
          <Typography sx={eyebrow}>Trạng thái thị trường</Typography>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1.25,
              px: 1.5,
              py: 1,
              borderRadius: `${borderRadius.md}px`,
              width: 'fit-content',
              bgcolor: alpha(phaseColor, 0.12),
              border: `1px solid ${alpha(phaseColor, 0.42)}`,
            }}
          >
            <Box component="span" sx={{ fontSize: '1.4rem', lineHeight: 1, color: phaseColor }}>
              {meta.glyph}
            </Box>
            <Box>
              <Typography sx={{ fontSize: '1.35rem', fontWeight: fontWeight.bold, color: phaseColor, lineHeight: 1.05, letterSpacing: '0.02em' }}>
                {meta.en}
              </Typography>
              <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary' }}>{meta.vn}</Typography>
            </Box>
          </Box>
          <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary' }}>
            Giữ nguyên pha{' '}
            <Box component="span" sx={{ color: 'text.primary', fontWeight: fontWeight.semibold }}>
              {streak} phiên
            </Box>
            {prevPhaseVn ? (
              <>
                {' · gần nhất đổi từ '}
                <Box component="span" sx={{ color: 'text.primary', fontWeight: fontWeight.semibold }}>
                  {prevPhaseVn}
                </Box>
              </>
            ) : null}
          </Typography>
        </Box>

        {/* KPI % nắm giữ */}
        <Box sx={{ ...cellSx, borderBottom: { xs: divider, md: 'none' }, borderRight: { md: divider } }}>
          <Typography sx={eyebrow}>Tỷ trọng nắm giữ gợi ý</Typography>
          <Typography sx={{ fontSize: '3rem', fontWeight: fontWeight.extrabold, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {pct}
            <Box component="span" sx={{ fontSize: '1.2rem', fontWeight: fontWeight.bold, color: 'text.secondary' }}>
              %
            </Box>
          </Typography>
          <Box sx={{ height: 8, borderRadius: 999, bgcolor: theme.palette.component.chart.gridLine, overflow: 'hidden' }}>
            <Box
              sx={{
                height: '100%',
                width: `${pct}%`,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
              }}
            />
          </Box>
          <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary' }}>
            Còn lại{' '}
            <Box component="span" sx={{ color: 'text.primary', fontWeight: fontWeight.semibold }}>
              {100 - pct}%
            </Box>{' '}
            tiền mặt
          </Typography>
        </Box>

        {/* Cường độ (bullet phân kỳ) */}
        <Box sx={cellSx}>
          <Typography sx={eyebrow}>Cường độ thị trường</Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography sx={{ fontSize: '1.7rem', fontWeight: fontWeight.bold, color: intensityColor, fontVariantNumeric: 'tabular-nums' }}>
              {intensity >= 0 ? '+' : '−'}
              {Math.abs(intensity).toFixed(2)}
            </Typography>
            <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary', fontWeight: fontWeight.semibold }}>
              {intensityZone(intensity)}
            </Typography>
          </Box>
          <Box
            sx={{
              position: 'relative',
              height: 12,
              borderRadius: 999,
              mt: 0.5,
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
                border: `3px solid ${theme.palette.text.primary}`,
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
