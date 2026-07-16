'use client';

import { Box, IconButton, Typography, alpha, useTheme } from '@mui/material';
import { AddCommentOutlined, ChevronLeftOutlined, ChevronRightOutlined } from '@mui/icons-material';
import { getResponsiveFontSize, fontWeight, borderRadius, transitions } from 'theme/tokens';
import type { Conversation } from '../../../../hooks/useChatStore';

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string;
  collapsed: boolean;
  onNew: () => void;
  onSelect: (id: string) => void;
  onToggle: () => void;
}

const DAY_MS = 86400000;
const BUCKETS = ['Hôm nay', 'Hôm qua', '7 ngày trước', 'Cũ hơn'] as const;
type Bucket = (typeof BUCKETS)[number];

// So mốc ngày địa phương: đầu ngày hôm nay / hôm qua / 7 ngày trước.
function bucketOf(createdAt: number): Bucket {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (createdAt >= startToday) return 'Hôm nay';
  if (createdAt >= startToday - DAY_MS) return 'Hôm qua';
  if (createdAt >= startToday - 7 * DAY_MS) return '7 ngày trước';
  return 'Cũ hơn';
}

export default function ConversationSidebar({ conversations, activeId, collapsed, onNew, onSelect, onToggle }: ConversationSidebarProps) {
  const theme = useTheme();

  if (collapsed) {
    return (
      <Box
        sx={{
          width: 52,
          flexShrink: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          py: 1.5,
          borderRight: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper'
        }}
      >
        <IconButton size="small" onClick={onToggle} aria-label="Mở panel lịch sử">
          <ChevronRightOutlined fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={onNew} aria-label="Cuộc trò chuyện mới">
          <AddCommentOutlined fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  // Giữ thứ tự conversations (newest-first từ store) trong từng bucket.
  const groups = BUCKETS.map((label) => ({ label, items: conversations.filter((c) => bucketOf(c.createdAt) === label) })).filter((g) => g.items.length > 0);

  return (
    <Box
      sx={{
        width: 272,
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: `1px solid ${theme.palette.divider}`,
        bgcolor: theme.palette.background.paper
      }}
    >
      <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          component="button"
          onClick={onNew}
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: 'pointer',
            font: 'inherit',
            px: 1.5,
            py: 1,
            borderRadius: `${borderRadius.md}px`,
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: 'transparent',
            color: 'text.primary',
            fontSize: getResponsiveFontSize('sm'),
            fontWeight: fontWeight.medium,
            transition: transitions.colors,
            '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.5), color: 'primary.main' }
          }}
        >
          <AddCommentOutlined sx={{ fontSize: 18 }} />
          Cuộc trò chuyện mới
        </Box>
        <IconButton size="small" onClick={onToggle} aria-label="Thu gọn panel">
          <ChevronLeftOutlined fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1, pb: 1 }}>
        {groups.map((g) => (
          <Box key={g.label} sx={{ mb: 1 }}>
            <Typography sx={{ px: 1, py: 0.75, fontSize: '11px', fontWeight: fontWeight.semibold, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary' }}>
              {g.label}
            </Typography>
            {g.items.map((c) => {
              const active = c.id === activeId;
              return (
                <Box
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  title={c.title}
                  sx={{
                    px: 1.25,
                    py: 0.85,
                    mb: 0.25,
                    borderRadius: `${borderRadius.sm}px`,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: getResponsiveFontSize('sm'),
                    color: active ? 'text.primary' : 'text.secondary',
                    bgcolor: active ? alpha(theme.palette.primary.main, 0.14) : 'transparent',
                    transition: transitions.colors,
                    '&:hover': { bgcolor: active ? alpha(theme.palette.primary.main, 0.14) : alpha(theme.palette.text.primary, 0.04) }
                  }}
                >
                  {c.title}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
