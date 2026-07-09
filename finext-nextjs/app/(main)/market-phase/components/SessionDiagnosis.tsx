'use client';

import { Box, Typography, alpha, useTheme } from '@mui/material';
import { getGlassCard, getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import type { PhaseComment } from '../types';
import { formatVnTime } from '../timeUtils';

interface SessionDiagnosisProps {
  comment: PhaseComment;
}

/** Card chẩn đoán phiên — render market_cmt nguyên văn + pill "Phân tích tự động" + giờ cập nhật. */
export default function SessionDiagnosis({ comment }: SessionDiagnosisProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const time = formatVnTime(comment.generated_at);

  return (
    <Box
      sx={{
        borderRadius: `${borderRadius.lg}px`,
        ...getGlassCard(isDark),
        borderLeft: `3px solid ${theme.palette.primary.main}`,
        p: { xs: 2, md: 2.5 },
      }}
    >
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
        {time && (
          <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.disabled' }}>
            Cập nhật lúc {time}
          </Typography>
        )}
      </Box>
      <Typography
        sx={{
          fontSize: getResponsiveFontSize('md'),
          lineHeight: 1.6,
          color: 'text.secondary',
          whiteSpace: 'pre-line',
        }}
      >
        {comment.market_cmt}
      </Typography>
    </Box>
  );
}
