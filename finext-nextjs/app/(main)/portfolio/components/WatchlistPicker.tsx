'use client';

// Cột trái trang Tư vấn Danh mục: liệt kê watchlist của user (giống page /watchlist — giá live qua
// SSE) và cho chọn 1 làm trọng tâm tư vấn. Watchlist > MAX_TICKERS mã không cho chọn.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { apiClient } from 'services/apiClient';
import { useSseCache } from 'services/sseClient';
import { useAuth } from '@/components/auth/AuthProvider';
import DotLoading from 'components/common/DotLoading';
import { fontWeight, getResponsiveFontSize, borderRadius } from 'theme/tokens';
import WatchlistColumn from '../../watchlist/components/WatchlistColumn';

export const MAX_TICKERS = 20; // danh mục quá dài (>20 mã) không cho tư vấn — trần cho ngữ cảnh + M3

interface StockData {
  ticker: string;
  ticker_name?: string;
  close: number;
  diff: number;
  pct_change: number;
  vsi: number;
  trading_value?: number;
  exchange?: string;
}

type WatchlistSort = 'pct_change_asc' | 'pct_change_desc' | 'vsi_asc' | 'vsi_desc' | 'trading_value_asc' | 'trading_value_desc' | 'manual';

interface Watchlist {
  id?: string;
  _id?: string;
  name: string;
  coordinate: [number, number];
  stock_symbols: string[];
  page?: number;
  sort?: WatchlistSort;
  collapsed?: boolean;
}

export interface PickedWatchlist {
  id: string;
  name: string;
  stock_symbols: string[];
}

interface Props {
  selectedId: string | null;
  onSelect: (wl: PickedWatchlist) => void;
}

const noop = () => {};

export default function WatchlistPicker({ selectedId, onSelect }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { session } = useAuth();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    if (!session) {
      setLoading(false);
      return;
    }
    apiClient<Watchlist[]>({ url: '/api/v1/watchlists/me', method: 'GET', requireAuth: true, skipCache: true })
      .then((res) => {
        if (mounted && res.data) setWatchlists(res.data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [session]);

  const { data: stockDataRaw } = useSseCache<StockData[]>({ keyword: 'home_today_stock', enabled: !!session });
  const stockDataMap = useMemo(() => {
    const map = new Map<string, StockData>();
    (stockDataRaw ?? []).forEach((s) => map.set(s.ticker, s));
    return map;
  }, [stockDataRaw]);
  const allTickers = useMemo(
    () => (stockDataRaw ?? []).map((s) => ({ ticker: s.ticker, name: s.ticker_name || '' })).sort((a, b) => a.ticker.localeCompare(b.ticker)),
    [stockDataRaw],
  );

  const handlePick = useCallback(
    (wl: Watchlist) => {
      const id = wl.id || wl._id!;
      if (wl.stock_symbols.length > MAX_TICKERS) return; // quá dài → không chọn
      onSelect({ id, name: wl.name, stock_symbols: wl.stock_symbols });
    },
    [onSelect],
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <DotLoading />
      </Box>
    );
  }

  if (watchlists.length === 0) {
    return (
      <Box sx={{ px: 2, py: 6, textAlign: 'center' }}>
        <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary' }}>
          Bạn chưa có danh mục theo dõi. Tạo một danh mục ở trang Danh sách theo dõi để bắt đầu tư vấn.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {watchlists.map((wl) => {
        const id = wl.id || wl._id!;
        const tooLong = wl.stock_symbols.length > MAX_TICKERS;
        const active = selectedId === id;
        return (
          <Box key={id}>
            <Box
              onClick={() => handlePick(wl)}
              sx={{
                borderRadius: `${borderRadius.md}px`,
                border: `2px solid ${active ? theme.palette.primary.main : 'transparent'}`,
                cursor: tooLong ? 'not-allowed' : 'pointer',
                opacity: tooLong ? 0.55 : 1,
                transition: 'border-color 0.15s',
                boxShadow: active ? (isDark ? '0 0 12px 2px rgba(99,102,241,0.35)' : '0 0 12px 2px rgba(99,102,241,0.2)') : 'none',
              }}
            >
              <WatchlistColumn
                watchlist={{ ...wl, id }}
                stockDataMap={stockDataMap}
                allTickers={allTickers}
                readOnly
                forceCollapsed={collapsed[id]}
                onCollapseChange={(c) => setCollapsed((m) => ({ ...m, [id]: c }))}
                onDelete={noop}
                onRenameSubmit={noop}
                onSortChange={noop}
                onReorderStocks={noop}
                onAddStock={noop}
                onRemoveStock={noop}
              />
            </Box>
            {tooLong && (
              <Typography sx={{ mt: 0.5, px: 0.5, fontSize: getResponsiveFontSize('xs'), color: 'warning.main', fontWeight: fontWeight.medium }}>
                Danh mục quá dài (tối đa {MAX_TICKERS} mã) — chưa hỗ trợ tư vấn.
              </Typography>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
