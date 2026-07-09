// finext-nextjs/app/(main)/market-phase/hooks/useMarketPhaseData.ts
// Fetch dữ liệu page Giai đoạn thị trường — MỘT LẦN (không polling, không SSE).
import { useEffect, useState } from 'react';
import { apiClient } from 'services/apiClient';
import type { PhaseDaily, PhaseComment, PhasePerfRow } from '../types';

const REST = '/api/v1/sse/rest';

interface MarketPhaseData {
  daily: PhaseDaily[];
  comment: PhaseComment | null;
  perf: PhasePerfRow[];
  isLoading: boolean;
  error: string | null;
}

export function useMarketPhaseData(): MarketPhaseData {
  const [state, setState] = useState<MarketPhaseData>({
    daily: [],
    comment: null,
    perf: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [d, c, p] = await Promise.all([
          apiClient<PhaseDaily[]>({ url: `${REST}/phase_daily`, method: 'GET', requireAuth: false, useCache: true }),
          apiClient<PhaseComment[]>({ url: `${REST}/phase_comment`, method: 'GET', requireAuth: false, useCache: true }),
          apiClient<PhasePerfRow[]>({ url: `${REST}/phase_perf`, method: 'GET', requireAuth: false, useCache: true }),
        ]);
        if (!mounted) return;
        setState({
          daily: d.data ?? [],
          comment: c.data && c.data.length > 0 ? c.data[0] : null,
          perf: p.data ?? [],
          isLoading: false,
          error: null,
        });
      } catch (err: unknown) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'Không tải được dữ liệu';
        setState((s) => ({ ...s, isLoading: false, error: message }));
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
