'use client';

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material';
import { useRouter } from 'next/navigation';
import useSseCache from 'hooks/useSseCache';
import { apiClient } from 'services/apiClient';
import useChartStore from 'hooks/useChartStore';
import { zIndex } from 'theme/tokens';
import CandlestickChart from './CandlestickChart';
import ChartToolbar from './ChartToolbar';
import ChartSkeleton from './ChartSkeleton';
import type { TickerItem } from './ChartToolbar';

// Raw data interface từ backend — đồng bộ với CHART_DATA_PROJECTION (sse.py)
export interface ChartRawData {
    // Thông tin cơ bản
    ticker: string;
    ticker_name: string | null;
    date: string;

    // OHLCV
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;

    // Biến động giá
    diff: number | null;
    pct_change: number | null;

    // ─── Chỉ báo vẽ LINE trên biểu đồ volume ───
    vsma5: number | null;
    vsma60: number | null;

    // ─── Chỉ báo vẽ LINE trên biểu đồ giá ───

    // Moving Averages
    ma5: number | null;
    ma20: number | null;
    ma60: number | null;
    ma120: number | null;
    ma240: number | null;

    // Open / PH / PL / Pivot — Tuần
    w_open: number | null;
    w_ph: number | null;
    w_pl: number | null;
    w_pivot: number | null;

    // Open / PH / PL / Pivot — Tháng
    m_open: number | null;
    m_ph: number | null;
    m_pl: number | null;
    m_pivot: number | null;

    // Open / PH / PL / Pivot — Quý
    q_open: number | null;
    q_ph: number | null;
    q_pl: number | null;
    q_pivot: number | null;

    // Open / PH / PL / Pivot — Năm
    y_open: number | null;
    y_ph: number | null;
    y_pl: number | null;
    y_pivot: number | null;

    // ─── Chỉ báo vẽ AREA (upper/middle/lower) trên biểu đồ giá ───

    // Fibonacci — Tuần / Tháng / Quý / Năm
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

    // Volume Profile (VAH / POC / VAL) — Tuần / Tháng / Quý / Năm
    w_vah: number | null;
    w_poc: number | null;
    w_val: number | null;

    m_vah: number | null;
    m_poc: number | null;
    m_val: number | null;

    q_vah: number | null;
    q_poc: number | null;
    q_val: number | null;

    y_vah: number | null;
    y_poc: number | null;
    y_val: number | null;
}

interface ChartPageContentProps {
    ticker: string;
}

