'use client';

import { Box, Typography, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';
import type { ToolChip as ToolChipState } from '../../../../hooks/useChatStore';

// Tag tra cứu: nền trung tính + CHẤM trạng thái + chữ (KHÔNG tô màu cả chip).
// Chấm: đang chạy = xanh chủ đạo nhấp nháy · xong = xanh lá · lỗi = đỏ. Xếp dọc ở MessageList.
export default function ToolChip({ tool }: { tool: ToolChipState }) {
  const theme = useTheme();
  const dotColor = tool.running
    ? theme.palette.primary.main
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
        bgcolor: alpha(theme.palette.text.primary, 0.04),
        border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
        '@keyframes chatDotPulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.25 } }
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          flexShrink: 0,
          bgcolor: dotColor,
          animation: tool.running ? 'chatDotPulse 1s ease-in-out infinite' : 'none'
        }}
      />
      <Typography
        component="span"
        sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', fontWeight: fontWeight.medium }}
      >
        {tool.label}
      </Typography>
    </Box>
  );
}
