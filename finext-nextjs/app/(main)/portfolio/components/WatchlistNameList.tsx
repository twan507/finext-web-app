'use client';

// Cột "Danh mục" của trang Tư vấn Danh mục (PA1 · 3 cột): CHỈ hiện tên + % thay đổi TB + số mã.
// Bấm một danh mục → PageContent hiện cổ phiếu ở cột giữa. WL > 20 mã bị chặn chọn. Có nút tạo mới.
import { useState } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DotLoading from 'components/common/DotLoading';
import { fontWeight, getResponsiveFontSize, borderRadius } from 'theme/tokens';
import { getTrendColor } from 'theme/colorHelpers';
import AddWatchlistDialog from '../../watchlist/components/AddWatchlistDialog';
import { MAX_TICKERS, aggregateChange, wlId, type Watchlist, type StockData, type IndustryInfo } from '../useWatchlistData';

interface Props {
  watchlists: Watchlist[];
  loading: boolean;
  stockDataMap: Map<string, StockData>;
  industries: IndustryInfo[];
  refetch: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const fmtPct = (frac: number) => `${frac >= 0 ? '+' : ''}${(frac * 100).toFixed(1)}%`;

export default function WatchlistNameList({ watchlists, loading, stockDataMap, industries, refetch, selectedId, onSelect }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [dialogOpen, setDialogOpen] = useState(false);

  // Nút tạo mới thanh lịch: khung nét đứt + quầng glow tím (đồng bộ thẩm mỹ nút tạo WL ở trang /watchlist).
  const createBtn = (
    <Box
      role="button"
      tabIndex={0}
      onClick={() => setDialogOpen(true)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDialogOpen(true); } }}
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.9,
        py: 1.1, mb: 1,
        borderRadius: `${borderRadius.md}px`,
        border: '1.5px dashed',
        borderColor: 'primary.main',
        color: 'primary.main',
        fontSize: getResponsiveFontSize('sm'),
        fontWeight: fontWeight.semibold,
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'all 0.2s',
        boxShadow: isDark
          ? '0 0 12px 2px rgba(99,102,241,0.22), inset 0 0 12px 2px rgba(99,102,241,0.08)'
          : '0 0 12px 2px rgba(99,102,241,0.14), inset 0 0 12px 2px rgba(99,102,241,0.05)',
        '& .add-ic': { color: 'primary.main', transition: 'color 0.2s' },
        '&:hover': {
          borderColor: 'primary.light',
          color: 'primary.light',
          boxShadow: isDark
            ? '0 0 20px 5px rgba(99,102,241,0.40), inset 0 0 20px 5px rgba(99,102,241,0.14)'
            : '0 0 20px 5px rgba(99,102,241,0.26), inset 0 0 20px 5px rgba(99,102,241,0.10)',
          '& .add-ic': { color: 'primary.light' },
        },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      }}
    >
      <AddIcon className="add-ic" sx={{ fontSize: 19 }} />
      Tạo danh mục mới
    </Box>
  );

  const dialog = (
    <AddWatchlistDialog
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      onSaved={() => {
        setDialogOpen(false);
        refetch();
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {createBtn}
      {watchlists.length === 0 && (
        <Typography sx={{ px: 1, py: 2, fontSize: getResponsiveFontSize('sm'), color: 'text.secondary', textAlign: 'center' }}>
          Chưa có danh mục. Tạo một danh mục để bắt đầu tư vấn.
        </Typography>
      )}
      {watchlists.map((wl) => {
        const id = wlId(wl);
        const tooLong = wl.stock_symbols.length > MAX_TICKERS;
        const active = selectedId === id;
        const agg = aggregateChange(wl.stock_symbols, stockDataMap);
        const aggColor = agg != null ? getTrendColor(agg * 100, theme) : theme.palette.text.secondary;
        return (
          <Box
            key={id}
            role="option"
            aria-selected={active}
            tabIndex={tooLong ? -1 : 0}
            onClick={() => !tooLong && onSelect(id)}
            onKeyDown={(e) => {
              if (!tooLong && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onSelect(id);
              }
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              px: 1.25,
              py: 1,
              borderRadius: `${borderRadius.md}px`,
              cursor: tooLong ? 'not-allowed' : 'pointer',
              opacity: tooLong ? 0.5 : 1,
              border: `1px solid ${active ? theme.palette.primary.main : 'transparent'}`,
              bgcolor: active ? (theme.palette.mode === 'dark' ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.08)') : 'transparent',
              transition: 'background 0.12s, border-color 0.12s',
              '&:hover': tooLong ? {} : { bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
              '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 1 },
            }}
          >
            <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.semibold, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {wl.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              {!tooLong && agg != null && (
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.bold, color: aggColor, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtPct(agg)}
                </Typography>
              )}
              <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.disabled', fontWeight: fontWeight.medium }}>
                {tooLong ? `${wl.stock_symbols.length} mã · quá dài` : `${wl.stock_symbols.length} mã`}
              </Typography>
            </Box>
          </Box>
        );
      })}
      {dialog}
    </Box>
  );
}
