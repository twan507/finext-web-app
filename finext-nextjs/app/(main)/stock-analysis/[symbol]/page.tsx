'use client';

import { Box, Typography, Container, Breadcrumbs, Link as MuiLink } from '@mui/material';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function StockAnalysisDetailPage() {
    const params = useParams();
    const symbol = params.symbol as string;

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Breadcrumbs sx={{ mb: 3 }}>
                <MuiLink component={Link} href="/stock-analysis" underline="hover" color="inherit">
                    Phân tích cổ phiếu
                </MuiLink>
                <Typography color="text.primary">{symbol}</Typography>
            </Breadcrumbs>

            <Box>
                <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
                    Phân tích cổ phiếu: {symbol}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Chi tiết phân tích kỹ thuật, cơ bản và định giá cho mã {symbol}
                </Typography>
            </Box>
        </Container>
    );
}
