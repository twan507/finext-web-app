'use client';

import { Box, Typography } from '@mui/material';
import { AutoAwesomeRounded } from '@mui/icons-material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

// Lời chào khi mới vào /chat (chưa có tin nhắn): logo Finext AI + câu chào theo giờ. KHÔNG gợi ý câu hỏi.
function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export default function ChatGreeting() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 1.25, px: 2 }}>
      <AutoAwesomeRounded sx={{ fontSize: 44, color: 'primary.main' }} />
      <Typography sx={{ fontSize: getResponsiveFontSize('xxl'), fontWeight: fontWeight.bold, lineHeight: 1.2 }}>
        {greeting()}, tôi là Finext AI
      </Typography>
      <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary', maxWidth: 460 }}>
        Hỏi gì về thị trường, cổ phiếu hay nhóm ngành cũng được — bằng ngôn ngữ tự nhiên.
      </Typography>
    </Box>
  );
}
