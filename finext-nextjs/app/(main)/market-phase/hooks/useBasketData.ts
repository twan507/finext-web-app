// finext-nextjs/app/(main)/market-phase/hooks/useBasketData.ts
// Fetch dữ liệu các tab rổ (PAID) — MỘT LẦN. Tải cả 6 nguồn để chuyển tab không refetch.
import { useEffect, useState } from 'react';
import { apiClient } from 'services/apiClient';
import type { PhaseBasket, PhaseRank, PhaseCommentBasket, PhaseTrading, PhasePerfRow, PhaseIndustryRow } from '../types';

const REST = '/api/v1/sse/rest';

interface BasketData {
  basket: PhaseBasket[];
  rank: PhaseRank[];
  commentBasket: PhaseCommentBasket[];
  trading: PhaseTrading[];
  perf: PhasePerfRow[];
  industry: PhaseIndustryRow[];
  isLoading: boolean;
  error: string | null;
}

const INIT: BasketData = { basket: [], rank: [], commentBasket: [], trading: [], perf: [], industry: [], isLoading: true, error: null };

export function useBasketData(): BasketData {
  const [state, setState] = useState<BasketData>(INIT);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [b, r, cb, tr, pf, ind] = await Promise.all([
          apiClient<PhaseBasket[]>({ url: `${REST}/phase_basket`, method: 'GET', requireAuth: false, useCache: true }),
          apiClient<PhaseRank[]>({ url: `${REST}/phase_rank`, method: 'GET', requireAuth: false, useCache: true }),
          apiClient<PhaseCommentBasket[]>({ url: `${REST}/phase_comment_basket`, method: 'GET', requireAuth: false, useCache: true }),
          apiClient<PhaseTrading[]>({ url: `${REST}/phase_trading`, method: 'GET', requireAuth: false, useCache: true }),
          apiClient<PhasePerfRow[]>({ url: `${REST}/phase_perf`, method: 'GET', requireAuth: false, useCache: true }),
          apiClient<PhaseIndustryRow[]>({ url: `${REST}/phase_industry`, method: 'GET', requireAuth: false, useCache: true }),
        ]);
        if (!mounted) return;
        setState({
          basket: b.data ?? [],
          rank: r.data ?? [],
          commentBasket: cb.data ?? [],
          trading: tr.data ?? [],
          perf: pf.data ?? [],
          industry: ind.data ?? [],
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
