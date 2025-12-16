'use client';

import { Box, Typography } from '@mui/material';

export default function GroupAnalysisContent() {
  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
        Phân tích nhóm
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Lựa chọn một nhóm cổ phiếu để xem chi tiết phân tích, định giá và dòng tiền.
      </Typography>

      <Typography variant="body2" color="text.secondary">
        Danh sách các nhóm cổ phiếu sẽ được hiển thị tại đây...
      </Typography>
    </Box>
  );
}


