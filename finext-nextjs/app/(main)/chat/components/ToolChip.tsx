'use client';

import { Box, Typography, useTheme } from '@mui/material';
import { getResponsiveFontSize } from 'theme/tokens';
import type { ToolChip as ToolChipState } from '../../../../hooks/useChatStore';

// Dòng tra cứu: 1 CHẤM trạng thái + chữ thường (KHÔNG phải chip — không nền/viền).
// Đang chạy: chấm xanh nhấp nháy · xong: chấm xanh · lỗi: chấm đỏ.
export default function ToolChip({ tool }: { tool: ToolChipState }) {
  const theme = useTheme();
  const dotColor = tool.ok === false && !tool.running ? theme.palette.error.main : theme.palette.success.main;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.25,
        '@keyframes chatDotPulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 } }
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          flexShrink: 0,
          bgcolor: dotColor,
          animation: tool.running ? 'chatDotPulse 1.1s ease-in-out infinite' : 'none'
        }}
      />
      <Typography component="span" sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary' }}>
        {tool.label}
      </Typography>
    </Box>
  );
}
