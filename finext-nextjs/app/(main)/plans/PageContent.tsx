// finext-nextjs/app/(main)/plans/PageContent.tsx
'use client';

import { Box, Typography, Container } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

export default function PageContent() {
    return (
        <Container maxWidth="lg" sx={{ py: 6 }}>
            <Typography
                variant="h4"
                sx={{
                    fontWeight: fontWeight.bold,
                    textAlign: 'center',
                    mb: 2,
                    fontSize: getResponsiveFontSize('xl'),
                }}
            >
                Các Gói Thành Viên
            </Typography>
            <Typography
                variant="body1"
                sx={{
                    color: 'text.secondary',
                    textAlign: 'center',
                    maxWidth: 600,
                    mx: 'auto',
                }}
            >
                Nội dung đang được cập nhật. Vui lòng quay lại sau.
            </Typography>
        </Container>
    );
}
