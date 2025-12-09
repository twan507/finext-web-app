'use client';

import { Box, Typography, Container } from '@mui/material';

export default function SectorsPage() {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
          Nhóm ngành
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Phân tích sức mạnh tương quan và sự luân chuyển dòng tiền giữa các nhóm ngành để tìm ra sóng ngành dẫn dắt thị trường.
        </Typography>
      </Box>
    </Container>
  );
}
