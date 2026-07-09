'use client';

import { Box, Typography, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import type { PhaseComment } from '../types';

interface SessionDiagnosisProps {
  comment: PhaseComment;
}

function formatTime(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Chẩn đoán phiên (trên nền, không card) — market_cmt nguyên văn + pill "Phân tích tự động" + giờ. */
export default function SessionDiagnosis({ comment }: SessionDiagnosisProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const primary = theme.palette.primary.main;
  const time = formatTime(comment.generated_at);

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      <Box
        sx={{
          width: 44,
          height: 44,
          flexShrink: 0,
          borderRadius: `${borderRadius.md}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem',
          color: primary,
          background: `linear-gradient(145deg, ${alpha(primary, 0.25)}, ${alpha(primary, 0.06)})`,
          border: `1px solid ${alpha(primary, 0.4)}`,
          boxShadow: isDark ? `0 0 20px ${alpha(primary, 0.25)}` : `0 2px 12px ${alpha(primary, 0.18)}`,
        }}
      >
        ✦
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
          <Box
            component="span"
            sx={{
              fontSize: getResponsiveFontSize('xs'),
              fontWeight: fontWeight.bold,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'primary.main',
              bgcolor: alpha(primary, 0.12),
              border: `1px solid ${alpha(primary, 0.3)}`,
              borderRadius: 999,
              px: 1,
              py: 0.25,
            }}
          >
            Phân tích tự động
          </Box>
          {time && <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.disabled' }}>Cập nhật lúc {time}</Typography>}
        </Box>
        <Typography sx={{ fontSize: getResponsiveFontSize('md'), lineHeight: 1.6, color: 'text.secondary', whiteSpace: 'pre-line' }}>{comment.market_cmt}</Typography>
      </Box>
    </Box>
  );
}
