'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from 'services/apiClient';
import { sseClient } from 'services/sseClient';
import { ISseRequest } from 'services/core/types';
import { transformTrendData } from '../../markets/components/TinHieuSecion/MarketTrendChart';
import type { RawTrendData, TrendChartData, TrendTimeRange } from '../../markets/components/TinHieuSecion/MarketTrendChart';
import { useResponsiveRange } from '../hooks/useResponsiveRange';

// Biểu đồ xu hướng (reuse từ markets), chỉ feed nhóm FNXINDEX = REST history + SSE today (như page groups).
const MarketTrendChart = dynamic(() => import('../../markets/components/TinHieuSecion/MarketTrendChart'), { ssr: false });

const TICKER = 'FNXINDEX';
const EMPTY: TrendChartData = { wTrend: [], mTrend: [], qTrend: [], yTrend: [] };

export default function FnxTrendChart() {
  const [timeRange, setTimeRange] = useResponsiveRange<TrendTimeRange>('3M', '1M'); // mobile: 4 đường xu hướng đọc được ở 1M
  const [chartData, setChartData] = useState<TrendChartData>(EMPTY);
  const [isTrendLoading, setIsTrendLoading] = useState(true);

  // REST — lịch sử xu hướng
  const { data: historyTrendData = [], isLoading: historyTrendLoading } = useQuery({
    queryKey: ['market-phase', 'history_trend', TICKER],
    queryFn: async () => {
      const res = await apiClient<RawTrendData[]>({
        url: '/api/v1/sse/rest/home_history_trend',
        method: 'GET',
        queryParams: { ticker: TICKER },
        requireAuth: false,
      });
      return res.data || [];
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // SSE — dữ liệu hôm nay (lọc đúng ticker FNXINDEX)
  const [trendTodayData, setTrendTodayData] = useState<RawTrendData[]>([]);
  const mountedRef = useRef(true);
  const sseRef = useRef<{ unsubscribe: () => void } | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    if (sseRef.current) {
      sseRef.current.unsubscribe();
      sseRef.current = null;
    }
    const requestProps: ISseRequest = { url: '/api/v1/sse/stream', queryParams: { keyword: 'home_today_trend' } };
    sseRef.current = sseClient<RawTrendData[]>(requestProps, {
      onOpen: () => {},
      onData: (received) => {
        if (mountedRef.current && received && Array.isArray(received)) {
          setTrendTodayData(received.filter((item) => item.ticker === TICKER));
        }
      },
      onError: (e) => {
        if (mountedRef.current) console.warn('[SSE FnxTrend] Error:', e.message);
      },
      onClose: () => {},
    });
    return () => {
      mountedRef.current = false;
      if (sseRef.current) sseRef.current.unsubscribe();
    };
  }, []);

  // Kết hợp history + today → transform
  useEffect(() => {
    const hasHistory = !historyTrendLoading && historyTrendData.length > 0;
    if (!hasHistory) return;
    const combined = trendTodayData.length > 0 ? [...historyTrendData, ...trendTodayData] : [...historyTrendData];
    setChartData(transformTrendData(combined));
    setIsTrendLoading(false);
  }, [historyTrendData, trendTodayData, historyTrendLoading]);

  return <MarketTrendChart chartData={chartData} isLoading={isTrendLoading} timeRange={timeRange} onTimeRangeChange={setTimeRange} height={345} />;
}
