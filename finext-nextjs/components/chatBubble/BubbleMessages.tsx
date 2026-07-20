'use client';

import { Box, Chip, Typography, alpha } from '@mui/material';
import { getResponsiveFontSize } from 'theme/tokens';
import type { ChatMessage } from 'hooks/useChatStore';
import MessageList from 'app/(main)/chat/components/MessageList';

interface BubbleMessagesProps {
  messages: ChatMessage[];
  /** Câu chào ở trạng thái trống — cha bốc ngẫu nhiên và chốt sẵn, ở đây chỉ hiển thị. */
  greeting: string;
  /** Câu hỏi gợi ý theo trang đang xem — chỉ hiện khi chưa có tin nhắn nào. */
  suggestions: string[];
  onPickSuggestion: (q: string) => void;
  onRetry: () => void;
  onFeedback: (serverId: string, rating: 1 | -1) => void;
  error: string | null;
}

/**
 * Thân cửa sổ bubble. Là phần tử con CHẶN CHIỀU CAO của cột panel:
 * cả hai nhánh đều tự đặt `flex: 1; minHeight: 0` (nhánh có tin nhắn nhờ MessageList
 * ở chế độ `container`), nên panel cha bắt buộc là flex column có chiều cao bị chặn.
 */
export default function BubbleMessages({ messages, greeting, suggestions, onPickSuggestion, onRetry, onFeedback, error }: BubbleMessagesProps) {
  if (messages.length > 0) {
    return <MessageList messages={messages} onRetry={onRetry} onFeedback={onFeedback} error={error} scrollMode="container" />;
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 1.25, px: 2, py: 2 }}>
      <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary', lineHeight: 1.6 }}>{greeting}</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.75 }}>
        {suggestions.map((q) => (
          <Chip
            key={q}
            label={q}
            clickable
            onClick={() => onPickSuggestion(q)}
            sx={(t) => ({
              height: 'auto',
              maxWidth: '100%',
              py: 0.75,
              borderRadius: 2,
              border: `1px solid ${t.palette.divider}`,
              bgcolor: 'transparent',
              color: 'text.primary',
              fontSize: getResponsiveFontSize('sm'),
              '& .MuiChip-label': { px: 1.25, whiteSpace: 'normal', textAlign: 'left', lineHeight: 1.5 },
              '&:hover': { borderColor: alpha(t.palette.primary.main, 0.5), bgcolor: alpha(t.palette.primary.main, 0.06) },
            })}
          />
        ))}
      </Box>
    </Box>
  );
}
