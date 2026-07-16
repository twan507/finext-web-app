'use client';

import { Box, Typography, alpha, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import type { ToolChip as ToolChipState } from '../../../../hooks/useChatStore';

// Động từ in đậm theo tool (kiểu Claude Code: **Đọc** dữ liệu cổ phiếu FPT). label backend = chi tiết.
const ACTION: Record<string, string> = {
  db_find: 'Đọc',
  db_aggregate: 'Tổng hợp',
  read_kb: 'Tham khảo',
  get_my_watchlist: 'Đọc'
};

// Dòng tra cứu: chấm trạng thái + ĐỘNG TỪ đậm + chi tiết nhỏ hơn (không '…'). Chạy: chấm pulse + quầng sáng.
export default function ToolChip({ tool }: { tool: ToolChipState }) {
  const theme = useTheme();
  const running = tool.running;
  const dotColor = tool.ok === false && !running ? theme.palette.error.main : theme.palette.success.main;
  const action = ACTION[tool.name] ?? 'Đọc';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 1.5, // giãn chấm ↔ chữ
        py: 0.35,
        '@keyframes chatDotPulse': { '0%, 100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0.35, transform: 'scale(0.82)' } }
      }}
    >
      <Box
        sx={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          flexShrink: 0,
          alignSelf: 'center',
          bgcolor: dotColor,
          boxShadow: running ? `0 0 0 4px ${alpha(dotColor, 0.16)}` : 'none',
          animation: running ? 'chatDotPulse 1.1s ease-in-out infinite' : 'none'
        }}
      />
      <Typography component="span" sx={{ fontSize: getResponsiveFontSize('sm'), lineHeight: 1.5 }}>
        <Box component="span" sx={{ fontWeight: fontWeight.semibold, color: 'text.primary' }}>{action}</Box>
        <Box component="span" sx={{ ml: 0.75, fontSize: getResponsiveFontSize('xs'), color: 'text.secondary' }}>{tool.label}</Box>
      </Typography>
    </Box>
  );
}
