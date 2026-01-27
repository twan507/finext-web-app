// Server Component - static content, không cần 'use client'
import { Box, Typography } from '@mui/material';

export default function NewsContent() {
    return (
        <Box sx={{ py: 4 }}>
            <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
                Tin tức
            </Typography>
            <Typography variant="body1" color="text.secondary">
                Cập nhật tin tức thị trường tài chính, các sự kiện nổi bật và phân tích chuyên sâu để hỗ trợ quyết định đầu tư của bạn.
            </Typography>
        </Box>
    );
}
