// finext-nextjs/app/(main)/phase/hooks/useBasketData.ts
// Fetch dữ liệu các tab rổ (PAID) — MỘT LẦN. Tải cả 6 nguồn để chuyển tab không refetch.
import { useEffect, useState } from 'react';
import { apiClient, hasFreshCache } from 'services/apiClient';
import type { PhaseBasket, PhaseRank, PhaseCommentBasket, PhaseTrading, PhasePerfRow, PhaseIndustryRow, PhaseDaily, IndexMapRow } from '../types';

const REST = '/api/v1/sse/rest';

// Dùng để biết lượt đầu có được phục vụ từ cache không (quyết định có làm mới nền).
const URLS = [
  `${REST}/phase_basket`,
  `${REST}/phase_rank`,
  `${REST}/phase_comment_basket`,
  `${REST}/phase_trading`,
  `${REST}/phase_perf`,
  `${REST}/phase_industry`,
  `${REST}/phase_daily`,
  `${REST}/index_map`,
];

interface BasketData {
  basket: PhaseBasket[];
  rank: PhaseRank[];
  commentBasket: PhaseCommentBasket[];
  trading: PhaseTrading[];
  perf: PhasePerfRow[];
  industry: PhaseIndustryRow[];
  daily: PhaseDaily[]; // để tô màu pha cho thanh chọn phiên (SessionStrip)
  indexMap: IndexMapRow[]; // map mã ngành → tên đầy đủ (tab Sóng Ngành)
  isLoading: boolean;
  error: string | null;
}

const INIT: BasketData = { basket: [], rank: [], commentBasket: [], trading: [], perf: [], industry: [], daily: [], indexMap: [], isLoading: true, error: null };

export function useBasketData(): BasketData {
  const [state, setState] = useState<BasketData>(INIT);

  useEffect(() => {
    let mounted = true;

    const load = async (skipCache: boolean) => {
      const [b, r, cb, tr, pf, ind, dl, im] = await Promise.all([
          apiClient<PhaseBasket[]>({ url: `${REST}/phase_basket`, method: 'GET', requireAuth: false, useCache: true, skipCache }),
          apiClient<PhaseRank[]>({ url: `${REST}/phase_rank`, method: 'GET', requireAuth: false, useCache: true, skipCache }),
          apiClient<PhaseCommentBasket[]>({ url: `${REST}/phase_comment_basket`, method: 'GET', requireAuth: false, useCache: true, skipCache }),
          apiClient<PhaseTrading[]>({ url: `${REST}/phase_trading`, method: 'GET', requireAuth: false, useCache: true, skipCache }),
          apiClient<PhasePerfRow[]>({ url: `${REST}/phase_perf`, method: 'GET', requireAuth: false, useCache: true, skipCache }),
          apiClient<PhaseIndustryRow[]>({ url: `${REST}/phase_industry`, method: 'GET', requireAuth: false, useCache: true, skipCache }),
          // useCache dedupe với Tab ① (useMarketPhaseData) — chỉ để tô màu pha cho thanh chọn phiên.
          apiClient<PhaseDaily[]>({ url: `${REST}/phase_daily`, method: 'GET', requireAuth: false, useCache: true, skipCache }),
          // Keyword mới — BE chưa restart sẽ lỗi → fail an toàn (mã ngành fallback về code).
          apiClient<IndexMapRow[]>({ url: `${REST}/index_map`, method: 'GET', requireAuth: false, useCache: true, skipCache }).catch(() => ({ data: [] as IndexMapRow[] })),
      ]);
      if (!mounted) return;
      setState({
        basket: b.data ?? [],
        rank: r.data ?? [],
        commentBasket: cb.data ?? [],
        trading: tr.data ?? [],
        perf: pf.data ?? [],
        industry: ind.data ?? [],
        daily: dl.data ?? [],
        indexMap: im.data ?? [],
        isLoading: false,
        error: null,
      });
    };

    (async () => {
      try {
        // Stale-while-revalidate: lượt đầu cho phép lấy từ cache để render tức thì,
        // sau đó làm mới nền để không hiển thị số cũ. Chỉ làm mới nền khi lượt đầu
        // THỰC SỰ đến từ cache — cache miss thì load(false) đã đi mạng rồi.
        const servedFromCache = URLS.every((u) => hasFreshCache(u));
        await load(false);
        if (servedFromCache && mounted) {
          void load(true).catch(() => undefined);
        }
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
