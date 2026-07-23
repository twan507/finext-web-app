'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Box, Drawer, IconButton, Typography, alpha, useTheme } from '@mui/material';
import { AutoAwesomeRounded, AddCommentOutlined, HistoryOutlined, ViewListOutlined, WarningAmberOutlined, InfoOutlined } from '@mui/icons-material';
import { layoutTokens, getResponsiveFontSize, fontWeight } from 'theme/tokens';
import OptionalAuthWrapper from 'components/auth/OptionalAuthWrapper';
import { ADVANCED_AND_ABOVE_STRICT } from '@/components/auth/features';
import useChatStore from '../../../hooks/useChatStore';
import MessageList from '../chat/components/MessageList';
import Composer from '../chat/components/Composer';
import ConversationSidebar from '../chat/components/ConversationSidebar';
import WatchlistNameList from './components/WatchlistNameList';
import WatchlistStocks from './components/WatchlistStocks';
import { useWatchlistData, wlId } from './useWatchlistData';
import { usePortfolioPhase } from './usePortfolioPhase';
import { buildPortfolioContext } from './portfolioContext';
import { PORTFOLIO_GREETING } from './portfolioMeta';

// Chiều cao khả kiến dưới appbar — ép workspace kéo hết viewport (cột & line chạm đáy màn).
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
  const [historyOpen, setHistoryOpen] = useState(false); // Drawer lịch sử trò chuyện
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

  // Bong bóng góc kiểu chat mobile (nền kính mờ).
  const bubbleSx = {
    width: 38, height: 38, color: 'text.primary',
    bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.7 : 0.85),
    backdropFilter: 'blur(12px)',
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.palette.mode === 'dark' ? '0 2px 10px rgba(0,0,0,0.4)' : '0 2px 10px rgba(15,23,42,0.1)',
    '&:hover': { bgcolor: theme.palette.background.paper },
  };

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
    <Box sx={{ display: 'flex', height: VIEWPORT, overflow: 'hidden' }}>
      {/* Cột 1 — Danh mục (chỉ tên) — desktop */}
      <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', width: NAMES_W, flexShrink: 0, borderRight: `1px solid ${theme.palette.divider}`, minHeight: 0 }}>
        <ColHead title="Danh mục" />
        <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>{namesList}</Box>
      </Box>

      {/* Cột 2 — Cổ phiếu của danh mục đang chọn — desktop */}
      <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', width: STOCKS_W, flexShrink: 0, borderRight: `1px solid ${theme.palette.divider}`, minHeight: 0 }}>
        <ColHead title="Cổ phiếu" />
        <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>{stocks}</Box>
      </Box>

      {/* Cột 3 — Trò chuyện */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
        {/* Bong bóng: mobile mở danh mục (trái); mới + lịch sử (phải) */}
        <IconButton onClick={() => setPickerOpen(true)} aria-label="Danh mục" sx={{ ...bubbleSx, position: 'absolute', top: 10, left: 12, zIndex: 20, display: { xs: 'inline-flex', md: 'none' } }}>
          <ViewListOutlined sx={{ fontSize: 20 }} />
        </IconButton>
        <Box sx={{ position: 'absolute', top: 10, right: 12, zIndex: 20, display: 'flex', gap: 1 }}>
          <IconButton onClick={store.newConversation} aria-label="Cuộc trò chuyện mới" sx={bubbleSx}>
            <AddCommentOutlined sx={{ fontSize: 20 }} />
          </IconButton>
          <IconButton onClick={() => setHistoryOpen(true)} aria-label="Lịch sử trò chuyện" sx={bubbleSx}>
            <HistoryOutlined sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {hasMessages ? (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', pt: 6.5 }}>
            <MessageList key={store.activeId} messages={store.messages} onRetry={store.retry} onFeedback={store.sendFeedback} error={store.error} pending={store.awaitingReply} scrollMode="container" />
          </Box>
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

      {/* Mobile: Drawer danh mục + cổ phiếu (xếp dọc) */}
      <Drawer anchor="left" open={pickerOpen} onClose={() => setPickerOpen(false)}>
        <Box sx={{ width: '86vw', maxWidth: 380, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <ColHead title="Danh mục" />
          <Box sx={{ p: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>{namesList}</Box>
          <ColHead title="Cổ phiếu" />
          <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>{stocks}</Box>
        </Box>
      </Drawer>

      {/* Drawer lịch sử trò chuyện (dùng chung ConversationSidebar như chat) */}
      <Drawer anchor="right" open={historyOpen} onClose={() => setHistoryOpen(false)}>
        <ConversationSidebar
          conversations={store.conversations}
          activeId={store.activeId}
          collapsed={false}
          loading={store.historyLoading}
          onNew={() => { store.newConversation(); setHistoryOpen(false); }}
          onSelect={(id) => { store.selectConversation(id); setHistoryOpen(false); }}
          onToggle={() => setHistoryOpen(false)}
          onDelete={store.deleteConversation}
          onTogglePin={store.togglePin}
          onRename={store.renameConversation}
        />
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
