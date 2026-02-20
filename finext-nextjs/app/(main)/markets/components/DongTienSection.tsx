'use client';

import { Box, Typography, useTheme } from '@mui/material';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

export default function DongTienSection() {
    const theme = useTheme();
    return (
        <Box sx={{ py: 3 }}>
            <Typography sx={{ fontSize: getResponsiveFontSize('lg'), fontWeight: fontWeight.semibold, mb: 2 }}>
                Dòng tiền thị trường
            </Typography>
            <Typography sx={{ fontSize: getResponsiveFontSize('md'), color: theme.palette.text.secondary }}>
                Phần nội dung dòng tiền đang được phát triển...
            </Typography>
        </Box>
    );
}
