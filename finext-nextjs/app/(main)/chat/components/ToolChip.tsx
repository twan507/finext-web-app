'use client';

import { Box, CircularProgress, Typography, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight, borderRadius, transitions } from 'theme/tokens';
import type { ToolChip as ToolChipState } from '../../../../hooks/useChatStore';

// Chip công cụ: đang chạy → spinner nhỏ + nhãn; xong → ✓/✗ + "· {ms}ms".
// Mirror style chip glass ở /market-phase (bo tròn pill, nền alpha theo trạng thái).
export default function ToolChip({ tool }: { tool: ToolChipState }) {
  const theme = useTheme();
  const done = !tool.running;
  const accent = !done
    ? theme.palette.text.secondary
    : tool.ok
      ? theme.palette.success.main
      : theme.palette.error.main;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        py: 0.5,
        borderRadius: `${borderRadius.pill}px`,
        bgcolor: alpha(accent, 0.1),
        border: `1px solid ${alpha(accent, 0.25)}`,
        transition: transitions.colors
      }}
    >
      {tool.running ? (
        <CircularProgress size={12} thickness={5} sx={{ color: 'text.secondary' }} />
      ) : (
        <Typography component="span" sx={{ fontSize: '0.8rem', lineHeight: 1, color: accent, fontWeight: fontWeight.bold }}>
          {tool.ok ? '✓' : '✗'}
        </Typography>
      )}
      <Typography component="span" sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', fontWeight: fontWeight.medium }}>
        {tool.label}
        {done && tool.ms != null ? ` · ${tool.ms}ms` : ''}
      </Typography>
    </Box>
  );
}
