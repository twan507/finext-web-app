'use client';

import { Box, Stack, Typography, alpha, useTheme } from '@mui/material';
import { getGlassCard, getGlassEdgeLight, getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';

interface BasketAiHeroProps {
  text?: string | null;
  generatedAt?: string;
  /** Màu nhận diện danh mục (accent glow). */
  accent: string;
}

function formatTime(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Hero "AI Briefing" cho tab danh mục (layout B): thẻ FINEXT AI full-width — nhận định thuần.
 * Các chỉ số chính đã chuyển xuống header bảng Danh mục nắm giữ.
 */
export default function BasketAiHero({ text, generatedAt, accent }: BasketAiHeroProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const time = formatTime(generatedAt);
  const metaDot = <Box component="span" sx={{ color: 'text.secondary', fontWeight: fontWeight.medium, fontSize: getResponsiveFontSize('sm'), lineHeight: 1 }}>·</Box>;

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: `${borderRadius.lg}px`,
        ...getGlassCard(isDark),
        borderLeft: `3px solid ${accent}`,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: `linear-gradient(90deg, transparent, ${alpha(accent, isDark ? 0.7 : 0.55)}, transparent)`,
          boxShadow: `0 0 12px ${alpha(accent, isDark ? 0.5 : 0.28)}`,
          pointerEvents: 'none',
          zIndex: 2,
        },
        '&::after': getGlassEdgeLight(isDark),
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 560px 260px at 3% -20%, ${alpha(accent, isDark ? 0.16 : 0.1)}, transparent 62%)`,
        }}
      />

      <Box sx={{ position: 'relative', zIndex: 1, p: { xs: 2.5, md: 3 } }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.25, flexWrap: 'wrap' }}>
          <Box
            component="span"
            sx={{
              fontSize: getResponsiveFontSize('xs'),
              fontWeight: fontWeight.bold,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: accent,
              bgcolor: alpha(accent, 0.14),
              borderRadius: 999,
              px: 1.25,
              py: 0.4,
            }}
          >
            ✦ FINEXT AI
          </Box>
          {metaDot}
          <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary', fontWeight: fontWeight.medium }}>Nhận định danh mục</Typography>
          {time && (
            <>
              {metaDot}
              <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.disabled' }}>Cập nhật lúc {time}</Typography>
            </>
          )}
        </Stack>

        <Typography sx={{ fontSize: getResponsiveFontSize('md'), lineHeight: 1.65, color: 'text.secondary', whiteSpace: 'pre-line', textAlign: 'justify' }}>
          {text || 'Đang cập nhật nhận định cho phiên gần nhất.'}
        </Typography>
      </Box>
    </Box>
  );
}
