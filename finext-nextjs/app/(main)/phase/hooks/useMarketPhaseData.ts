// finext-nextjs/app/(main)/phase/hooks/useMarketPhaseData.ts
// Fetch dữ liệu page Giai đoạn thị trường — MỘT LẦN (không polling, không SSE).
import { useEffect, useState } from 'react';
import { apiClient, hasFreshCache } from 'services/apiClient';
import type { PhaseDaily, PhaseComment, PhasePerfRow, PhaseCommentIndicator, PhaseTrading } from '../types';

const REST = '/api/v1/sse/rest';

// Dùng để biết lượt đầu có được phục vụ từ cache không (quyết định có làm mới nền).
const URLS = [
  `${REST}/phase_daily`,
  `${REST}/phase_comment`,
  `${REST}/phase_perf`,
  `${REST}/phase_comment_indicator`,
  `${REST}/phase_trading`,
];

interface MarketPhaseData {
  daily: PhaseDaily[];
  comment: PhaseComment | null;
  perf: PhasePerfRow[];
  indicators: PhaseCommentIndicator[];
  trading: PhaseTrading[];
  isLoading: boolean;
  error: string | null;
}

export function useMarketPhaseData(): MarketPhaseData {
  const [state, setState] = useState<MarketPhaseData>({
    daily: [],
    comment: null,
    perf: [],
    indicators: [],
    trading: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    const load = async (skipCache: boolean) => {
      const [d, c, p, ind, tr] = await Promise.all([
        apiClient<PhaseDaily[]>({ url: `${REST}/phase_daily`, method: 'GET', requireAuth: false, useCache: true, skipCache }),
        apiClient<PhaseComment[]>({ url: `${REST}/phase_comment`, method: 'GET', requireAuth: false, useCache: true, skipCache }),
        apiClient<PhasePerfRow[]>({ url: `${REST}/phase_perf`, method: 'GET', requireAuth: false, useCache: true, skipCache }),
        // Keyword mới — nếu BE chưa restart sẽ lỗi; cho fail an toàn để không vỡ cả tab.
        apiClient<PhaseCommentIndicator[]>({ url: `${REST}/phase_comment_indicator`, method: 'GET', requireAuth: false, useCache: true, skipCache }).catch(
          () => ({ data: [] as PhaseCommentIndicator[] }),
        ),
        apiClient<PhaseTrading[]>({ url: `${REST}/phase_trading`, method: 'GET', requireAuth: false, useCache: true, skipCache }),
      ]);
      if (!mounted) return;
      // Chỉ giữ diễn giải chỉ số của phiên mới nhất.
      const indRows = ind.data ?? [];
      const maxD = indRows.reduce((m, r) => (r.date > m ? r.date : m), '');
      setState({
        daily: d.data ?? [],
        comment: c.data && c.data.length > 0 ? c.data[0] : null,
        perf: p.data ?? [],
        indicators: indRows.filter((r) => r.date === maxD),
        trading: tr.data ?? [],
        isLoading: false,
        error: null,
      });
    };

    (async () => {
      try {
        // Stale-while-revalidate: lượt đầu cho phép lấy từ cache để render tức thì
        // (quay lại trang không bị màn hình trắng), sau đó làm mới nền để không hiển
        // thị số cũ. Chỉ làm mới nền khi lượt đầu THỰC SỰ đến từ cache — cache miss
        // thì load(false) đã đi mạng rồi, gọi lại chỉ tốn request.
        const servedFromCache = URLS.every((u) => hasFreshCache(u));
        await load(false);
        if (servedFromCache && mounted) {
          // Lỗi khi làm mới nền: giữ nguyên dữ liệu cache đang hiển thị, không phá UI.
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
