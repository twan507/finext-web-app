// Server Component - static content, không cần 'use client'
import { Box, Typography } from '@mui/material';
import { fontWeight } from 'theme/tokens';

export default function SectorsContent() {
  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: fontWeight.bold }}>
        Nhóm ngành
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Phân tích sức mạnh tương quan và sự luân chuyển dòng tiền giữa các nhóm ngành để tìm ra sóng ngành dẫn dắt thị trường.
      </Typography>
    </Box>
  );
}