export default function ChartPageContent({ ticker }: ChartPageContentProps) {
    const theme = useTheme();
    const router = useRouter();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // Persistent chart state (survives reload / tab switch)
    const { enabledIndicators, toggleIndicator, clearAll, resetToDefault, setLastTicker } = useChartStore();

    // Save current ticker as last viewed
    useEffect(() => {
        setLastTicker(ticker);
    }, [ticker, setLastTicker]);

    // Chart control state (lifted from CandlestickChart so toolbar stays visible during loading)
    const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick');
    const [showIndicators, setShowIndicators] = useState(true);
    const [showVolume, setShowVolume] = useState(true);
    const [showLegend, setShowLegend] = useState(true);
    // Default: show indicator panel on desktop & tablet, hide on mobile
    const [showIndicatorsPanel, setShowIndicatorsPanel] = useState(!isMobile);
    const [showWatchlistPanel, setShowWatchlistPanel] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Handle ESC key to exit fullscreen
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullscreen]);

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

    // ─── History: REST one-time fetch (dữ liệu lịch sử không đổi trong ngày) ───
    const [historyData, setHistoryData] = useState<ChartRawData[] | null>(null);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState<string | null>(null);

    useEffect(() => {
        if (!ticker) return;

        let cancelled = false;
        setIsHistoryLoading(true);
        setHistoryError(null);

        apiClient<ChartRawData[]>({
            url: '/api/v1/sse/rest/chart_history_data',
            method: 'GET',
            queryParams: { ticker },
            requireAuth: false,
            useCache: true,
            cacheTtl: 24 * 60 * 60 * 1000, // cache cả ngày
        })
            .then((res) => {
                if (!cancelled) {
                    setHistoryData(res.data ?? []);
                    setIsHistoryLoading(false);
                }
            })
            .catch((err: any) => {
                if (!cancelled) {
                    setHistoryError(err.message || 'Lỗi tải dữ liệu lịch sử');
                    setIsHistoryLoading(false);
                }
            });

        return () => { cancelled = true; };
    }, [ticker]);

    // ─── Today: SSE real-time (cập nhật liên tục trong phiên giao dịch) ───
    const {
        data: todayData,
        isLoading: isTodayLoading,
        error: todayError,
    } = useSseCache<ChartRawData[]>({
        keyword: 'chart_today_data',
        queryParams: { ticker },
        enabled: !!ticker,
    });

    // Data guard: một khi chart đã render đủ data lần đầu, không bao giờ quay lại loading
    const initialRenderDoneRef = useRef(false);

    // Reset khi đổi ticker
    useEffect(() => {
        initialRenderDoneRef.current = false;
    }, [ticker]);

    // Ghép history + today thành 1 mảng duy nhất, sắp xếp theo date
    const mergedData = useMemo(() => {
        const history = historyData || [];
        const today = todayData || [];
        const all = [...history, ...today];

        if (all.length === 0) return [];

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

    const error = historyError || (todayError ? todayError.message : null);

    // Lần đầu: cần CẢ history + today data mới render chart
    const hasHistoryData = !isHistoryLoading && Array.isArray(historyData) && historyData.length > 0;
    const hasTodayData = !isTodayLoading && Array.isArray(todayData) && todayData.length > 0;
    const isFullDataReady = hasHistoryData && hasTodayData;

    // Đánh dấu đã render lần đầu thành công
    useEffect(() => {
        if (isFullDataReady && mergedData.length > 0) {
            initialRenderDoneRef.current = true;
        }
    }, [isFullDataReady, mergedData.length]);

    // Loading: chỉ show skeleton khi chưa từng render thành công VÀ data chưa đủ
    const isChartLoading = !initialRenderDoneRef.current && !isFullDataReady && !error;

    // Render chart content (loading / error / chart)
    const renderChartArea = () => {
        if (isChartLoading) {
            return <ChartSkeleton />;
        }

        if (error && mergedData.length === 0 && !initialRenderDoneRef.current) {
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
                        Không thể tải dữ liệu: {error}
                    </Typography>
                </Box>
            );
        }

        // Chưa đủ data lần đầu và chưa từng render → skeleton
        if (!initialRenderDoneRef.current && !isFullDataReady) {
            return <ChartSkeleton />;
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
            enabledIndicators={enabledIndicators}
            onToggleIndicator={toggleIndicator}
            onClearAllIndicators={clearAll}
            onResetDefaultIndicators={resetToDefault}
            onCloseIndicatorsPanel={() => setShowIndicatorsPanel(false)}
            onCloseWatchlistPanel={() => setShowWatchlistPanel(false)}
        />;
    };

    return (
        <Box
            sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                ...(isFullscreen && {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: zIndex.max,
                    backgroundColor: theme.palette.background.default,
                }),
            }}
        >
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
                isFullscreen={isFullscreen}
                onTickerChange={handleTickerChange}
                onChartTypeChange={setChartType}
                onToggleIndicators={() => setShowIndicators(!showIndicators)}
                onToggleVolume={() => setShowVolume(!showVolume)}
                onToggleLegend={() => setShowLegend(!showLegend)}
                onToggleIndicatorsPanel={() => setShowIndicatorsPanel(!showIndicatorsPanel)}
                onToggleWatchlistPanel={() => setShowWatchlistPanel(!showWatchlistPanel)}
                onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
            />

            {/* Chart area - loading riêng biệt */}
            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                {renderChartArea()}
            </Box>
        </Box>
    );
}
