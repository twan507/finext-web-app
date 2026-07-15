'use client';

import { Box, Skeleton, Stack } from '@mui/material';
import { borderRadius } from 'theme/tokens';

// Skeleton bám cấu trúc khung chat (KHÔNG spinner): vài bong bóng + ô nhập dưới đáy.
function UserRow() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
      <Skeleton variant="rounded" width="55%" height={44} sx={{ borderRadius: `${borderRadius.lg}px` }} />
    </Box>
  );
}

function AssistantRow() {
  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <Skeleton variant="rounded" width={120} height={26} sx={{ borderRadius: `${borderRadius.pill}px` }} />
        <Skeleton variant="rounded" width={90} height={26} sx={{ borderRadius: `${borderRadius.pill}px` }} />
      </Stack>
      <Skeleton variant="text" width="92%" />
      <Skeleton variant="text" width="98%" />
      <Skeleton variant="text" width="70%" />
      <Skeleton variant="rounded" width="100%" height={140} sx={{ mt: 1.5, borderRadius: `${borderRadius.md}px` }} />
    </Box>
  );
}

export default function ChatSkeleton() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 140px)', minHeight: 0 }}>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', px: { xs: 0.5, md: 1 }, py: 1 }}>
        <UserRow />
        <AssistantRow />
        <UserRow />
        <AssistantRow />
      </Box>
      <Skeleton variant="rounded" width="100%" height={56} sx={{ borderRadius: `${borderRadius.lg}px` }} />
    </Box>
  );
}
