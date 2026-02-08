'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { Box, Typography, CircularProgress, useTheme } from '@mui/material';
import { useRouter } from 'next/navigation';
import useSseCache from 'hooks/useSseCache';
import CandlestickChart from './CandlestickChart';
import ChartToolbar from './ChartToolbar';
import type { TickerItem } from './ChartToolbar';

// Raw data interface từ backend
export interface ChartRawData {
    date: string;
    open: number;
    ticker: string;
    high: number;
    low: number;
    close: number;
    volume: number;
    trading_value: number | null;
    diff: number | null;
    pct_change: number | null;
    w_pct: number | null;
    m_pct: number | null;
    q_pct: number | null;
    y_pct: number | null;
    ma5: number | null;
    ma20: number | null;
    ma60: number | null;
    ma120: number | null;
    ma240: number | null;
    vema5: number | null;
    vsma5: number | null;
    vsma60: number | null;
    vsi: number | null;
    ticker_name: string | null;
    // Fibonacci levels
    w_f382: number | null;
    w_f500: number | null;
    w_f618: number | null;
    m_f382: number | null;
    m_f500: number | null;
    m_f618: number | null;
    q_f382: number | null;
    q_f500: number | null;
    q_f618: number | null;
    y_f382: number | null;
    y_f500: number | null;
    y_f618: number | null;
    // Opens
    w_open: number | null;
    m_open: number | null;
    q_open: number | null;
    y_open: number | null;
    // Pivots
    w_ph: number | null;
    w_pl: number | null;
    m_ph: number | null;
    m_pl: number | null;
    q_ph: number | null;
    q_pl: number | null;
    y_ph: number | null;
    y_pl: number | null;
    w_pivot: number | null;
    m_pivot: number | null;
    q_pivot: number | null;
    y_pivot: number | null;
    // Volume Profile
    w_poc: number | null;
    w_vah: number | null;
    w_val: number | null;
    m_poc: number | null;
    m_vah: number | null;
    m_val: number | null;
    q_poc: number | null;
    q_vah: number | null;
    q_val: number | null;
    y_poc: number | null;
    y_vah: number | null;
    y_val: number | null;
    // Zones
    w_ma_zone: string | null;
    w_fibo_zone: string | null;
    w_vp_zone: string | null;
    m_ma_zone: string | null;
    m_fibo_zone: string | null;
    m_vp_zone: string | null;
    q_ma_zone: string | null;
    q_fibo_zone: string | null;
    q_vp_zone: string | null;
    y_ma_zone: string | null;
    y_fibo_zone: string | null;
    y_vp_zone: string | null;
    w_zone: string | null;
    m_zone: string | null;
    q_zone: string | null;
    y_zone: string | null;
}

interface ChartPageContentProps {
    ticker: string;
}

export default function ChartPageContent({ ticker }: ChartPageContentProps) {
    const theme = useTheme();
    const router = useRouter();

    // Chart control state (lifted from CandlestickChart so toolbar stays visible during loading)
    const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick');
    const [showIndicators, setShowIndicators] = useState(true);
    const [showVolume, setShowVolume] = useState(true);
    const [showLegend, setShowLegend] = useState(true);
    const [showIndicatorsPanel, setShowIndicatorsPanel] = useState(false);
    const [showWatchlistPanel, setShowWatchlistPanel] = useState(false);

    // Lấy danh sách tickers cho tìm kiếm
    const { data: tickerList } = useSseCache<TickerItem[]>({
        keyword: 'chart_ticker',
        enabled: true,
    });

    const tickers = useMemo(() => tickerList || [], [tickerList]);

    // Handler đổi ticker → navigate sang URL mới
    const handleTickerChange = useCallback(
        (newTicker: string) => {
            router.push(`/charts/${newTicker}`);
        },
        [router],
    );

    // Lấy dữ liệu lịch sử (history)
    const {
        data: historyData,
        isLoading: isHistoryLoading,
        error: historyError,
    } = useSseCache<ChartRawData[]>({
        keyword: 'chart_history_data',
        queryParams: { ticker },
        enabled: !!ticker,
    });

    // Lấy dữ liệu hôm nay (today)
    const {
        data: todayData,
        isLoading: isTodayLoading,
        error: todayError,
    } = useSseCache<ChartRawData[]>({
        keyword: 'chart_today_data',
        queryParams: { ticker },
        enabled: !!ticker,
    });

    // Ghép history + today thành 1 mảng duy nhất, sắp xếp theo date
    const mergedData = useMemo(() => {
        const history = historyData || [];
        const today = todayData || [];
        const all = [...history, ...today];

        // Sort theo date tăng dần
        all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Deduplicate theo date (giữ bản mới nhất - today override history)
        const dateMap = new Map<string, ChartRawData>();
        for (const item of all) {
            const dateKey = item.date?.split('T')[0] || item.date;
            dateMap.set(dateKey, item);
        }

        return Array.from(dateMap.values()).sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
    }, [historyData, todayData]);

    const error = historyError || todayError;

    // Cần cả history VÀ today data mới hiển thị biểu đồ (giống market index chart)
    const hasHistoryData = !isHistoryLoading && Array.isArray(historyData) && historyData.length > 0;
    const hasTodayData = !isTodayLoading && Array.isArray(todayData) && todayData.length > 0;
    const isDataReady = hasHistoryData && hasTodayData;
    const isChartLoading = !isDataReady && !error;

    // Render chart content (loading / error / chart)
    const renderChartArea = () => {
        if (isChartLoading) {
            return (
                <Box
                    sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: theme.palette.background.default,
                    }}
                >
                    <CircularProgress size={40} />
                </Box>
            );
        }

        if (error && mergedData.length === 0) {
            return (
                <Box
                    sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: theme.palette.background.default,
                    }}
                >
                    <Typography color="error">
                        Không thể tải dữ liệu: {error.message}
                    </Typography>
                </Box>
            );
        }

        if (!isDataReady || mergedData.length === 0) {
            return (
                <Box
                    sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: theme.palette.background.default,
                    }}
                >
                    <CircularProgress size={40} />
                </Box>
            );
        }

        return <CandlestickChart
            data={mergedData}
            ticker={ticker}
            chartType={chartType}
            showIndicators={showIndicators}
            showVolume={showVolume}
            showLegend={showLegend}
            showIndicatorsPanel={showIndicatorsPanel}
            showWatchlistPanel={showWatchlistPanel}
            onCloseIndicatorsPanel={() => setShowIndicatorsPanel(false)}
            onCloseWatchlistPanel={() => setShowWatchlistPanel(false)}
        />;
    };

    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Toolbar luôn hiển thị, không bị loading */}
            <ChartToolbar
                ticker={ticker}
                tickers={tickers}
                chartType={chartType}
                showIndicators={showIndicators}
                showVolume={showVolume}
                showLegend={showLegend}
                showIndicatorsPanel={showIndicatorsPanel}
                showWatchlistPanel={showWatchlistPanel}
                onTickerChange={handleTickerChange}
                onChartTypeChange={setChartType}
                onToggleIndicators={() => setShowIndicators(!showIndicators)}
                onToggleVolume={() => setShowVolume(!showVolume)}
                onToggleLegend={() => setShowLegend(!showLegend)}
                onToggleIndicatorsPanel={() => setShowIndicatorsPanel(!showIndicatorsPanel)}
                onToggleWatchlistPanel={() => setShowWatchlistPanel(!showWatchlistPanel)}
            />

            {/* Chart area - loading riêng biệt */}
            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                {renderChartArea()}
            </Box>
        </Box>
    );
}
