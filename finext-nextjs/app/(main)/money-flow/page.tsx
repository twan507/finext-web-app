'use client';

import { Box, Typography, Container } from '@mui/material';

export default function MoneyFlowPage() {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
          Dòng tiền
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Trực quan hóa sự dịch chuyển của dòng vốn thông minh và thanh khoản, giúp phát hiện sớm hành động của các nhà đầu tư lớn.
        </Typography>
      </Box>
    </Container>
  );
}
