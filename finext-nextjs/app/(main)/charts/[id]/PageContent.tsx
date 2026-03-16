'use client';

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material';
import { useRouter } from 'next/navigation';
import { apiClient } from 'services/apiClient';
import useChartStore from 'hooks/useChartStore';
import { zIndex } from 'theme/tokens';
import CandlestickChart from './CandlestickChart';
import ChartToolbar from './ChartToolbar';
import ChartSkeleton from './ChartSkeleton';
import type { TickerItem } from './ChartToolbar';
import { aggregateByTimeframe, type Timeframe } from './aggregateTimeframe';

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

    // ─── Pre-computed timestamp (tính 1 lần, dùng lại ở chart) ───
    _ts?: number;
}

interface ChartPageContentProps {
    ticker: string;
}

export default function ChartPageContent({ ticker }: ChartPageContentProps) {
    const theme = useTheme();
    const router = useRouter();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));

    // Persistent chart state (survives reload / tab switch)
    const { enabledIndicators, toggleIndicator, clearAll, resetToDefault, setLastTicker, toolbarPrefs, updateToolbarPrefs } = useChartStore();

    // Save current ticker as last viewed
    useEffect(() => {
        setLastTicker(ticker);
    }, [ticker, setLastTicker]);

    // Chart control state — persisted toolbar prefs
    const chartType = toolbarPrefs.chartType;
    const showIndicators = toolbarPrefs.showIndicators;
    const showVolume = toolbarPrefs.showVolume;
    const showLegend = toolbarPrefs.showLegend;
    const priceTagMode = toolbarPrefs.priceTagMode;
    const timeframe = toolbarPrefs.timeframe as Timeframe;
    // Non-persisted UI state
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

    // Lấy danh sách tickers cho tìm kiếm (dữ liệu tĩnh — REST + cache 24h)
    const [tickers, setTickers] = useState<TickerItem[]>([]);

    useEffect(() => {
        let cancelled = false;
        apiClient<TickerItem[]>({
            url: '/api/v1/sse/rest/chart_ticker',
            method: 'GET',
            requireAuth: false,
            useCache: true,
            cacheTtl: 24 * 60 * 60 * 1000,
        })
            .then((res) => {
                if (!cancelled) setTickers(res.data ?? []);
            })
            .catch(() => { /* ignore — ticker list is non-critical */ });
        return () => { cancelled = true; };
    }, []);

    // Handler đổi ticker → navigate sang URL mới
    const handleTickerChange = useCallback(
        (newTicker: string) => {
            router.push(`/charts/${newTicker}`);
        },
        [router],
    );

    // ─── History: REST lazy-load (responsive chunks, newest first) ───
    const baseChunk = isMobile ? 120 : isTablet ? 180 : 240;
    const chunkSize = timeframe === '1M' ? baseChunk * 3 : timeframe === '1W' ? baseChunk * 2 : baseChunk;
    const chunkSizeRef = useRef(chunkSize);
    chunkSizeRef.current = chunkSize;

    const [historyData, setHistoryData] = useState<ChartRawData[] | null>(null);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);
    const [loadedBars, setLoadedBars] = useState(0);
    const isLoadingMoreRef = useRef(false);

    // Fetch initial chunk
    useEffect(() => {
        if (!ticker) return;

        let cancelled = false;
        setIsHistoryLoading(true);
        setHistoryError(null);
        setHistoryData(null);
        setLoadedBars(0);
        setHasMoreHistory(true);

        apiClient<ChartRawData[]>({
            url: '/api/v1/sse/rest/chart_history_data',
            method: 'GET',
            queryParams: { ticker, limit: chunkSizeRef.current, skip: 0 },
            requireAuth: false,
            useCache: true,
            cacheTtl: 24 * 60 * 60 * 1000,
        })
            .then((res) => {
                if (cancelled) return;
                const data = res.data ?? [];
                setHistoryData(data);
                setLoadedBars(data.length);
                setHasMoreHistory(data.length > 0);
                setIsHistoryLoading(false);
            })
            .catch((err: any) => {
                if (cancelled) return;
                setHistoryError(err.message || 'Lỗi tải dữ liệu lịch sử');
                setIsHistoryLoading(false);
            });

        return () => { cancelled = true; };
    }, [ticker]);

    // Load more history (called when user scrolls to left edge)
    const loadMoreHistory = useCallback(() => {
        if (isLoadingMoreRef.current || !hasMoreHistory) return;

        isLoadingMoreRef.current = true;

        apiClient<ChartRawData[]>({
            url: '/api/v1/sse/rest/chart_history_data',
            method: 'GET',
            queryParams: { ticker, limit: chunkSizeRef.current, skip: loadedBars },
            requireAuth: false,
            useCache: true,
            cacheTtl: 24 * 60 * 60 * 1000,
        })
            .then((res) => {
                const olderData = res.data ?? [];
                if (olderData.length > 0) {
                    setHistoryData((prev) => [...olderData, ...(prev || [])]);
                    setLoadedBars((prev) => prev + olderData.length);
                }
                if (olderData.length === 0) {
                    setHasMoreHistory(false);
                }
                isLoadingMoreRef.current = false;
            })
            .catch(() => {
                isLoadingMoreRef.current = false;
            });
    }, [ticker, hasMoreHistory, loadedBars]);

    // ─── Today: REST polling mỗi 5s (thay vì SSE — nhanh hơn cho initial load) ───
    const [todayData, setTodayData] = useState<ChartRawData[] | null>(null);
    const [isTodayLoading, setIsTodayLoading] = useState(true);
    const [todayError, setTodayError] = useState<string | null>(null);

    useEffect(() => {
        if (!ticker) return;

        let cancelled = false;

        const fetchToday = () => {
            apiClient<ChartRawData[]>({
                url: '/api/v1/sse/rest/chart_today_data',
                method: 'GET',
                queryParams: { ticker },
                requireAuth: false,
                useCache: false, // luôn fetch mới cho today data
            })
                .then((res) => {
                    if (!cancelled) {
                        const data = res.data ?? [];
                        if (data.length > 0) {
                            setTodayData(data);
                        }
                        setIsTodayLoading(false);
                    }
                })
                .catch((err: any) => {
                    if (!cancelled) {
                        setTodayError(err.message || 'Lỗi tải dữ liệu hôm nay');
                        setIsTodayLoading(false);
                    }
                });
        };

        // Fetch ngay lần đầu
        fetchToday();

        // Polling mỗi 5 giây
        const intervalId = setInterval(fetchToday, 5000);

        return () => {
            cancelled = true;
            clearInterval(intervalId);
        };
    }, [ticker]);

    // Data guard: một khi chart đã render đủ data lần đầu, không bao giờ quay lại loading
    const initialRenderDoneRef = useRef(false);

    // Reset khi đổi ticker
    useEffect(() => {
        initialRenderDoneRef.current = false;
    }, [ticker]);

    // Ghép history + today thành 1 mảng duy nhất
    // Backend đã sort sẵn theo date ASC → không cần sort lại trên FE
    const mergedData = useMemo(() => {
        const history = historyData || [];
        const today = todayData || [];

        if (history.length === 0 && today.length === 0) return [];

        // Dedup: today overrides history nếu trùng date
        // Pre-compute _ts (UTCTimestamp) cho mỗi item — chỉ tính 1 lần
        const dateMap = new Map<string, ChartRawData>();

        for (const item of history) {
            const dateKey = item.date?.split('T')[0] || item.date;
            const dateObj = new Date(item.date);
            const ts = Math.floor(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()) / 1000);
            dateMap.set(dateKey, { ...item, _ts: ts });
        }

        // Today data ghi đè history nếu trùng date
        for (const item of today) {
            const dateKey = item.date?.split('T')[0] || item.date;
            const dateObj = new Date(item.date);
            const ts = Math.floor(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()) / 1000);
            dateMap.set(dateKey, { ...item, _ts: ts });
        }

        // Map giữ nguyên insertion order → đã sorted vì history sorted + today appended cuối
        return Array.from(dateMap.values());
    }, [historyData, todayData]);

    // Aggregate data theo timeframe (1D = nguyên gốc, 1W/1M = group by)
    const aggregatedData = useMemo(
        () => aggregateByTimeframe(mergedData, timeframe),
        [mergedData, timeframe],
    );

    const error = historyError || todayError;

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
            data={aggregatedData}
            timeframe={timeframe}
            ticker={ticker}
            chartType={chartType}
            showIndicators={showIndicators}
            showVolume={showVolume}
            showLegend={showLegend}
            priceTagMode={priceTagMode}
            showIndicatorsPanel={showIndicatorsPanel}
            showWatchlistPanel={showWatchlistPanel}
            enabledIndicators={enabledIndicators}
            onToggleIndicator={toggleIndicator}
            onClearAllIndicators={clearAll}
            onResetDefaultIndicators={resetToDefault}
            onCloseIndicatorsPanel={() => setShowIndicatorsPanel(false)}
            onCloseWatchlistPanel={() => setShowWatchlistPanel(false)}
            onLoadMore={loadMoreHistory}
            hasMoreData={hasMoreHistory}
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
                priceTagMode={priceTagMode}
                showIndicatorsPanel={showIndicatorsPanel}
                showWatchlistPanel={showWatchlistPanel}
                isFullscreen={isFullscreen}
                timeframe={timeframe}
                onTimeframeChange={(tf) => updateToolbarPrefs({ timeframe: tf })}
                onTickerChange={handleTickerChange}
                onChartTypeChange={(t) => updateToolbarPrefs({ chartType: t })}
                onToggleIndicators={() => updateToolbarPrefs({ showIndicators: !showIndicators })}
                onToggleVolume={() => updateToolbarPrefs({ showVolume: !showVolume })}
                onToggleLegend={() => updateToolbarPrefs({ showLegend: !showLegend })}
                onCyclePriceTagMode={() => updateToolbarPrefs({ priceTagMode: priceTagMode === 'value' ? 'both' : priceTagMode === 'both' ? 'none' : 'value' })}
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
