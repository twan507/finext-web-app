'use client';

// Cột trái trang Tư vấn Danh mục: liệt kê watchlist của user (giống page /watchlist — giá live qua
// SSE), cho chọn 1 làm trọng tâm tư vấn và TẠO danh mục mới ngay tại đây. WL > MAX_TICKERS mã không
// cho chọn.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Typography, useTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { apiClient } from 'services/apiClient';
import { useSseCache } from 'services/sseClient';
import { useAuth } from '@/components/auth/AuthProvider';
import DotLoading from 'components/common/DotLoading';
import { fontWeight, getResponsiveFontSize, borderRadius } from 'theme/tokens';
import WatchlistColumn from '../../watchlist/components/WatchlistColumn';
import AddWatchlistDialog from '../../watchlist/components/AddWatchlistDialog';

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
  industry_name?: string;
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
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchWatchlists = useCallback(() => {
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
    fetchWatchlists();
  }, [fetchWatchlists]);

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
  // Ngành → mã (cho ô "thêm cả ngành" trong dialog tạo danh mục).
  const industries = useMemo(() => {
    const map = new Map<string, string[]>();
    (stockDataRaw ?? []).forEach((s) => {
      if (!s.industry_name) return;
      if (!map.has(s.industry_name)) map.set(s.industry_name, []);
      map.get(s.industry_name)!.push(s.ticker);
    });
    return Array.from(map.entries()).map(([name, tickers]) => ({ name, tickers: tickers.sort() })).sort((a, b) => a.name.localeCompare(b.name));
  }, [stockDataRaw]);

  const handlePick = useCallback(
    (wl: Watchlist) => {
      const id = wl.id || wl._id!;
      if (wl.stock_symbols.length > MAX_TICKERS) return; // quá dài → không chọn
      onSelect({ id, name: wl.name, stock_symbols: wl.stock_symbols });
    },
    [onSelect],
  );

  const createBtn = (
    <Button
      fullWidth
      variant="outlined"
      startIcon={<AddIcon sx={{ fontSize: 18 }} />}
      onClick={() => setDialogOpen(true)}
      sx={{ textTransform: 'none', fontWeight: fontWeight.semibold }}
    >
      Tạo danh mục mới
    </Button>
  );

  const dialog = (
    <AddWatchlistDialog
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      onSaved={() => {
        setDialogOpen(false);
        fetchWatchlists();
      }}
      defaultCoordinate={[0, 0]}
      defaultPage={1}
      editingWatchlist={null}
      industries={industries}
    />
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
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {createBtn}
        <Typography sx={{ px: 1, fontSize: getResponsiveFontSize('sm'), color: 'text.secondary', textAlign: 'center' }}>
          Bạn chưa có danh mục theo dõi. Tạo một danh mục để bắt đầu tư vấn.
        </Typography>
        {dialog}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {createBtn}
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
      {dialog}
    </Box>
  );
}
