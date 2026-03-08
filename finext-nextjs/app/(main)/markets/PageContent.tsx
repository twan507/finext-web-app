'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Box, Typography, useTheme, Skeleton, alpha } from '@mui/material';

import type { RawMarketData, ChartData, TimeRange } from '../components/marketSection/MarketIndexChart';
import { transformToChartData } from '../components/marketSection/MarketIndexChart';
import IndexTable from '../components/marketSection/IndexTable';



import BienDongSection from './components/BienDongSection';
import DongTienSection from './components/DongTienSection';
import NuocNgoaiSection from './components/NuocNgoaiSection';
import TuDoanhSection from './components/TuDoanhSection';
import TinHieuSection from './components/TinHieuSection';

import { ISseRequest } from 'services/core/types';
import { sseClient, getFromCache } from 'services/sseClient';
import { apiClient } from 'services/apiClient';
import {
  getResponsiveFontSize,
  fontWeight,
  transitions,
  layoutTokens,
} from 'theme/tokens';

// Lazy load heavy chart component
const MarketIndexChart = dynamic(
  () => import('../components/marketSection/MarketIndexChart').then(mod => ({ default: mod.default })),
  {
    loading: () => <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />,
    ssr: false
  }
);

// ========== INDEX LISTS ==========
const MARKET_INDEXES = [
  'VNINDEX',
  'FNXINDEX', 'FNX100', 'VUOTTROI', 'ONDINH', 'SUKIEN',
  'LARGECAP', 'MIDCAP', 'SMALLCAP',
];

// Type cho SSE data
type IndexDataByTicker = Record<string, RawMarketData[]>;

// Empty chart data for initial state
const emptyChartData: ChartData = {
  areaData: [],
  candleData: [],
  volumeData: []
};

// ========== SUB-NAVBAR TABS CONFIG ==========
const MARKET_TABS = [
  { id: 'volatility', label: 'Biến động' },
  { id: 'cashflow', label: 'Dòng tiền' },
  { id: 'signal', label: 'Tín hiệu' },
  { id: 'foreign', label: 'Nước ngoài' },
  { id: 'proprietary', label: 'Tự doanh' },
] as const;

type MarketTabId = typeof MARKET_TABS[number]['id'];

