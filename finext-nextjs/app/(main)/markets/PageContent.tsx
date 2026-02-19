'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Box, Typography, Skeleton, useTheme, useMediaQuery, Divider } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

import type { RawMarketData, ChartData, TimeRange } from '../components/MarketIndexChart';
import { transformToChartData } from '../components/MarketIndexChart';
import IndexTable from '../components/IndexTable';
import Carousel from 'components/common/Carousel';
import InfoTooltip from 'components/common/InfoTooltip';
import { getTrendColor, getVsiColor } from 'theme/colorHelpers';

import { apiClient } from 'services/apiClient';
import { ISseRequest } from 'services/core/types';
import { sseClient, getFromCache } from 'services/sseClient';
import {
  getResponsiveFontSize,
  fontWeight,
  borderRadius,
  spacing,
  transitions,
  getGlassCard,
} from 'theme/tokens';

// Lazy load heavy chart component
const MarketIndexChart = dynamic(
  () => import('../components/MarketIndexChart').then(mod => ({ default: mod.default })),
  {
    loading: () => <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />,
    ssr: false
  }
);

// ========== INDEX LISTS ==========
const MAIN_INDEXES = ['VNINDEX', 'VN30', 'HNXINDEX', 'UPINDEX'];
const DERIVATIVE_INDEXES = ['VN30F1M', 'VN30F2M', 'VN100F1M', 'VN100F2M'];
const FINEXT_INDEXES = ['FNXINDEX', 'LARGECAP', 'MIDCAP', 'SMALLCAP'];

// Type cho SSE data
type IndexDataByTicker = Record<string, RawMarketData[]>;

// Extended type cho index data với các trường bổ sung từ home_today_index
interface IndexRawData extends RawMarketData {
  trading_value?: number;
  w_pct?: number;
  m_pct?: number;
  q_pct?: number;
  y_pct?: number;
  vsi?: number;
}

// Empty chart data
const emptyChartData: ChartData = { areaData: [], candleData: [], volumeData: [] };

// ========== STAT ROW (label trái, value phải) ==========
function StatRow({ label, value, color, tooltip }: { label: string; value: string; color?: string; tooltip?: string }) {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: { xs: 0.5, md: 1 }, px: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography sx={{
          fontSize: getResponsiveFontSize('xs'),
          color: theme.palette.text.secondary,
          fontWeight: fontWeight.medium,
        }}>
          {label}
        </Typography>
        {tooltip && <InfoTooltip title={tooltip} />}
      </Box>
      <Typography sx={{
        fontSize: getResponsiveFontSize('sm'),
        fontWeight: fontWeight.semibold,
        color: color || theme.palette.text.primary,
      }}>
        {value}
      </Typography>
    </Box>
  );
}

