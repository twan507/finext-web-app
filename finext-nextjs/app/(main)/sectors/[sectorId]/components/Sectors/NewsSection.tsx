'use client';

import { Box, Typography } from '@mui/material';
import { ReportList } from 'app/(main)/reports/components';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

interface NewsSectionProps {
    ticker: string;
    indexName: string;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <Typography
            color="text.secondary"
            sx={{
                fontSize: getResponsiveFontSize('lg'),
                fontWeight: fontWeight.semibold,
                textTransform: 'uppercase',
                mb: 1,
            }}
        >
            {children}
        </Typography>
    );
}

export default function NewsSection({ ticker, indexName }: NewsSectionProps) {
    return (
        <Box>
            <Box sx={{ mb: 2 }}><SectionTitle>BẢN TIN LIÊN QUAN NGÀNH {indexName.toUpperCase()}</SectionTitle></Box>
            <ReportList
                ticker={ticker}
                pageSize={5}
            />
        </Box>
    );
}
