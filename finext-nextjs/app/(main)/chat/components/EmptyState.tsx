'use client';

import { Box, Typography } from '@mui/material';
import { AutoAwesomeRounded } from '@mui/icons-material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

// Lời chào khi mới vào /chat (chưa có tin nhắn): logo Finext AI cùng dòng với câu chào, gọi tên người dùng.
export default function ChatGreeting({ name }: { name?: string }) {
  const who = name?.trim() ? `, ${name.trim()}` : '';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.25, px: 2, textAlign: 'center', flexWrap: 'wrap' }}>
      <AutoAwesomeRounded sx={{ fontSize: 32, color: 'primary.main' }} />
      <Typography sx={{ fontSize: getResponsiveFontSize('xxl'), fontWeight: fontWeight.bold, lineHeight: 1.2 }}>
        Tôi có thể giúp gì cho bạn{who}
      </Typography>
    </Box>
  );
}