// ========== INDEX DETAIL PANEL ==========
function IndexDetailPanel({ indexName, todayData }: { indexName: string; todayData: IndexRawData[] }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Lấy record mới nhất (cuối mảng)
  const latest = todayData.length > 0 ? todayData[todayData.length - 1] : null;

  const glassStyles = (() => {
    const g = getGlassCard(isDark);
    return { background: g.background, backdropFilter: g.backdropFilter, WebkitBackdropFilter: g.WebkitBackdropFilter, border: g.border };
  })();

  const formatPct = (v: number | undefined | null) => {
    if (v == null) return '—';
    return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
  };
  const formatPrice = (v: number | undefined | null) => {
    if (v == null) return '—';
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const formatVolume = (v: number | undefined | null) => {
    if (v == null) return '—';
    return v.toLocaleString('en-US');
  };
  const formatValue = (v: number | undefined | null) => {
    if (v == null) return '—';
    return `${Math.round(v).toLocaleString('en-US')} Tỷ`;
  };
  const formatVsi = (v: number | undefined | null) => {
    if (v == null) return '—';
    return `${(v * 100).toFixed(2)}%`;
  };

  return (
    <Box sx={{
      ...glassStyles,
      borderRadius: `${borderRadius.lg}px`,
      p: { xs: 1.5, md: 2 },
    }}>
      {/* Title */}
      <Typography sx={{
        fontSize: getResponsiveFontSize('md'),
        fontWeight: fontWeight.bold,
        color: theme.palette.text.primary,
        mb: { xs: 1, md: 1.5 },
      }}>
        Thông tin chi tiết {indexName}
      </Typography>

      {/* Section 1: OHLC — ẩn trên mobile */}
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <StatRow label="Open" value={formatPrice(latest?.open)} />
        <StatRow label="High" value={formatPrice(latest?.high)} color={theme.palette.trend.up} />
        <StatRow label="Low" value={formatPrice(latest?.low)} color={theme.palette.trend.down} />
        <StatRow
          label="Close"
          value={formatPrice(latest?.close)}
          tooltip="Giá đóng cửa phiên gần nhất, hoặc giá khớp lệnh mới nhất nếu phiên đang diễn ra."
        />
        <Divider sx={{ my: { xs: 0.75, md: 1 } }} />
      </Box>

      {/* Section 2: Biến động */}
      <StatRow label="% Tuần" value={formatPct(latest?.w_pct)} color={latest?.w_pct != null ? getTrendColor(latest.w_pct, theme) : undefined} />
      <StatRow label="% Tháng" value={formatPct(latest?.m_pct)} color={latest?.m_pct != null ? getTrendColor(latest.m_pct, theme) : undefined} />
      <StatRow label="% Quý" value={formatPct(latest?.q_pct)} color={latest?.q_pct != null ? getTrendColor(latest.q_pct, theme) : undefined} />
      <StatRow label="% Năm" value={formatPct(latest?.y_pct)} color={latest?.y_pct != null ? getTrendColor(latest.y_pct, theme) : undefined} />

      {/* Section 3: Thanh khoản */}
      <Divider sx={{ my: 1 }} />
      <StatRow
        label="Chỉ số thanh khoản"
        value={formatVsi(latest?.vsi)}
        color={latest?.vsi != null ? getVsiColor(latest.vsi, theme) : undefined}
        tooltip="Tỉ lệ thanh khoản phiên hiện tại so với trung bình 5 phiên gần nhất. Giá trị > 120% cho thấy đột biến về mặt thanh khoản."
      />
      <StatRow label="Khối lượng giao dịch" value={formatVolume(latest?.volume)} />
      <StatRow label="Giá trị giao dịch" value={formatValue(latest?.trading_value)} />
    </Box>
  );
}

// ========== INDEX TABLES SECTION (Carousel on mobile, Row on desktop) ==========
function IndexTablesSection({ ticker, onTickerChange, todayAllData }: {
  ticker: string;
  onTickerChange: (t: string) => void;
  todayAllData: IndexDataByTicker;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const titleSx = {
    fontSize: getResponsiveFontSize('md'),
    fontWeight: fontWeight.semibold,
    color: theme.palette.text.primary,
    mb: 1.5,
    pb: 1,
    borderBottom: `2px solid ${theme.palette.primary.main}`,
    display: 'inline-block',
  };

  const tables = [
    { id: 'coso', title: 'Cơ sở', list: MAIN_INDEXES },
    { id: 'phaisinh', title: 'Phái sinh', list: DERIVATIVE_INDEXES },
    { id: 'finext', title: 'Finext', list: FINEXT_INDEXES },
  ];

  if (isMobile) {
    const slides = tables.map((t) => ({
      id: t.id,
      component: (
        <Box>
          <Typography sx={{ ...titleSx, ml: 1 }}>{t.title}</Typography>
          <IndexTable
            selectedTicker={ticker}
            onTickerChange={onTickerChange}
            indexList={t.list}
            todayAllData={todayAllData}
          />
        </Box>
      ),
    }));

    return (
      <Box sx={{ mt: 3 }}>
        <Carousel slides={slides} autoPlayInterval={0} showDots minHeight="auto" />
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      mt: 3,
      overflowX: 'auto',
      '&::-webkit-scrollbar': { display: 'none' },
      msOverflowStyle: 'none',
      scrollbarWidth: 'none',
    }}>
      {tables.map((t) => (
        <Box key={t.id} sx={{ width: 350, flexShrink: 0 }}>
          <Typography sx={titleSx}>{t.title}</Typography>
          <IndexTable
            selectedTicker={ticker}
            onTickerChange={onTickerChange}
            indexList={t.list}
            todayAllData={todayAllData}
          />
        </Box>
      ))}
    </Box>
  );
}

// ========== MAIN COMPONENT ==========
export default function MarketsContent() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [ticker, setTicker] = useState<string>('VNINDEX');
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');

  const isMountedRef = useRef<boolean>(true);
  const todaySseRef = useRef<{ unsubscribe: () => void } | null>(null);
  const itdSseRef = useRef<{ unsubscribe: () => void } | null>(null);

  // ========== STATE ==========
  const [todayAllData, setTodayAllData] = useState<IndexDataByTicker>(() => {
    const cached = getFromCache<RawMarketData[]>('home_today_index');
    if (cached && Array.isArray(cached)) {
      const grouped: IndexDataByTicker = {};
      cached.forEach((item: RawMarketData) => {
        const t = item.ticker;
        if (t) { if (!grouped[t]) grouped[t] = []; grouped[t].push(item); }
      });
      return grouped;
    }
    return {};
  });

  const [itdAllData, setItdAllData] = useState<IndexDataByTicker>(() => {
    const cached = getFromCache<RawMarketData[]>('home_itd_index');
    if (cached && Array.isArray(cached)) {
      const grouped: IndexDataByTicker = {};
      cached.forEach((item: RawMarketData) => {
        const t = item.ticker;
        if (t) { if (!grouped[t]) grouped[t] = []; grouped[t].push(item); }
      });
      return grouped;
    }
    return {};
  });

  const [eodData, setEodData] = useState<ChartData>(emptyChartData);
  const [intradayData, setIntradayData] = useState<ChartData>(emptyChartData);

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const todayCache = getFromCache<RawMarketData[]>('home_today_index');
    if (todayCache && Array.isArray(todayCache)) {
      return !todayCache.some(item => item.ticker === 'VNINDEX');
    }
    return true;
  });
  const [error, setError] = useState<string | null>(null);

  // ========== REST - History Data ==========
  const { data: historyData = [], isLoading: historyLoading } = useQuery({
    queryKey: ['market', 'history', ticker],
    queryFn: async () => {
      const response = await apiClient<RawMarketData[]>({
        url: '/api/v1/sse/rest/home_hist_index',
        method: 'GET',
        queryParams: { ticker },
        requireAuth: false
      });
      return response.data || [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // ========== SSE - Today All Indexes ==========
  useEffect(() => {
    isMountedRef.current = true;
    if (todaySseRef.current) { todaySseRef.current.unsubscribe(); todaySseRef.current = null; }

    const requestProps: ISseRequest = { url: '/api/v1/sse/stream', queryParams: { keyword: 'home_today_index' } };
    todaySseRef.current = sseClient<RawMarketData[]>(requestProps, {
      onOpen: () => { },
      onData: (receivedData) => {
        if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
          const grouped: IndexDataByTicker = {};
          receivedData.forEach((item: RawMarketData) => {
            const t = item.ticker;
            if (t) { if (!grouped[t]) grouped[t] = []; grouped[t].push(item); }
          });
          setTodayAllData(grouped);
        }
      },
      onError: (sseError) => { if (isMountedRef.current) console.warn('[SSE Today] Error:', sseError.message); },
      onClose: () => { }
    }, { cacheTtl: 5 * 60 * 1000, useCache: true });

    return () => { isMountedRef.current = false; if (todaySseRef.current) todaySseRef.current.unsubscribe(); };
  }, []);

  // ========== SSE - ITD All Indexes ==========
  useEffect(() => {
    isMountedRef.current = true;
    if (itdSseRef.current) { itdSseRef.current.unsubscribe(); itdSseRef.current = null; }

    const requestProps: ISseRequest = { url: '/api/v1/sse/stream', queryParams: { keyword: 'home_itd_index' } };
    itdSseRef.current = sseClient<RawMarketData[]>(requestProps, {
      onOpen: () => { },
      onData: (receivedData) => {
        if (isMountedRef.current && receivedData && Array.isArray(receivedData)) {
          const grouped: IndexDataByTicker = {};
          receivedData.forEach((item: RawMarketData) => {
            const t = item.ticker;
            if (t) { if (!grouped[t]) grouped[t] = []; grouped[t].push(item); }
          });
          setItdAllData(grouped);
        }
      },
      onError: (sseError) => { if (isMountedRef.current) console.warn('[SSE ITD] Error:', sseError.message); },
      onClose: () => { }
    }, { cacheTtl: 5 * 60 * 1000, useCache: true });

    return () => { isMountedRef.current = false; if (itdSseRef.current) itdSseRef.current.unsubscribe(); };
  }, []);

  // Transform ITD cho ticker hiện tại
  useEffect(() => {
    const itdDataForTicker = itdAllData[ticker] || [];
    if (itdDataForTicker.length > 0) {
      setIntradayData(transformToChartData(itdDataForTicker, true));
    } else {
      setIntradayData(emptyChartData);
    }
  }, [itdAllData, ticker]);

  // Combine History + Today -> EOD
  useEffect(() => {
    const todayDataForTicker = todayAllData[ticker] || [];
    const hasHistoryData = !historyLoading && historyData.length > 0;
    const hasTodayData = todayDataForTicker.length > 0;
    if (!hasHistoryData || !hasTodayData) return;

    const combinedRawData = [...historyData, ...todayDataForTicker];
    setEodData(transformToChartData(combinedRawData, false));
    setIsLoading(false);
  }, [historyData, todayAllData, ticker, historyLoading]);

  // Handle ticker change
  const handleTableTickerChange = (newTicker: string) => {
    setTicker(newTicker);
    setIsLoading(true);
    setEodData(emptyChartData);
    setIntradayData(emptyChartData);
  };

  // Get display name for ticker
  const indexName = useMemo(() => {
    const firstRecord = historyData[0] || todayAllData[ticker]?.[0] || itdAllData[ticker]?.[0];
    return firstRecord?.ticker_name || ticker;
  }, [historyData, todayAllData, itdAllData, ticker]);

  return (
    <Box sx={{ py: 3 }}>
      {/* ========== TOP SECTION: Chart + Detail Panel ========== */}
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: { xs: 2, md: 3 },
      }}>
        {/* Left: Chart */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <MarketIndexChart
            key={ticker}
            symbol={ticker}
            title={`Chỉ số ${indexName}`}
            eodData={eodData}
            intradayData={intradayData}
            isLoading={isLoading}
            error={error}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        </Box>

        {/* Right: Index Detail Panel */}
        <Box sx={{
          width: { xs: '100%', md: 340 },
          flexShrink: 0,
        }}>
          <IndexDetailPanel indexName={indexName} todayData={todayAllData[ticker] || []} />
        </Box>
      </Box>

      {/* ========== BOTTOM SECTION: 3 Index Tables ========== */}
      <IndexTablesSection
        ticker={ticker}
        onTickerChange={handleTableTickerChange}
        todayAllData={todayAllData}
      />
    </Box>
  );
}
