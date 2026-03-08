'use client';

import { Box, Typography, Breadcrumbs, Link as MuiLink } from '@mui/material';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { fontWeight } from 'theme/tokens';

export default function GroupDetailPage() {
    const params = useParams();
    const groupId = params.groupId as string;

    return (
        <Box sx={{ py: 4 }}>
            <Breadcrumbs sx={{ mb: 3 }}>
                <MuiLink component={Link} href="/groups" underline="hover" color="inherit">
                    Nhóm & Ngành
                </MuiLink>
                <Typography color="text.primary">{groupId}</Typography>
            </Breadcrumbs>

            <Typography variant="h4" sx={{ mb: 2, fontWeight: fontWeight.bold }}>
                Phân tích nhóm: {groupId}
            </Typography>
            <Typography variant="body1" color="text.secondary">
                Chi tiết phân tích cho nhóm cổ phiếu {groupId}
            </Typography>
        </Box>
    );
}
