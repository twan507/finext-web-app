'use client';

import { Box, Typography, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

export default function NuocNgoaiSection() {
    const theme = useTheme();
    return (
        <Box sx={{ py: 3 }}>
            <Typography sx={{ fontSize: getResponsiveFontSize('lg'), fontWeight: fontWeight.semibold, mb: 2 }}>
                Giao dịch nước ngoài
            </Typography>
            <Typography sx={{ fontSize: getResponsiveFontSize('md'), color: theme.palette.text.secondary }}>
                Phần nội dung giao dịch nước ngoài đang được phát triển...
            </Typography>
        </Box>
    );
}
