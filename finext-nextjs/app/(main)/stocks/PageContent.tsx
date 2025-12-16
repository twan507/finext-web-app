'use client';

import { Box, Typography } from '@mui/material';

export default function StocksContent() {
  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
        Cổ phiếu
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Hệ thống sàng lọc đa chiều kết hợp phân tích kỹ thuật và cơ bản, hỗ trợ tìm kiếm cơ hội đầu tư và định giá doanh nghiệp.
      </Typography>
    </Box>
  );
}


