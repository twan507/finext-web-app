'use client';

import { Box, useTheme, useMediaQuery } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'services/apiClient';

import NNTDSummaryPanel from './NNTD/NNTDSummaryPanel';
import NNTDBarChart from './NNTD/NNTDBarChart';
import NNTDTreemap from './NNTD/NNTDTreemap';
import type { NNTDRecord } from './NNTD/NNTDSummaryPanel';
import ChartSectionTitle from 'components/common/ChartSectionTitle';
import { useMarketUpdateTime } from '../../../../hooks/useMarketUpdateTime';

export default function NuocNgoaiSection() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const updateTime = useMarketUpdateTime();

    // ========== Polling via useQuery — refetch every 10s ==========
    // Stock-level data: dùng cho Treemap (per-ticker)
    const { data: nnStockData = [] } = useQuery<NNTDRecord[]>({
        queryKey: ['markets', 'nntd_stock'],
        queryFn: async () => {
            const response = await apiClient<NNTDRecord[]>({
                url: '/api/v1/sse/rest/nntd_stock',
                method: 'GET',
                queryParams: { nntd_type: 'NN' },
                requireAuth: false,
            });
            return response.data || [];
        },
        refetchInterval: 10_000,
        staleTime: 5_000,
        refetchOnWindowFocus: false,
    });

    // Index-level data: dùng cho Summary Panel + Bar Chart
    // Chỉ lấy 3 index: VNINDEX, HNXINDEX, UPINDEX
    const INDEX_TICKERS = ['VNINDEX', 'HNXINDEX', 'UPINDEX'];
    const { data: nnIndexData = [] } = useQuery<NNTDRecord[]>({
        queryKey: ['markets', 'nntd_index'],
        queryFn: async () => {
            const response = await apiClient<NNTDRecord[]>({
                url: '/api/v1/sse/rest/nntd_index',
                method: 'GET',
                queryParams: { nntd_type: 'NN' },
                requireAuth: false,
            });
            return (response.data || []).filter((r) => INDEX_TICKERS.includes(r.ticker));
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
                    <NNTDSummaryPanel data={nnIndexData} />
                </Box>

                {/* Bar Chart */}
                <Box
                    sx={{
                        flex: isMobile ? '1 1 100%' : '1 1 75%',
                        minWidth: 0,
                    }}
                >
                    <NNTDBarChart data={nnIndexData} />
                </Box>
            </Box>

            {/* Row 2: Treemap (full width) */}
            <Box>
                <ChartSectionTitle
                    title="Bản đồ giao dịch nước ngoài"
                    description="Biểu đồ thể hiện giá trị mua/bán ròng của khối ngoại theo từng mã cổ phiếu"
                    updateTime={updateTime}
                />
                <NNTDTreemap data={nnStockData} />
            </Box>
        </Box>
    );
}
