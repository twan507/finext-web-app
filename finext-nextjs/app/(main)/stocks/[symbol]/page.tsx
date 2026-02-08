'use client';

import { Box, Typography, Breadcrumbs, Link as MuiLink } from '@mui/material';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { fontWeight } from 'theme/tokens';

export default function StockDetailPage() {
    const params = useParams();
    const symbol = params.symbol as string;

    return (
        <Box sx={{ py: 4 }}>
            <Breadcrumbs sx={{ mb: 3 }}>
                <MuiLink component={Link} href="/stocks" underline="hover" color="inherit">
                    Cổ phiếu
                </MuiLink>
                <Typography color="text.primary">{symbol}</Typography>
            </Breadcrumbs>

            <Typography variant="h4" sx={{ mb: 2, fontWeight: fontWeight.bold }}>
                Phân tích cổ phiếu: {symbol}
            </Typography>
            <Typography variant="body1" color="text.secondary">
                Chi tiết phân tích kỹ thuật, cơ bản và định giá cho mã {symbol}
            </Typography>
        </Box>
    );
}
