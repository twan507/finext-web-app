'use client';

import { Box, Typography } from '@mui/material';
import NewsList from 'app/(main)/news/components/NewsList';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

interface NewsSectionProps {
    ticker: string;
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

export default function NewsSection({ ticker }: NewsSectionProps) {
    return (
        <Box>
            <Box sx={{ mb: 2 }}><SectionTitle>TIN TỨC CỔ PHIẾU {ticker}</SectionTitle></Box>
            <NewsList
                ticker={ticker}
                pageSize={10}
            />
        </Box>
    );
}
