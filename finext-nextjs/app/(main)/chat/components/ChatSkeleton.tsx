'use client';

import { Box, Skeleton } from '@mui/material';
import { layoutTokens } from 'theme/tokens';

// Skeleton khớp UI "chưa chat" (empty state): lời chào + ô nhập nổi ở ~40% chiều cao (spacer 2:3).
// KHÔNG dựng bong bóng chat giả — trang chưa có tin nhắn thì skeleton cũng không có.
export default function ChatSkeleton() {
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: `calc(100dvh - ${layoutTokens.appBarHeight}px)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        px: 2,
      }}
    >
      <Box sx={{ flexGrow: 2 }} />
      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        {/* Lời chào: icon + dòng chữ (khớp ChatGreeting) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Skeleton variant="circular" width={30} height={30} />
          <Skeleton variant="text" width={280} height={34} />
        </Box>
        {/* Ô nhập nổi (khớp Composer centered) */}
        <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto' }}>
          <Skeleton variant="rounded" height={52} sx={{ borderRadius: '26px' }} />
        </Box>
      </Box>
      <Box sx={{ flexGrow: 3 }} />
    </Box>
  );
}
