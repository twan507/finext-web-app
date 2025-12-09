'use client';

import { Box, Typography, Container } from '@mui/material';

export default function HomePage() {
    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Box>
                <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
                    Trang chủ
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Nội dung trang chủ đang được phát triển...
                </Typography>
            </Box>
        </Container>
    );
}
