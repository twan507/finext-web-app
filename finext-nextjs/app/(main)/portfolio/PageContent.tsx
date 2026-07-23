'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Box, Button, Drawer, IconButton, Typography, alpha, useTheme } from '@mui/material';
import { AddCommentOutlined, ViewListOutlined, WarningAmberOutlined, InfoOutlined } from '@mui/icons-material';
import { layoutTokens, getResponsiveFontSize, fontWeight } from 'theme/tokens';
import OptionalAuthWrapper from 'components/auth/OptionalAuthWrapper';
import { ADVANCED_AND_ABOVE_STRICT } from '@/components/auth/features';
import useChatStore from '../../../hooks/useChatStore';
import MessageList from '../chat/components/MessageList';
import Composer from '../chat/components/Composer';
import SuggestedQuestions from '../chat/components/SuggestedQuestions';
import WatchlistPicker, { type PickedWatchlist } from './components/WatchlistPicker';
import PortfolioPhaseChip, { type PortfolioPhase } from './components/PortfolioPhaseChip';
import { buildPortfolioContext } from './portfolioContext';
import { PORTFOLIO_GREETING, PORTFOLIO_SUGGESTIONS } from './portfolioMeta';

const VIEWPORT = `calc(100dvh - ${layoutTokens.appBarHeight}px - env(titlebar-area-height, 0px))`;
const PANEL_W = 320;

// Thanh nhắc hạn mức trên ô chat (chặn 429/503 = warning; nhắc sớm 50/75% = info).
function Notice({ notice, severity = 'warning' }: { notice: { message: string; detail: boolean }; severity?: 'warning' | 'info' }) {
  const Icon = severity === 'info' ? InfoOutlined : WarningAmberOutlined;
  return (
    <Box sx={{ px: { xs: 2, md: 3 } }}>
      <Box
        sx={(t) => ({
          maxWidth: 760, mx: 'auto', mb: 1, display: 'flex', alignItems: 'center', gap: 1, px: 1.75, py: 1, borderRadius: 2,
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

function PortfolioApp() {
  const theme = useTheme();
  const [selectedWl, setSelectedWl] = useState<PickedWatchlist | null>(null);
  const [phase, setPhase] = useState<PortfolioPhase | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false); // Drawer chọn danh mục (mobile)

  // Đọc lúc gửi (useChatStore lưu vào ref, cập nhật mỗi render) → luôn khớp WL + phase hiện tại.
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

  const handlePhase = useCallback((p: PortfolioPhase) => setPhase(p), []);
  const handleSelect = useCallback((wl: PickedWatchlist) => {
    setSelectedWl(wl);
    setPickerOpen(false);
  }, []);

  const pickerPanel = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: { xs: '85vw', sm: 360, md: PANEL_W } }}>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.25, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Typography sx={{ fontSize: getResponsiveFontSize('md'), fontWeight: fontWeight.bold }}>Tư vấn danh mục</Typography>
        <PortfolioPhaseChip onPhase={handlePhase} />
        <Button size="small" variant="outlined" startIcon={<AddCommentOutlined sx={{ fontSize: 18 }} />} onClick={store.newConversation}>
          Cuộc trò chuyện mới
        </Button>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
        <WatchlistPicker selectedId={selectedWl?.id ?? null} onSelect={handleSelect} />
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* MOBILE: nút mở Drawer chọn danh mục */}
      <IconButton
        onClick={() => setPickerOpen(true)}
        aria-label="Chọn danh mục"
        sx={{
          display: { xs: 'flex', md: 'none' }, position: 'fixed', top: `calc(${layoutTokens.appBarHeight}px + 10px)`, left: 12, zIndex: 20,
          width: 38, height: 38, color: 'text.primary',
          bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.7 : 0.85), backdropFilter: 'blur(12px)',
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <ViewListOutlined sx={{ fontSize: 20 }} />
      </IconButton>
      <Drawer anchor="left" open={pickerOpen} onClose={() => setPickerOpen(false)}>
        {pickerPanel}
      </Drawer>

      {/* DESKTOP: cột trái sticky */}
      <Box sx={{ display: { xs: 'none', md: 'flex' }, flexShrink: 0, position: 'sticky', top: layoutTokens.appBarHeight, alignSelf: 'flex-start', height: VIEWPORT, borderRight: `1px solid ${theme.palette.divider}` }}>
        {pickerPanel}
      </Box>

      {/* Cột phải: chat */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {hasMessages ? (
          <>
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <MessageList key={store.activeId} messages={store.messages} onRetry={store.retry} onFeedback={store.sendFeedback} error={store.error} pending={store.awaitingReply} />
            </Box>
            {store.limitNotice ? <Notice notice={store.limitNotice} /> : store.quotaWarn ? <Notice notice={store.quotaWarn} severity="info" /> : null}
            <Composer disabled={streaming} streaming={streaming} onSend={store.send} onStop={store.stop} thinking={store.thinking} onToggleThinking={store.toggleThinking} />
          </>
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', px: 2, overflowX: 'hidden', overflowY: 'auto' }}>
            <Box sx={{ flexGrow: 2 }} />
            <Box sx={{ width: '100%', maxWidth: 760 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: { xs: 2.5, sm: 3 } }}>
                <Box sx={{ textAlign: 'center', px: 2 }}>
                  <Typography sx={{ fontSize: getResponsiveFontSize('h3'), fontWeight: fontWeight.bold, mb: 1 }}>Tư vấn danh mục</Typography>
                  <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary' }}>{PORTFOLIO_GREETING}</Typography>
                </Box>
                <Box sx={{ width: '100%' }}>
                  <Composer centered disabled={streaming} streaming={streaming} onSend={store.send} onStop={store.stop} thinking={store.thinking} onToggleThinking={store.toggleThinking} />
                </Box>
                <Box sx={{ width: '100%', px: { xs: 2, md: 3 }, boxSizing: 'border-box' }}>
                  <SuggestedQuestions questions={PORTFOLIO_SUGGESTIONS} disabled={streaming} onPick={(q) => store.send(q)} />
                </Box>
              </Box>
            </Box>
            <Box sx={{ flexGrow: 3 }} />
          </Box>
        )}
      </Box>
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
