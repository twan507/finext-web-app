'use client';

import { Box, alpha, useTheme, type SxProps, type Theme } from '@mui/material';
import { getGlassCard, getGlassEdgeLight, borderRadius } from 'theme/tokens';

interface AmbientCardProps {
  /** Màu glow (top accent + ambient radial). Thường là màu pha / trend / primary. */
  glowColor: string;
  /** Vị trí toả sáng của lớp ambient. */
  glowAnchor?: 'top-left' | 'bottom-right';
  /** Vạch sáng theo màu glow ở mép trên. Mặc định bật. */
  topAccent?: boolean;
  /** Override cho vùng nội dung (padding/layout). */
  sx?: SxProps<Theme>;
  children: React.ReactNode;
}

/**
 * Card kính dùng chung cho page Giai đoạn thị trường: nền glass + ambient glow theo màu (glowColor)
 * + vạch sáng mép trên. Theme-aware (glow dịu ở light). Cùng ngôn ngữ với PhaseHero.
 */
export default function AmbientCard({ glowColor, glowAnchor = 'top-left', topAccent = true, sx, children }: AmbientCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const radial =
    glowAnchor === 'top-left'
      ? `radial-gradient(ellipse 600px 320px at 10% -12%, ${alpha(glowColor, isDark ? 0.14 : 0.09)}, transparent 60%)`
      : `radial-gradient(ellipse 620px 320px at 92% 118%, ${alpha(glowColor, isDark ? 0.12 : 0.07)}, transparent 60%)`;

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: `${borderRadius.lg}px`,
        ...getGlassCard(isDark),
        ...(topAccent
          ? {
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '1px',
                background: `linear-gradient(90deg, transparent, ${alpha(glowColor, isDark ? 0.7 : 0.55)}, transparent)`,
                boxShadow: `0 0 12px ${alpha(glowColor, isDark ? 0.5 : 0.28)}`,
                pointerEvents: 'none',
                zIndex: 2,
              },
            }
          : {}),
        '&::after': getGlassEdgeLight(isDark),
      }}
    >
      <Box aria-hidden sx={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', background: radial }} />
      <Box sx={{ position: 'relative', zIndex: 1, p: { xs: 2, md: 2.5 }, ...sx }}>{children}</Box>
    </Box>
  );
}
