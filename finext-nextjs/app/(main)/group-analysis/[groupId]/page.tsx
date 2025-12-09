'use client';

import { Box, Typography, Container, Breadcrumbs, Link as MuiLink } from '@mui/material';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function GroupAnalysisDetailPage() {
    const params = useParams();
    const groupId = params.groupId as string;

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Breadcrumbs sx={{ mb: 3 }}>
                <MuiLink component={Link} href="/group-analysis" underline="hover" color="inherit">
                    Phân tích nhóm
                </MuiLink>
                <Typography color="text.primary">{groupId}</Typography>
            </Breadcrumbs>

            <Box>
                <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
                    Phân tích nhóm: {groupId}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Chi tiết phân tích cho nhóm cổ phiếu {groupId}
                </Typography>
            </Box>
        </Container>
    );
}
