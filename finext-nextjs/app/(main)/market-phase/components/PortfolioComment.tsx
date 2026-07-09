'use client';

import { Box, Typography, alpha, useTheme } from '@mui/material';
import { getGlassCard, getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';

interface PortfolioCommentProps {
  text?: string | null;
  generatedAt?: string;
}

function formatTime(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Diễn giải danh mục / ngành — render verbatim (dùng cho stock_cmt và sector_cmt). */
export default function PortfolioComment({ text, generatedAt }: PortfolioCommentProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  if (!text) return null;
  const time = formatTime(generatedAt);

  return (
    <Box sx={{ borderRadius: `${borderRadius.lg}px`, ...getGlassCard(isDark), borderLeft: `3px solid ${theme.palette.primary.main}`, p: { xs: 2, md: 2.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
        <Box
          component="span"
          sx={{
            fontSize: getResponsiveFontSize('xs'),
            fontWeight: fontWeight.bold,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            borderRadius: 999,
            px: 1,
            py: 0.25,
          }}
        >
          ✦ Phân tích tự động
        </Box>
        {time && <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.disabled' }}>Cập nhật lúc {time}</Typography>}
      </Box>
      <Typography sx={{ fontSize: getResponsiveFontSize('md'), lineHeight: 1.6, color: 'text.secondary', whiteSpace: 'pre-line' }}>{text}</Typography>
    </Box>
  );
}
