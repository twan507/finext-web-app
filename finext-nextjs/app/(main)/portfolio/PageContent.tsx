'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Box, Button, Drawer, IconButton, Typography, alpha, useTheme } from '@mui/material';
import { AutoAwesomeRounded, AddCommentOutlined, ViewListOutlined, WarningAmberOutlined, InfoOutlined } from '@mui/icons-material';
import { layoutTokens, getResponsiveFontSize, fontWeight } from 'theme/tokens';
import OptionalAuthWrapper from 'components/auth/OptionalAuthWrapper';
import { ADVANCED_AND_ABOVE_STRICT } from '@/components/auth/features';
import useChatStore from '../../../hooks/useChatStore';
import MessageList from '../chat/components/MessageList';
import Composer from '../chat/components/Composer';
import WatchlistNameList from './components/WatchlistNameList';
import WatchlistStocks from './components/WatchlistStocks';
import { useWatchlistData, wlId } from './useWatchlistData';
import { usePortfolioPhase } from './usePortfolioPhase';
import { buildPortfolioContext } from './portfolioContext';
import { PORTFOLIO_GREETING } from './portfolioMeta';

const VIEWPORT = `calc(100dvh - ${layoutTokens.appBarHeight}px - env(titlebar-area-height, 0px))`;
const NAMES_W = 208;
const STOCKS_W = 300;

