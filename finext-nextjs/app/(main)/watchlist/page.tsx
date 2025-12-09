'use client';

import { Box, Typography, Container } from '@mui/material';

export default function WatchlistPage() {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
          Danh sách theo dõi
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Quản lý và theo dõi các cổ phiếu yêu thích của bạn.
        </Typography>
      </Box>
    </Container>
  );
}
