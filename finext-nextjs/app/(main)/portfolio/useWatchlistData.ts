'use client';

// Nguồn dữ liệu dùng chung cho 2 cột (tên danh mục + cổ phiếu) của trang Tư vấn Danh mục:
// danh sách WL (/watchlists/me) + giá live (SSE home_today_stock) + bản đồ tra cứu. Gọi 1 lần ở
// PageContent rồi truyền xuống — tránh subscribe/lấy trùng.
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { apiClient } from 'services/apiClient';
import { useSseCache } from 'services/sseClient';
import { useAuth } from '@/components/auth/AuthProvider';
import { buildIndustriesTop } from '../watchlist/industryStocks';

export const MAX_TICKERS = 20; // WL > 20 mã không cho tư vấn (trần ngữ cảnh + M3)

export type WatchlistSort = 'pct_change_asc' | 'pct_change_desc' | 'vsi_asc' | 'vsi_desc' | 'trading_value_asc' | 'trading_value_desc' | 'manual';

export interface Watchlist {
  id?: string;
  _id?: string;
  name: string;
  coordinate: [number, number];
  stock_symbols: string[];
  page?: number;
  sort?: WatchlistSort;
  collapsed?: boolean;
}

export interface StockData {
  ticker: string;
  ticker_name?: string;
  close: number;
  diff: number;
  pct_change: number;
  vsi: number;
  trading_value?: number;
  vsma60?: number; // KL bình quân 60 phiên — cùng close ước lượng GT giao dịch bq (thanh khoản)
  exchange?: string;
  industry_name?: string;
}

export interface IndustryInfo {
  name: string;
  tickers: string[];
}

export interface TickerOption {
  ticker: string;
  name: string;
}

export const wlId = (wl: Watchlist): string => wl.id || wl._id || '';

/** % thay đổi trung bình của một danh mục (dạng thập phân, ví dụ 0.018 = +1.8%). null nếu chưa có giá. */
export function aggregateChange(symbols: string[], map: Map<string, StockData>): number | null {
  let sum = 0;
  let n = 0;
  symbols.forEach((t) => {
    const d = map.get(t);
    if (d && d.pct_change != null) {
      sum += d.pct_change;
      n += 1;
    }
  });
  return n ? sum / n : null;
}

export interface WatchlistDataResult {
  watchlists: Watchlist[];
  setWatchlists: Dispatch<SetStateAction<Watchlist[]>>; // cho phép PageContent cập nhật optimistic khi sửa WL
  loading: boolean;
  refetch: () => void;
  stockDataMap: Map<string, StockData>;
  allTickers: TickerOption[];
  industries: IndustryInfo[];
}

export function useWatchlistData(): WatchlistDataResult {
  const { session } = useAuth();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiClient<Watchlist[]>({ url: '/api/v1/watchlists/me', method: 'GET', requireAuth: true, skipCache: true })
      .then((res) => {
        if (res.data) setWatchlists(res.data);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [session]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const { data: stockDataRaw } = useSseCache<StockData[]>({ keyword: 'home_today_stock', enabled: !!session });

  const stockDataMap = useMemo(() => {
    const map = new Map<string, StockData>();
    (stockDataRaw ?? []).forEach((s) => map.set(s.ticker, s));
    return map;
  }, [stockDataRaw]);

  // allTickers/industries chỉ phụ thuộc TẬP mã (và ngành), KHÔNG theo giá. Giá nhảy liên tục qua SSE
  // nên nếu memo theo stockDataRaw thì 2 mảng này đổi identity mỗi nhịp → dialog tạo WL + Autocomplete
  // re-render giữa lúc Fade mở → glass backdrop-filter bị re-composite → NHÁY. Khoá memo theo chữ ký
  // tập mã để giữ nguyên identity xuyên các nhịp giá.
  const rawRef = useRef(stockDataRaw);
  rawRef.current = stockDataRaw;
  const symbolsKey = useMemo(() => (stockDataRaw ?? []).map((s) => s.ticker).sort().join(','), [stockDataRaw]);
  const industryKey = useMemo(() => (stockDataRaw ?? []).map((s) => `${s.ticker}|${s.industry_name ?? ''}`).sort().join(','), [stockDataRaw]);

  const allTickers = useMemo<TickerOption[]>(
    () => (rawRef.current ?? []).map((s) => ({ ticker: s.ticker, name: s.ticker_name || '' })).sort((a, b) => a.ticker.localeCompare(b.ticker)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cố ý chỉ tính lại khi TẬP mã đổi, không theo giá
    [symbolsKey],
  );

  const industries = useMemo<IndustryInfo[]>(() => {
    // TOP 20 mã thanh khoản cao nhất mỗi ngành (buildIndustriesTop) — snapshot theo tập mã, không đổi theo giá.
    return buildIndustriesTop(rawRef.current ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cố ý chỉ tính lại khi TẬP mã/ngành đổi
  }, [industryKey]);

  return { watchlists, setWatchlists, loading, refetch, stockDataMap, allTickers, industries };
}
