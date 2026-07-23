'use client';

// Cột "Cổ phiếu" của trang Tư vấn Danh mục (PA1): hiện cổ phiếu của danh mục đang chọn bằng
// WatchlistColumn ĐẦY ĐỦ (như /watchlist) — thêm/xóa mã, xóa WL, đổi tên, đổi sắp xếp, kéo-thả.
// Chưa chọn → placeholder.
import { Box, Typography } from '@mui/material';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import { getResponsiveFontSize } from 'theme/tokens';
import WatchlistColumn from '../../watchlist/components/WatchlistColumn';
import { wlId, type Watchlist, type StockData, type TickerOption, type WatchlistSort } from '../useWatchlistData';

interface Props {
  wl: Watchlist | null;
  stockDataMap: Map<string, StockData>;
  allTickers: TickerOption[];
  onUpdateStocks: (wl: Watchlist, symbols: string[]) => void;
  onDelete: (wl: Watchlist) => void;
  onRename: (wl: Watchlist, name: string) => void;
  onSortChange: (wl: Watchlist, sort: WatchlistSort) => void;
  onCollapseChange: (wl: Watchlist, collapsed: boolean) => void;
}

export default function WatchlistStocks({ wl, stockDataMap, allTickers, onUpdateStocks, onDelete, onRename, onSortChange, onCollapseChange }: Props) {
  if (!wl) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'text.disabled', px: 3, gap: 1 }}>
        <BarChartOutlinedIcon sx={{ fontSize: 30, opacity: 0.6 }} />
        <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>Chọn một danh mục để xem cổ phiếu</Typography>
      </Box>
    );
  }
  return (
    <WatchlistColumn
      watchlist={{ ...wl, id: wlId(wl) }}
      stockDataMap={stockDataMap}
      allTickers={allTickers}
      forceCollapsed={false}
      onCollapseChange={(c) => onCollapseChange(wl, c)}
      onDelete={() => onDelete(wl)}
      onRenameSubmit={(name) => onRename(wl, name)}
      onSortChange={(s) => onSortChange(wl, s)}
      onReorderStocks={(syms) => onUpdateStocks(wl, syms)}
      onAddStock={(t) => onUpdateStocks(wl, [...wl.stock_symbols, t])}
      onRemoveStock={(t) => onUpdateStocks(wl, wl.stock_symbols.filter((s) => s !== t))}
    />
  );
}
