'use client';

import { Box, Typography, useTheme } from '@mui/material';
import {
  SearchRounded,
  SummarizeRounded,
  MenuBookRounded,
  InsightsRounded,
  BookmarkBorderRounded,
  type SvgIconComponent,
} from '@mui/icons-material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import type { ToolChip as ToolChipState } from '../../../../hooks/useChatStore';

// Động từ in đậm theo tool (kiểu Claude: **Đọc** dữ liệu cổ phiếu FPT). label backend = chi tiết.
const ACTION: Record<string, string> = {
  db_find: 'Đọc',
  db_aggregate: 'Tổng hợp',
  db_stats: 'Thống kê',
  read_kb: 'Tham khảo',
  get_my_watchlist: 'Đọc',
};

// Icon theo tool (thay chấm trạng thái cũ).
const ICON: Record<string, SvgIconComponent> = {
  db_find: SearchRounded,
  db_aggregate: SummarizeRounded,
  db_stats: InsightsRounded,
  read_kb: MenuBookRounded,
  get_my_watchlist: BookmarkBorderRounded,
};

// Dòng tra cứu kiểu timeline (Claude): icon + động từ đậm + chi tiết nhỏ; các dòng liên tiếp nối bằng đường dọc.
// `connected` = còn dòng tra cứu khác PHÍA SAU → vẽ đường nối xuống dòng kế.
export default function ToolChip({ tool, connected = false }: { tool: ToolChipState; connected?: boolean }) {
  const theme = useTheme();
  const action = ACTION[tool.name] ?? 'Đọc';
  const Icon = ICON[tool.name] ?? SearchRounded;
  const failed = tool.ok === false && !tool.running;
  const iconColor = failed
    ? theme.palette.error.main
    : tool.running
      ? theme.palette.primary.main
      : theme.palette.text.secondary;

  return (
    <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'stretch' }}>
      {/* Cột icon + đường nối timeline */}
      <Box sx={{ position: 'relative', width: 22, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        <Icon sx={{ fontSize: 18, color: iconColor, mt: '2px', zIndex: 1 }} />
        {connected && (
          <Box
            sx={{
              position: 'absolute',
              top: 23,
              bottom: -2,
              left: '50%',
              width: '1.5px',
              transform: 'translateX(-50%)',
              bgcolor: 'divider',
            }}
          />
        )}
      </Box>
      {/* Nội dung: động từ đậm + chi tiết */}
      <Box sx={{ pb: connected ? 1.25 : 0.25, minWidth: 0 }}>
        <Typography component="span" sx={{ fontSize: getResponsiveFontSize('sm'), lineHeight: 1.55 }}>
          <Box component="span" sx={{ fontWeight: fontWeight.semibold, color: 'text.primary' }}>
            {action}
          </Box>
          <Box component="span" sx={{ ml: 0.75, fontSize: getResponsiveFontSize('xs'), color: 'text.secondary' }}>
            {tool.label}
          </Box>
        </Typography>
      </Box>
    </Box>
  );
}
