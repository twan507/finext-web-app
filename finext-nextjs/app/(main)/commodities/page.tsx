import { Metadata } from 'next';
import { Box, Typography } from '@mui/material';

export const metadata: Metadata = {
    title: 'Hàng hóa | Finext',
    description: 'Diễn biến giá cả, thị trường các loại hàng hóa.',
};

export default function CommoditiesPage() {
    return (
        <Box sx={{ p: 4, textAlign: 'center', height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h1" sx={{ fontSize: '2rem' }}>Hàng hóa</Typography>
            <Typography variant="body1" color="text.secondary">
                Tính năng đang được phát triển và sẽ sớm ra mắt trong các phiên bản tiếp theo.
            </Typography>
        </Box>
    );
}
