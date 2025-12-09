'use client';

import { Box, Typography, Container } from '@mui/material';

export default function MarketsPage() {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
          Thị trường
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Cung cấp cái nhìn toàn cảnh về sức khỏe thị trường, nhận diện xu hướng vĩ mô và đánh giá rủi ro trong từng giai đoạn chu kỳ.
        </Typography>
      </Box>
    </Container>
  );
}
