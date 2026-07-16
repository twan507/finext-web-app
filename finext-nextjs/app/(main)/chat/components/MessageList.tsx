'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { CheckOutlined, ContentCopyOutlined, RefreshOutlined } from '@mui/icons-material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import type { ChatMessage } from '../../../../hooks/useChatStore';
import MessageBubble from './MessageBubble';

// Khối assistant: chip tool xếp trên → bong bóng → hàng action (Sao chép, và Thử lại khi lỗi).
function AssistantBlock({ message, onRetry, errorText }: { message: ChatMessage; onRetry: () => void; errorText?: string | null }) {
  const [copied, setCopied] = useState(false);
  const canRetry = message.status === 'error' || message.status === 'interrupted';
  // Nút sao chép chỉ hiện khi câu trả lời đã XONG hẳn (còn đang suy nghĩ/tra cứu/nhả chữ thì ẩn — tránh đè dòng tra cứu + copy nội dung dở).
  const showCopy = message.status === 'done' && message.content.trim().length > 0;

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
      {/* Dòng tra cứu nay nằm INLINE theo thứ tự thời gian trong MessageBubble (parts), không gom lên đầu. */}
      <MessageBubble message={message} />
      {(showCopy || canRetry) && (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5, mb: 2 }}>
          {showCopy && (
            <Tooltip title={copied ? 'Đã sao chép' : 'Sao chép'} placement="top">
              <IconButton size="small" onClick={copy} sx={{ color: 'text.secondary' }}>
                {copied ? <CheckOutlined sx={{ fontSize: 16 }} /> : <ContentCopyOutlined sx={{ fontSize: 16 }} />}
              </IconButton>
            </Tooltip>
          )}
          {canRetry && (
            <>
              {errorText && (
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'error.main', mr: 0.5 }}>{errorText}</Typography>
              )}
              <Button
                size="small"
                startIcon={<RefreshOutlined sx={{ fontSize: 16 }} />}
                onClick={onRetry}
                sx={{ color: 'text.secondary', fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.medium, textTransform: 'none' }}
              >
                Thử lại
              </Button>
            </>
          )}
        </Stack>
      )}
    </Box>
  );
}

export default function MessageList({ messages, onRetry, error }: { messages: ChatMessage[]; onRetry: () => void; error: string | null }) {
  const pinnedRef = useRef(true);
  const lastIdx = messages.length - 1;

  // Cuộn theo TRÌNH DUYỆT (window), không phải vùng nội bộ riêng. Bám đáy khi user đang ở gần cuối trang.
  useEffect(() => {
    const onScroll = () => {
      pinnedRef.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (pinnedRef.current) window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [messages]);

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', width: '100%', px: { xs: 2, md: 3 }, py: 3 }}>
        {messages.map((m, idx) => {
          if (m.role === 'user') return <MessageBubble key={m.id} message={m} />;
          // Chỉ assistant lỗi/gián đoạn cuối cùng mới hiện dòng lý do cạnh nút "Thử lại".
          const showErr = idx === lastIdx && (m.status === 'error' || m.status === 'interrupted');
          const errorText = showErr ? (error ?? 'Không lấy được phản hồi. Bạn thử lại nhé.') : null;
          return <AssistantBlock key={m.id} message={m} onRetry={onRetry} errorText={errorText} />;
        })}
    </Box>
  );
}
