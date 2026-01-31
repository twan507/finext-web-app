// Server Component - không cần 'use client' vì chỉ render static content
import { Box, Typography } from '@mui/material';
import { fontWeight } from 'theme/tokens';

export default function MarketsContent() {
  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: fontWeight.bold }}>
        Thị trường
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Cung cấp cái nhìn toàn cảnh về sức khỏe thị trường, nhận diện xu hướng vĩ mô và đánh giá rủi ro trong từng giai đoạn chu kỳ.
      </Typography>
    </Box>
  );
}