// ========== SUB-NAVBAR (full-width bleed) ==========
function SubNavbar({ activeTab, onTabChange }: {
  activeTab: MarketTabId;
  onTabChange: (tab: MarketTabId) => void;
}) {
  const theme = useTheme();

  return (
    <Box sx={{
      mx: { xs: 'calc(-50vw + 50%)', lg: `calc(-50vw + 50% + ${layoutTokens.compactDrawerWidth / 2}px)` },
      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
      borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
      bgcolor: theme.palette.background.default,
    }}>
      <Box sx={{
        maxWidth: 1400,
        mx: 'auto',
        px: { xs: 1.5, md: 2, lg: 3 },
        display: 'flex',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        msOverflowStyle: 'none',
      }}>
        {MARKET_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Box
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              sx={{
                px: { xs: 2, md: 2.5 },
                py: 1.5,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                position: 'relative',
                borderBottom: isActive ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                transition: transitions.colors,
                '&:hover': {
                  color: theme.palette.primary.main,
                },
              }}
            >
              <Typography sx={{
                fontSize: getResponsiveFontSize('md'),
                fontWeight: isActive ? fontWeight.semibold : fontWeight.medium,
                color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                transition: transitions.colors,
              }}>
                {tab.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}



// ========== MAIN COMPONENT ==========
export default function MarketsContent() {

  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab') as MarketTabId | null;

  const [ticker, setTicker] = useState<string>('VNINDEX');
  const [activeTab, setActiveTab] = useState<MarketTabId>(() => {
    const validTabs: MarketTabId[] = ['volatility', 'cashflow', 'signal', 'foreign', 'proprietary'];
    if (tabParam && validTabs.includes(tabParam)) return tabParam;
    return 'volatility';
  });

  // Lifted timeRange state for chart
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');

  // Sync activeTab when URL search param changes (e.g. from nav dropdown)
  useEffect(() => {
    const validTabs: MarketTabId[] = ['volatility', 'cashflow', 'signal', 'foreign', 'proprietary'];
    if (tabParam && validTabs.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (newTab: MarketTabId) => {
    setActiveTab(newTab);
    router.push(`?tab=${newTab}`, { scroll: false });
  };

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

  // ITD data (từ SSE home_itd_index - cho TẤT CẢ indexes)
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

  // Combined EOD data (history + today)
  const [eodData, setEodData] = useState<ChartData>(emptyChartData);

  // Intraday data
  const [intradayData, setIntradayData] = useState<ChartData>(emptyChartData);

  // Loading & Error states
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const todayCache = getFromCache<RawMarketData[]>('home_today_index');
    if (todayCache && Array.isArray(todayCache)) {
      const hasTodayForTicker = todayCache.some(item => item.ticker === 'VNINDEX');
      return !hasTodayForTicker;
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

  // Transform ITD data cho ticker hiện tại
  useEffect(() => {
    const itdDataForTicker = itdAllData[ticker] || [];
    if (itdDataForTicker.length > 0) {
      const transformedData = transformToChartData(itdDataForTicker, true);
      setIntradayData(transformedData);
    } else {
      setIntradayData(emptyChartData);
    }
  }, [itdAllData, ticker]);

  // ========== Combine History + Today -> EOD Data ==========
  useEffect(() => {
    const todayDataForTicker = todayAllData[ticker] || [];
    const hasHistoryData = !historyLoading && historyData.length > 0;
    const hasTodayData = todayDataForTicker.length > 0;

    if (!hasHistoryData || !hasTodayData) return;

    const combinedRawData = [...historyData, ...todayDataForTicker];
    const transformedData = transformToChartData(combinedRawData, false);
    setEodData(transformedData);
    setIsLoading(false);
  }, [historyData, todayAllData, ticker, historyLoading]);

  // ========== REST - History Index for DongTien (VNINDEX + FNXINDEX, 240 records for 1Y) ==========
  const { data: histVnindex = [] } = useQuery({
    queryKey: ['markets', 'hist_index', 'VNINDEX', 240],
    queryFn: async () => {
      const response = await apiClient<RawMarketData[]>({
        url: '/api/v1/sse/rest/home_hist_index',
        method: 'GET',
        queryParams: { ticker: 'VNINDEX', limit: 240 },
        requireAuth: false,
      });
      return response.data || [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: histFnxindex = [] } = useQuery({
    queryKey: ['markets', 'hist_index', 'FNXINDEX', 240],
    queryFn: async () => {
      const response = await apiClient<RawMarketData[]>({
        url: '/api/v1/sse/rest/home_hist_index',
        method: 'GET',
        queryParams: { ticker: 'FNXINDEX', limit: 240 },
        requireAuth: false,
      });
      return response.data || [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Build histIndexData grouped by ticker
  const histIndexData = useMemo<IndexDataByTicker>(() => ({
    VNINDEX: histVnindex,
    FNXINDEX: histFnxindex,
  }), [histVnindex, histFnxindex]);

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

  // Render active section based on tab
  const renderActiveSection = () => {
    switch (activeTab) {
      case 'volatility':
        return <BienDongSection />;
      case 'cashflow':
        return <DongTienSection histIndexData={histIndexData} todayAllData={todayAllData} />;
      case 'signal':
        return <TinHieuSection />;
      case 'foreign':
        return <NuocNgoaiSection />;
      case 'proprietary':
        return <TuDoanhSection />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ py: 3 }}>
      {/* Title */}
      <Typography variant="h1" sx={{ fontSize: getResponsiveFontSize('h1'), mb: 2 }}>
        Thị trường
      </Typography>

      {/* ========== TOP SECTION: Chart (left) + Detail Panel (right) ========== */}
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

        {/* Right: Index Table (10 indexes) */}
        <Box sx={{
          width: { xs: '100%', md: 340 },
          flexShrink: 0,
          pt: { xs: 0, md: 12 },
        }}>
          <IndexTable
            selectedTicker={ticker}
            onTickerChange={handleTableTickerChange}
            indexList={MARKET_INDEXES}
            todayAllData={todayAllData}
          />
        </Box>
      </Box>

      {/* ========== SUB-NAVBAR (full-width bleed) ========== */}
      <Box sx={{ mt: 4 }}>
        <SubNavbar activeTab={activeTab} onTabChange={handleTabChange} />
      </Box>

      {/* ========== TAB CONTENT ========== */}
      {renderActiveSection()}
    </Box>
  );
}
