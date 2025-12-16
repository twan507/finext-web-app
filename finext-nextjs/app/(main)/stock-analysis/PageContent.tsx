'use client';

import { Box, Typography } from '@mui/material';

export default function StockAnalysisContent() {
  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
        Phân tích cổ phiếu
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Lựa chọn một cổ phiếu để xem chi tiết phân tích kỹ thuật, cơ bản và định giá.
      </Typography>

      <Typography variant="body2" color="text.secondary">
        Danh sách cổ phiếu sẽ được hiển thị tại đây...
      </Typography>
    </Box>
  );
}


