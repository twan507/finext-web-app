'use client';

import { Box, Typography, useTheme } from '@mui/material';
import { useRouter } from 'next/navigation';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { fontSize } from 'theme/tokens';

export default function MoneyFlowSection() {
    const theme = useTheme();
    const router = useRouter();

    return (
        <Box>
            {/* Title - Dòng tiền (clickable) */}
            <Box
                onClick={() => router.push('/money-flow')}
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    mb: 2,
                }}
            >
                <Typography variant="h1">
                    Dòng tiền
                </Typography>
                <ChevronRightIcon sx={{ fontSize: fontSize.h2.tablet, mt: 1, color: theme.palette.text.secondary }} />
            </Box>

            {/* Placeholder Content */}
            <Box
                sx={{
                    p: 4,
                    borderRadius: 2,
                    backgroundColor: theme.palette.background.paper,
                    minHeight: 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Typography variant="h3" color="text.secondary">
                    Phân tích dòng tiền - Coming soon
                </Typography>
            </Box>
        </Box>
    );
}

