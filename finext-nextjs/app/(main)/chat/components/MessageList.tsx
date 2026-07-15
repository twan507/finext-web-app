'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Button, IconButton, Stack, Tooltip } from '@mui/material';
import { CheckOutlined, ContentCopyOutlined, RefreshOutlined } from '@mui/icons-material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import type { ChatMessage } from '../../../../hooks/useChatStore';
import MessageBubble from './MessageBubble';
import ToolChip from './ToolChip';

// Khối assistant: chip tool xếp trên → bong bóng → hàng action (Sao chép, và Thử lại khi lỗi).
function AssistantBlock({ message, onRetry }: { message: ChatMessage; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);
  const canRetry = message.status === 'error' || message.status === 'interrupted';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard bị chặn (thiếu quyền / không phải secure context) — bỏ qua im lặng.
    }
  };

  return (
    <Box>
      {message.tools.length > 0 && (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 1 }}>
          {message.tools.map((t, i) => (
            <ToolChip key={`${t.name}-${i}`} tool={t} />
          ))}
        </Stack>
      )}
      <MessageBubble message={message} />
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: -1, mb: 2 }}>
        <Tooltip title={copied ? 'Đã sao chép' : 'Sao chép'} placement="top">
          <IconButton size="small" onClick={copy} sx={{ color: 'text.secondary' }}>
            {copied ? <CheckOutlined sx={{ fontSize: 16 }} /> : <ContentCopyOutlined sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
        {canRetry && (
          <Button
            size="small"
            startIcon={<RefreshOutlined sx={{ fontSize: 16 }} />}
            onClick={onRetry}
            sx={{ color: 'text.secondary', fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.medium, textTransform: 'none' }}
          >
            Thử lại
          </Button>
        )}
      </Stack>
    </Box>
  );
}

export default function MessageList({ messages, onRetry }: { messages: ChatMessage[]; onRetry: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    // Còn cách đáy < 80px coi như đang "bám đáy" → tiếp tục auto-scroll khi token mới về.
    // User cuộn lên xa hơn → ngừng bám, không giật màn hình khi đang đọc lại.
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <Box ref={scrollRef} onScroll={onScroll} sx={{ height: 1, overflowY: 'auto', px: { xs: 0.5, md: 1 }, py: 1 }}>
      {messages.map((m) =>
        m.role === 'user' ? <MessageBubble key={m.id} message={m} /> : <AssistantBlock key={m.id} message={m} onRetry={onRetry} />
      )}
    </Box>
  );
}
