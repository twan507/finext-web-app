'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import BreadthPolarChart from './BienDongSection/BreadthPolarChart';
import FlowBarChart from './BienDongSection/FlowBarChart';
import VsiGaugeChart from './BienDongSection/VsiGaugeChart';
import StockTreemap from './BienDongSection/StockTreemap';
import type { StockData } from '../../home/components/marketSection/MarketVolatility';
import { ISseRequest } from 'services/core/types';
import { sseClient } from 'services/sseClient';
import ChartSectionTitle from 'components/common/ChartSectionTitle';
import { useMarketUpdateTime } from '../../../../hooks/useMarketUpdateTime';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TodayIndexRecord {
    ticker: string;
    vsi?: number;
}

interface BienDongSectionProps {
    todayAllData: Record<string, TodayIndexRecord[]>;
}


export default function BienDongSection({ todayAllData }: BienDongSectionProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
    const chartHeight = '250px';
    const updateTime = useMarketUpdateTime();

    const isMountedRef = useRef<boolean>(true);
    const todayStockSseRef = useRef<{ unsubscribe: () => void } | null>(null);

    // SSE state: home_today_stock
    const [stockData, setStockData] = useState<StockData[]>([]);

    // ========== SSE - Today Stock Data ==========
    useEffect(() => {
        isMountedRef.current = true;

        if (todayStockSseRef.current) {
            todayStockSseRef.current.unsubscribe();
            todayStockSseRef.current = null;
        }

        const requestProps: ISseRequest = {
            url: '/api/v1/sse/stream',
            queryParams: { keyword: 'home_today_stock' },
        };

        todayStockSseRef.current = sseClient<StockData[]>(
            requestProps,
            {
                onOpen: () => { },
                onData: (receivedData) => {
                    if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
                        setStockData(receivedData);
                    }
                },
                onError: (sseError) => {
                    if (isMountedRef.current) console.warn('[SSE BienDong Stock] Error:', sseError.message);
                },
                onClose: () => { },
            },
        );

        return () => {
            isMountedRef.current = false;
            if (todayStockSseRef.current) todayStockSseRef.current.unsubscribe();
        };
    }, []);

    // ========== DATA PROCESSING ==========

    // Breadth: count by pct_change
    const priceIncrease = stockData.filter((s) => s.pct_change > 0).length;
    const priceDecrease = stockData.filter((s) => s.pct_change < 0).length;
    const priceUnchanged = stockData.filter((s) => s.pct_change === 0).length;

    // Flow: sum trading_value grouped by t0_score
    const flowIn = stockData.filter((s) => s.t0_score > 0).reduce((sum, s) => sum + (s.trading_value || 0), 0);
    const flowOut = stockData.filter((s) => s.t0_score < 0).reduce((sum, s) => sum + (s.trading_value || 0), 0);
    const flowNeutral = stockData.filter((s) => s.t0_score === 0).reduce((sum, s) => sum + (s.trading_value || 0), 0);

    // ========== VSI GAUGE DATA ==========
    const vsiLastValue = useMemo(() => {
        const fnxRecord = todayAllData['FNXINDEX']?.[0];
        const vsi = fnxRecord?.vsi;
        if (typeof vsi !== 'number' || isNaN(vsi)) return null;
        return parseFloat((vsi * 100).toFixed(2));
    }, [todayAllData]);

    // ========== Chart title component ==========
    // (replaced by ChartSectionTitle)

    return (
        <Box sx={{ py: 3 }}>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    flexWrap: isTablet ? 'wrap' : 'nowrap',
                    gap: isMobile ? 2 : 3,
                }}
            >
                {/* Độ rộng thị trường — Desktop: 33%, Tablet: 50%, Mobile: 100% */}
                <Box
                    sx={{
                        flex: isMobile ? '1 1 100%' : isTablet ? '1 1 calc(50% - 12px)' : '1 1 0',
                        minWidth: 0,
                    }}
                >
                    <ChartSectionTitle
                        title="Độ rộng thị trường"
                        description="Tỷ lệ số mã cổ phiếu tăng giá, giảm giá và không đổi trên toàn thị trường trong phiên giao dịch"
                        updateTime={updateTime}
                    />
                    <BreadthPolarChart
                        series={[priceIncrease, priceUnchanged, priceDecrease]}
                        labels={['Tăng giá', 'Không đổi', 'Giảm giá']}
                        colors={[theme.palette.trend.up, theme.palette.trend.ref, theme.palette.trend.down]}
                        chartHeight={chartHeight}
                    />
                </Box>

                {/* Phân bổ dòng tiền — Desktop: 33%, Tablet: 50%, Mobile: 100% */}
                <Box
                    sx={{
                        flex: isMobile ? '1 1 100%' : isTablet ? '1 1 calc(50% - 12px)' : '1 1 0',
                        minWidth: 0,
                    }}
                >
                    <ChartSectionTitle
                        title="Phân bổ dòng tiền"
                        description="Tổng giá trị giao dịch được phân bổ theo chiều hướng dòng tiền: tiền vào, tiền ra và không đổi"
                        updateTime={updateTime}
                    />
                    <FlowBarChart
                        flowIn={flowIn}
                        flowOut={flowOut}
                        flowNeutral={flowNeutral}
                        chartHeight={chartHeight}
                        isLoading={stockData.length === 0}
                    />
                </Box>

                {/* Chỉ số thanh khoản — Desktop: 33%, Tablet: 50%, Mobile: 100% */}
                <Box
                    sx={{
                        flex: isMobile ? '1 1 100%' : isTablet ? '1 1 calc(50% - 12px)' : '1 1 0',
                        minWidth: 0,
                    }}
                >
                    <ChartSectionTitle
                        title="Chỉ số thanh khoản"
                        description="Chỉ số VSI đo lường thanh khoản thị trường: 100% là mức trung bình của tuần, trên 100% nghĩa là thanh khoản cao hơn bình thường, dưới 100% là thấp hơn"
                        updateTime={updateTime}
                    />
                    <VsiGaugeChart value={vsiLastValue} />
                </Box>
            </Box>

            <Box sx={{ mt: 3 }}>
                <ChartSectionTitle
                    title="Bản đồ thị trường"
                    description="Biểu đồ thể hiện biến động giá của các cổ phiếu theo nhóm ngành, kích thước tương ứng giá trị giao dịch"
                    updateTime={updateTime}
                />
                <StockTreemap data={stockData} />
            </Box>
        </Box>
    );
}
