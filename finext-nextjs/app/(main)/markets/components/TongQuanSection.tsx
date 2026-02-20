'use client';

import { Box, Typography, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

export default function TongQuanSection() {
    const theme = useTheme();
    return (
        <Box sx={{ py: 3 }}>
            <Typography sx={{ fontSize: getResponsiveFontSize('lg'), fontWeight: fontWeight.semibold, mb: 2 }}>
                Tổng quan thị trường
            </Typography>
            <Typography sx={{ fontSize: getResponsiveFontSize('md'), color: theme.palette.text.secondary }}>
                Phần nội dung tổng quan thị trường đang được phát triển...
            </Typography>
        </Box>
    );
}
