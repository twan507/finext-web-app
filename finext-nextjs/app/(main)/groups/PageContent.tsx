// Server Component - static content, không cần 'use client'
import { Box, Typography } from '@mui/material';
import { fontWeight } from 'theme/tokens';

export default function GroupsContent() {
  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: fontWeight.bold }}>
        Tổng quan Nhóm & Ngành
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Tổng quan sức mạnh tương quan và phân bổ dòng tiền giữa các nhóm ngành trên thị trường chứng khoán.
      </Typography>
    </Box>
  );
}