// Thanh nhắc hạn mức trên ô chat (chặn 429/503 = warning; nhắc sớm 50/75% = info).
function Notice({ notice, severity = 'warning' }: { notice: { message: string; detail: boolean }; severity?: 'warning' | 'info' }) {
  const Icon = severity === 'info' ? InfoOutlined : WarningAmberOutlined;
  return (
    <Box sx={{ px: 1.5, pb: 1 }}>
      <Box
        sx={(t) => ({
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderRadius: 2,
          bgcolor: alpha(t.palette[severity].main, t.palette.mode === 'dark' ? 0.18 : 0.12),
          border: `1px solid ${alpha(t.palette[severity].main, 0.3)}`,
        })}
      >
        <Icon sx={{ fontSize: 18, color: `${severity}.main`, flexShrink: 0 }} />
        <Typography sx={{ flex: 1, minWidth: 0, fontSize: getResponsiveFontSize('sm'), color: 'text.primary' }}>{notice.message}</Typography>
        {notice.detail && (
          <Box component={Link} href="/profile/ai-usage" sx={{ flexShrink: 0, fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.medium, color: 'primary.main', textDecoration: 'none', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}>
            Xem chi tiết
          </Box>
        )}
      </Box>
    </Box>
  );
}

function ColHead({ title }: { title: string }) {
  return (
    <Box sx={{ px: 1.75, py: 1.25, borderBottom: (t) => `1px solid ${t.palette.divider}`, flexShrink: 0 }}>
      <Typography sx={{ fontSize: 11.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'text.disabled', fontWeight: fontWeight.bold }}>
        {title}
      </Typography>
    </Box>
  );
}

function PortfolioApp() {
  const theme = useTheme();
  const { watchlists, loading, refetch, stockDataMap, allTickers, industries } = useWatchlistData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false); // Drawer danh mục (mobile)
  const phase = usePortfolioPhase(); // headless → nhồi page_context, không hiện tag

  const selectedWl = useMemo(() => watchlists.find((w) => wlId(w) === selectedId) ?? null, [watchlists, selectedId]);

  const getPageContext = useCallback(() => {
    if (!selectedWl) return undefined;
    return buildPortfolioContext({
      name: selectedWl.name,
      symbols: selectedWl.stock_symbols,
      phaseLabel: phase?.label,
      exposureHint: phase?.exposureHint,
    });
  }, [selectedWl, phase]);

  const store = useChatStore(undefined, getPageContext, 'portfolio');
  const streaming = store.phase !== 'idle';
  const hasMessages = store.messages.length > 0;

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setPickerOpen(false);
  }, []);

  const namesList = (
    <WatchlistNameList
      watchlists={watchlists}
      loading={loading}
      stockDataMap={stockDataMap}
      industries={industries}
      refetch={refetch}
      selectedId={selectedId}
      onSelect={handleSelect}
    />
  );
  const stocks = <WatchlistStocks wl={selectedWl} stockDataMap={stockDataMap} allTickers={allTickers} />;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: { md: VIEWPORT } }}>
      {/* Thanh tiêu đề: icon AI phẳng + tên + nút tạo hội thoại mới (+ nút danh mục trên mobile) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: { xs: 1.5, md: 2 }, py: 1, borderBottom: `1px solid ${theme.palette.divider}`, flexShrink: 0 }}>
        <IconButton onClick={() => setPickerOpen(true)} aria-label="Danh mục" sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'text.secondary' }}>
          <ViewListOutlined sx={{ fontSize: 22 }} />
        </IconButton>
        <AutoAwesomeRounded sx={{ fontSize: 22, color: 'primary.main' }} />
        <Typography sx={{ fontSize: getResponsiveFontSize('md'), fontWeight: fontWeight.bold }}>Tư vấn danh mục</Typography>
        <Button size="small" variant="outlined" startIcon={<AddCommentOutlined sx={{ fontSize: 18 }} />} onClick={store.newConversation} sx={{ ml: 'auto', textTransform: 'none', fontWeight: fontWeight.semibold }}>
          Cuộc trò chuyện mới
        </Button>
      </Box>

      {/* Thân: 3 cột (desktop) — tên | cổ phiếu | chat */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Cột 1 — Danh mục (chỉ tên) */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', width: NAMES_W, flexShrink: 0, borderRight: `1px solid ${theme.palette.divider}`, minHeight: 0 }}>
          <ColHead title="Danh mục" />
          <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>{namesList}</Box>
        </Box>

        {/* Cột 2 — Cổ phiếu của danh mục đang chọn */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', width: STOCKS_W, flexShrink: 0, borderRight: `1px solid ${theme.palette.divider}`, minHeight: 0 }}>
          <ColHead title="Cổ phiếu" />
          <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>{stocks}</Box>
        </Box>

        {/* Cột 3 — Trò chuyện */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {hasMessages ? (
            <MessageList key={store.activeId} messages={store.messages} onRetry={store.retry} onFeedback={store.sendFeedback} error={store.error} pending={store.awaitingReply} scrollMode="container" />
          ) : (
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3, textAlign: 'center' }}>
              <Box sx={{ maxWidth: 460 }}>
                <AutoAwesomeRounded sx={{ fontSize: 34, color: 'primary.main', mb: 1 }} />
                <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary' }}>{PORTFOLIO_GREETING}</Typography>
              </Box>
            </Box>
          )}
          {store.limitNotice ? <Notice notice={store.limitNotice} /> : store.quotaWarn ? <Notice notice={store.quotaWarn} severity="info" /> : null}
          <Box sx={{ flexShrink: 0 }}>
            <Composer disabled={streaming} streaming={streaming} onSend={store.send} onStop={store.stop} thinking={store.thinking} onToggleThinking={store.toggleThinking} />
          </Box>
        </Box>
      </Box>

      {/* Mobile: Drawer chứa Danh mục + Cổ phiếu (xếp dọc) */}
      <Drawer anchor="left" open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <Box sx={{ width: '86vw', maxWidth: 380, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <ColHead title="Danh mục" />
          <Box sx={{ p: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>{namesList}</Box>
          <ColHead title="Cổ phiếu" />
          <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>{stocks}</Box>
        </Box>
      </Drawer>
    </Box>
  );
}

export default function PageContent() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <OptionalAuthWrapper requireAuth requiredFeatures={ADVANCED_AND_ABOVE_STRICT} fillHeight>
        <PortfolioApp />
      </OptionalAuthWrapper>
    </Box>
  );
}
