'use client';

import { Box, Typography, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize } from 'theme/tokens';
import type { ToolChip as ToolChipState } from '../../../../hooks/useChatStore';

// Dòng tra cứu: 1 CHẤM trạng thái + chữ thường (KHÔNG phải chip — không nền/viền).
// Đang chạy: chấm xanh nhấp nháy + quầng sáng mềm, chữ "thở" nhẹ (cảm giác AI đang làm) · xong: chấm xanh · lỗi: chấm đỏ.
export default function ToolChip({ tool }: { tool: ToolChipState }) {
  const theme = useTheme();
  const running = tool.running;
  const dotColor = tool.ok === false && !running ? theme.palette.error.main : theme.palette.success.main;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.35,
        '@keyframes chatDotPulse': { '0%, 100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0.35, transform: 'scale(0.82)' } },
        '@keyframes chatLabelBreathe': { '0%, 100%': { opacity: 0.55 }, '50%': { opacity: 1 } }
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          flexShrink: 0,
          bgcolor: dotColor,
          boxShadow: running ? `0 0 0 4px ${alpha(dotColor, 0.16)}` : 'none',
          animation: running ? 'chatDotPulse 1.1s ease-in-out infinite' : 'none'
        }}
      />
      <Typography
        component="span"
        sx={{
          fontSize: getResponsiveFontSize('sm'),
          color: 'text.secondary',
          letterSpacing: 0.1,
          animation: running ? 'chatLabelBreathe 1.8s ease-in-out infinite' : 'none'
        }}
      >
        {tool.label}
      </Typography>
    </Box>
  );
}
