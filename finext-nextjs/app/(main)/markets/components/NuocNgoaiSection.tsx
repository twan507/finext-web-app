'use client';

import { useMemo } from 'react';
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';
import { apiClient } from 'services/apiClient';

import NNTDSummaryPanel from './NNTD/NNTDSummaryPanel';
import NNTDBarChart from './NNTD/NNTDBarChart';
import NNTDTreemap from './NNTD/NNTDTreemap';
import type { NNTDRecord } from './NNTD/NNTDSummaryPanel';

export default function NuocNgoaiSection() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // ========== Polling via useQuery — refetch every 10s ==========
    const { data: nnData = [] } = useQuery<NNTDRecord[]>({
        queryKey: ['markets', 'nntd_stock'],
        queryFn: async () => {
            const response = await apiClient<NNTDRecord[]>({
                url: '/api/v1/sse/rest/nntd_stock',
                method: 'GET',
                requireAuth: false,
            });
            const allData = response.data || [];
            // Filter type='NN' only
            return allData.filter((r) => r.type === 'NN');
        },
        refetchInterval: 10_000,
        staleTime: 5_000,
        refetchOnWindowFocus: false,
    });

    return (
        <Box sx={{ py: 3 }}>
            {/* Row 1: Panel (left) + Bar Chart (right) */}
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? 2 : 3,
                    mb: 3,
                }}
            >
                {/* Summary Panel */}
                <Box
                    sx={{
                        flex: isMobile ? '1 1 100%' : '0 0 25%',
                        minWidth: 0,
                    }}
                >
                    <NNTDSummaryPanel data={nnData} />
                </Box>

                {/* Bar Chart */}
                <Box
                    sx={{
                        flex: isMobile ? '1 1 100%' : '1 1 75%',
                        minWidth: 0,
                    }}
                >
                    <NNTDBarChart data={nnData} />
                </Box>
            </Box>

            {/* Row 2: Treemap (full width) */}
            <Box>
                <Typography
                    color="text.secondary"
                    sx={{
                        fontSize: getResponsiveFontSize('lg'),
                        fontWeight: fontWeight.semibold,
                        textTransform: 'uppercase',
                    }}
                >
                    Bản đồ giao dịch nước ngoài
                </Typography>
                <NNTDTreemap data={nnData} />
            </Box>
        </Box>
    );
}
