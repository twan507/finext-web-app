'use client';

import { Box, Typography } from '@mui/material';
import { fontWeight } from 'theme/tokens';

export default function GroupAnalysisContent() {
    return (
        <Box sx={{ py: 4 }}>
            <Typography variant="h4" sx={{ mb: 2, fontWeight: fontWeight.bold }}>
                Phân tích Nhóm & Ngành
            </Typography>
            <Typography variant="body1" color="text.secondary">
                Phân tích chi tiết và so sánh hiệu suất giữa các nhóm ngành để tìm ra sóng ngành dẫn dắt thị trường.
            </Typography>
        </Box>
    );
}
