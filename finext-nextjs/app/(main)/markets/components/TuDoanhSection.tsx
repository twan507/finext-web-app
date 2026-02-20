'use client';

import { Box, Typography, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

export default function TuDoanhSection() {
    const theme = useTheme();
    return (
        <Box sx={{ py: 3 }}>
            <Typography sx={{ fontSize: getResponsiveFontSize('lg'), fontWeight: fontWeight.semibold, mb: 2 }}>
                Giao dịch tự doanh
            </Typography>
            <Typography sx={{ fontSize: getResponsiveFontSize('md'), color: theme.palette.text.secondary }}>
                Phần nội dung giao dịch tự doanh đang được phát triển...
            </Typography>
        </Box>
    );
}
