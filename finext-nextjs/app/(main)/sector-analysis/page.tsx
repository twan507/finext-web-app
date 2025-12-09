'use client';

import { Box, Typography, Container } from '@mui/material';

export default function SectorAnalysisPage() {
    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Box>
                <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
                    Phân tích ngành
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    Lựa chọn một ngành để xem chi tiết phân tích, so sánh và xu hướng phát triển.
                </Typography>

                <Typography variant="body2" color="text.secondary">
                    Danh sách các ngành sẽ được hiển thị tại đây...
                </Typography>
            </Box>
        </Container>
    );
}
