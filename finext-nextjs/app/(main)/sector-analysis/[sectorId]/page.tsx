'use client';

import { Box, Typography, Container, Breadcrumbs, Link as MuiLink } from '@mui/material';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function SectorAnalysisDetailPage() {
    const params = useParams();
    const sectorId = params.sectorId as string;

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Breadcrumbs sx={{ mb: 3 }}>
                <MuiLink component={Link} href="/sector-analysis" underline="hover" color="inherit">
                    Phân tích ngành
                </MuiLink>
                <Typography color="text.primary">{sectorId}</Typography>
            </Breadcrumbs>

            <Box>
                <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
                    Phân tích ngành: {sectorId}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Chi tiết phân tích cho ngành {sectorId}
                </Typography>
            </Box>
        </Container>
    );
}
