'use client';

// Cột "Cổ phiếu" của trang Tư vấn Danh mục (PA1): hiện cổ phiếu của danh mục đang chọn (tái dùng
// WatchlistColumn read-only + giá live). Chưa chọn → placeholder.
import { Box, Typography } from '@mui/material';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import { getResponsiveFontSize } from 'theme/tokens';
import WatchlistColumn from '../../watchlist/components/WatchlistColumn';
import { wlId, type Watchlist, type StockData, type TickerOption } from '../useWatchlistData';

interface Props {
  wl: Watchlist | null;
  stockDataMap: Map<string, StockData>;
  allTickers: TickerOption[];
}

const noop = () => {};

export default function WatchlistStocks({ wl, stockDataMap, allTickers }: Props) {
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
      readOnly
      forceCollapsed={false}
      onCollapseChange={noop}
      onDelete={noop}
      onRenameSubmit={noop}
      onSortChange={noop}
      onReorderStocks={noop}
      onAddStock={noop}
      onRemoveStock={noop}
    />
  );
}
