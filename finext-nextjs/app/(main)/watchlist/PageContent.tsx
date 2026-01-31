'use client';

import { Box, Typography } from '@mui/material';
import { fontWeight } from 'theme/tokens';

export default function WatchlistContent() {
  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: fontWeight.bold }}>
        Danh sách theo dõi
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Quản lý và theo dõi các cổ phiếu yêu thích của bạn.
      </Typography>
    </Box>
  );
}


