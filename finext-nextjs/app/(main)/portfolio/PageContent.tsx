'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Box, Drawer, IconButton, Popover, Typography, alpha, useTheme } from '@mui/material';
import { AddCommentOutlined, HistoryOutlined, ViewListOutlined, WarningAmberOutlined, InfoOutlined } from '@mui/icons-material';
import { layoutTokens, getResponsiveFontSize, fontWeight } from 'theme/tokens';
import { apiClient } from 'services/apiClient';
import OptionalAuthWrapper from 'components/auth/OptionalAuthWrapper';
import { ADVANCED_AND_ABOVE_STRICT } from '@/components/auth/features';
import { useAuth } from 'components/auth/AuthProvider';
import useChatStore from '../../../hooks/useChatStore';
import MessageList from '../chat/components/MessageList';
import Composer from '../chat/components/Composer';
import ConversationSidebar from '../chat/components/ConversationSidebar';
import ChatGreeting from '../chat/components/EmptyState';
import AddWatchlistDialog from '../watchlist/components/AddWatchlistDialog';
import ConfirmDialog from '../watchlist/components/ConfirmDialog';
import PageTabs from '../watchlist/components/PageTabs';
import { applyPageReorder } from '../watchlist/components/pageReorder';
import WatchlistNameList from './components/WatchlistNameList';
import WatchlistStocks from './components/WatchlistStocks';
import { useWatchlistData, wlId, type Watchlist, type WatchlistSort } from './useWatchlistData';
import { usePortfolioPhase } from './usePortfolioPhase';
import { buildPortfolioContext } from './portfolioContext';
import { portfolioTitle, PORTFOLIO_PLACEHOLDER, PORTFOLIO_PLACEHOLDER_MOBILE } from './portfolioMeta';

// Chiều cao khả kiến dưới appbar — ép workspace kéo hết viewport (cột & line chạm đáy màn).
const VIEWPORT = `calc(100dvh - ${layoutTokens.appBarHeight}px - env(titlebar-area-height, 0px))`;
const NAMES = { def: 208, min: 150, max: 340 };
const STOCKS = { def: 300, min: 220, max: 520 };
const LS_NAMES = 'finext-pf-namesW';
const LS_STOCKS = 'finext-pf-stocksW';

// Tay kéo giữa 2 cột trái để co giãn chiều rộng (desktop). Vạch chia luôn hiện, sáng lên khi hover/kéo.
function Resizer({ width, onWidth, min, max }: { width: number; onWidth: (w: number) => void; min: number; max: number }) {
  const start = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const move = (ev: PointerEvent) => onWidth(Math.min(max, Math.max(min, startW + ev.clientX - startX)));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
  return (
    <Box
      onPointerDown={start}
      role="separator"
      aria-orientation="vertical"
      sx={{
        display: { xs: 'none', md: 'block' }, position: 'relative', width: '7px', flexShrink: 0, cursor: 'col-resize',
        '&::before': { content: '""', position: 'absolute', top: 0, bottom: 0, left: '3px', width: '1px', bgcolor: 'divider', transition: 'background-color .15s, box-shadow .15s' },
        '&:hover::before, &:active::before': { bgcolor: 'primary.main', boxShadow: (t) => `0 0 5px ${alpha(t.palette.primary.main, 0.6)}` },
      }}
    />
  );
}

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
  const { session } = useAuth();
  const { watchlists, setWatchlists, loading, refetch, stockDataMap, allTickers, industries } = useWatchlistData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false); // Drawer danh mục (mobile)
  const [histAnchor, setHistAnchor] = useState<HTMLElement | null>(null); // popover lịch sử
  const [createOpen, setCreateOpen] = useState(false); // dialog tạo WL (render 1 bản duy nhất ở đây)
  const [namesW, setNamesW] = useState(NAMES.def);
  const [stocksW, setStocksW] = useState(STOCKS.def);
  const phase = usePortfolioPhase(); // headless → nhồi page_context, không hiện tag

  // Khôi phục chiều rộng đã kéo (localStorage) sau mount → tránh lệch SSR.
  useEffect(() => {
    try {
      const n = Number(localStorage.getItem(LS_NAMES));
      if (n >= NAMES.min && n <= NAMES.max) setNamesW(n);
      const s = Number(localStorage.getItem(LS_STOCKS));
      if (s >= STOCKS.min && s <= STOCKS.max) setStocksW(s);
    } catch { /* localStorage không khả dụng — giữ mặc định */ }
  }, []);
  const setNamesWp = useCallback((w: number) => { setNamesW(w); try { localStorage.setItem(LS_NAMES, String(w)); } catch { /* bỏ qua */ } }, []);
  const setStocksWp = useCallback((w: number) => { setStocksW(w); try { localStorage.setItem(LS_STOCKS, String(w)); } catch { /* bỏ qua */ } }, []);

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

  // FLIP "trượt xuống": gửi câu ĐẦU (empty → có tin nhắn) → composer trượt mượt từ giữa xuống đáy (giống /chat).
  const composerElRef = useRef<HTMLDivElement | null>(null);
  const emptyComposerTopRef = useRef<number | null>(null);
  const prevHasRef = useRef(hasMessages);
  const setComposerNode = useCallback((node: HTMLDivElement | null) => {
    composerElRef.current = node;
  }, []);
  useLayoutEffect(() => {
    const el = composerElRef.current;
    const prevHas = prevHasRef.current;
    prevHasRef.current = hasMessages;
    if (!el) return;
    if (!prevHas && hasMessages && emptyComposerTopRef.current != null) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const delta = emptyComposerTopRef.current - el.getBoundingClientRect().top; // âm = đi xuống
      if (!reduce && Math.abs(delta) > 8) {
        el.style.transform = `translateY(${delta}px)`;
        el.style.transition = 'none';
        void el.offsetHeight; // reflow để trình duyệt ghi nhận vị trí bắt đầu
        requestAnimationFrame(() => {
          el.style.transition = 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)';
          el.style.transform = 'translateY(0)';
          const clear = () => {
            el.style.transform = '';
            el.style.transition = '';
            el.removeEventListener('transitionend', clear);
          };
          el.addEventListener('transitionend', clear);
        });
      }
    }
    if (!hasMessages) emptyComposerTopRef.current = el.getBoundingClientRect().top; // mốc vị trí giữa
  }, [hasMessages]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setPickerOpen(false);
  }, []);

  // ── Trang WL: tab chuyển trang + lọc danh sách theo trang đang xem ──
  const [currentPage, setCurrentPage] = useState(1);
  const pages = useMemo(() => {
    const s = new Set<number>(watchlists.map((w) => w.page ?? 1));
    s.add(1);
    s.add(currentPage);
    return Array.from(s).sort((a, b) => a - b);
  }, [watchlists, currentPage]);
  const currentPageHasWl = useMemo(() => watchlists.some((w) => (w.page ?? 1) === currentPage), [watchlists, currentPage]);
  const pageWatchlists = useMemo(() => watchlists.filter((w) => (w.page ?? 1) === currentPage), [watchlists, currentPage]);

  // ── CRUD cột Cổ phiếu (optimistic + PUT/DELETE, giống /watchlist) ──
  const [deleteTarget, setDeleteTarget] = useState<Watchlist | null>(null);
  const putWl = useCallback(async (id: string, body: Record<string, unknown>) => {
    await apiClient({ url: `/api/v1/watchlists/${id}`, method: 'PUT', body, requireAuth: true });
  }, []);
  const patchLocal = useCallback((id: string, patch: Partial<Watchlist>) => {
    setWatchlists((prev) => prev.map((w) => (wlId(w) === id ? { ...w, ...patch } : w)));
  }, [setWatchlists]);
  const handleUpdateStocks = useCallback(async (wl: Watchlist, symbols: string[]) => {
    const id = wlId(wl);
    patchLocal(id, { stock_symbols: symbols });
    try { await putWl(id, { stock_symbols: symbols }); } catch { patchLocal(id, { stock_symbols: wl.stock_symbols }); }
  }, [patchLocal, putWl]);
  const handleRename = useCallback(async (wl: Watchlist, name: string) => {
    const id = wlId(wl);
    patchLocal(id, { name });
    try { await putWl(id, { name }); } catch { patchLocal(id, { name: wl.name }); }
  }, [patchLocal, putWl]);
  const handleSortChange = useCallback(async (wl: Watchlist, sort: WatchlistSort) => {
    const id = wlId(wl);
    patchLocal(id, { sort });
    try { await putWl(id, { sort }); } catch { patchLocal(id, { sort: wl.sort }); }
  }, [patchLocal, putWl]);
  const handleCollapseChange = useCallback(async (wl: Watchlist, collapsed: boolean) => {
    const id = wlId(wl);
    patchLocal(id, { collapsed });
    try { await putWl(id, { collapsed }); } catch { patchLocal(id, { collapsed: wl.collapsed }); }
  }, [patchLocal, putWl]);
  const handleDeleteConfirm = useCallback(async () => {
    const wl = deleteTarget;
    if (!wl) return;
    const id = wlId(wl);
    setWatchlists((prev) => prev.filter((w) => wlId(w) !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
    setDeleteTarget(null);
    try { await apiClient({ url: `/api/v1/watchlists/${id}`, method: 'DELETE', requireAuth: true }); } catch { refetch(); }
  }, [deleteTarget, setWatchlists, refetch]);

  // Bong bóng góc kiểu chat mobile (nền kính mờ).
  const bubbleSx = {
    width: 38, height: 38, color: 'text.primary',
    bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.7 : 0.85),
    backdropFilter: 'blur(12px)',
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.palette.mode === 'dark' ? '0 2px 10px rgba(0,0,0,0.4)' : '0 2px 10px rgba(15,23,42,0.1)',
    '&:hover': { bgcolor: theme.palette.background.paper },
  };

  const pageTabs = (
    <PageTabs
      pages={pages}
      currentPage={currentPage}
      onSelectPage={setCurrentPage}
      canAddPage={currentPageHasWl}
      onReorderPages={(m) => applyPageReorder(m, { setWatchlists, currentPage, setCurrentPage, refetch })}
      sx={{ mt: 1 }}
    />
  );
  const namesList = (
    <WatchlistNameList
      watchlists={pageWatchlists}
      loading={loading}
      stockDataMap={stockDataMap}
      selectedId={selectedId}
      onSelect={handleSelect}
      onCreate={() => setCreateOpen(true)}
      belowCreate={pageTabs}
    />
  );
  const stocks = (
    <WatchlistStocks
      wl={selectedWl}
      stockDataMap={stockDataMap}
      allTickers={allTickers}
      onUpdateStocks={handleUpdateStocks}
      onDelete={(wl) => setDeleteTarget(wl)}
      onRename={handleRename}
      onSortChange={handleSortChange}
      onCollapseChange={handleCollapseChange}
    />
  );

  return (
    <Box sx={{ display: 'flex', height: VIEWPORT, overflow: 'hidden' }}>
      {/* Cột 1 — Danh mục (chỉ tên) — desktop, co giãn được */}
      <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', width: namesW, flexShrink: 0, minHeight: 0 }}>
        <ColHead title="Danh mục" />
        <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>{namesList}</Box>
      </Box>
      <Resizer width={namesW} onWidth={setNamesWp} min={NAMES.min} max={NAMES.max} />

      {/* Cột 2 — Cổ phiếu của danh mục đang chọn — desktop, co giãn được */}
      <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', width: stocksW, flexShrink: 0, minHeight: 0 }}>
        <ColHead title="Cổ phiếu" />
        <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>{stocks}</Box>
      </Box>
      <Resizer width={stocksW} onWidth={setStocksWp} min={STOCKS.min} max={STOCKS.max} />

      {/* Cột 3 — Trò chuyện */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
        {/* Bong bóng TRÁI: mobile → Danh mục NGOÀI CÙNG TRÁI, rồi tạo hội thoại mới; desktop chỉ có tạo mới */}
        <Box sx={{ position: 'absolute', top: 16, left: 12, zIndex: 20, display: 'flex', gap: 1 }}>
          <IconButton onClick={() => setPickerOpen(true)} aria-label="Danh mục" sx={{ ...bubbleSx, display: { xs: 'inline-flex', md: 'none' } }}>
            <ViewListOutlined sx={{ fontSize: 20 }} />
          </IconButton>
          <IconButton onClick={store.newConversation} aria-label="Cuộc trò chuyện mới" sx={bubbleSx}>
            <AddCommentOutlined sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
        {/* Bong bóng PHẢI: lịch sử trò chuyện → mở cửa sổ nhỏ (popover) */}
        <IconButton onClick={(e) => setHistAnchor(e.currentTarget)} aria-label="Lịch sử trò chuyện" sx={{ ...bubbleSx, position: 'absolute', top: 16, right: 12, zIndex: 20 }}>
          <HistoryOutlined sx={{ fontSize: 20 }} />
        </IconButton>

        {hasMessages ? (
          <>
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', pt: 7.5 }}>
              <MessageList key={store.activeId} messages={store.messages} onRetry={store.retry} onFeedback={store.sendFeedback} error={store.error} pending={store.awaitingReply} scrollMode="container" />
            </Box>
            {store.limitNotice ? <Notice notice={store.limitNotice} /> : store.quotaWarn ? <Notice notice={store.quotaWarn} severity="info" /> : null}
            <Box sx={{ flexShrink: 0 }}>
              <Composer ref={setComposerNode} disabled={streaming} streaming={streaming} onSend={store.send} onStop={store.stop} thinking={store.thinking} onToggleThinking={store.toggleThinking} placeholder={PORTFOLIO_PLACEHOLDER} placeholderMobile={PORTFOLIO_PLACEHOLDER_MOBILE} />
            </Box>
          </>
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', px: 2, overflowX: 'hidden', overflowY: 'auto' }}>
            <Box sx={{ flexGrow: 2 }} />
            <Box sx={{ width: '100%', maxWidth: 760 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: { xs: 2.5, sm: 3 } }}>
                <ChatGreeting title={portfolioTitle(session?.user?.full_name)} />
                <Box sx={{ width: '100%' }}>
                  <Composer ref={setComposerNode} centered glowSize="narrow" disabled={streaming} streaming={streaming} onSend={store.send} onStop={store.stop} thinking={store.thinking} onToggleThinking={store.toggleThinking} placeholder={PORTFOLIO_PLACEHOLDER} placeholderMobile={PORTFOLIO_PLACEHOLDER_MOBILE} />
                </Box>
              </Box>
            </Box>
            <Box sx={{ flexGrow: 3 }} />
          </Box>
        )}
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

      {/* Lịch sử trò chuyện — cửa sổ nhỏ nổi (popover), không phải Drawer */}
      <Popover
        open={!!histAnchor}
        anchorEl={histAnchor}
        onClose={() => setHistAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: (t) => ({
              mt: 1, width: 272, maxHeight: '62vh', overflowY: 'auto',
              bgcolor: t.palette.mode === 'dark' ? 'rgba(22,22,26,0.85)' : 'rgba(255,255,255,0.9)',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${t.palette.divider}`, borderRadius: 2,
              boxShadow: t.palette.mode === 'dark' ? '0 8px 32px rgba(0,0,0,0.55)' : '0 8px 24px rgba(0,0,0,0.14)',
            }),
          },
        }}
      >
        <ConversationSidebar
          conversations={store.conversations}
          activeId={store.activeId}
          collapsed={false}
          loading={store.historyLoading}
          onNew={() => { store.newConversation(); setHistAnchor(null); }}
          onSelect={(id) => { store.selectConversation(id); setHistAnchor(null); }}
          onToggle={() => setHistAnchor(null)}
          onDelete={store.deleteConversation}
          onTogglePin={store.togglePin}
          onRename={store.renameConversation}
        />
      </Popover>

      {/* Dialog tạo WL — render DUY NHẤT ở đây (dùng chung cho cột desktop + Drawer mobile), tránh
          2 bản dialog/portal cùng lúc gây nháy. industries đã ổn định identity qua các nhịp SSE. */}
      <AddWatchlistDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => { setCreateOpen(false); refetch(); }}
        defaultCoordinate={[0, 0]}
        defaultPage={currentPage}
        editingWatchlist={null}
        industries={industries}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Xóa danh mục"
        message={`Xóa danh mục "${deleteTarget?.name ?? ''}"? Hành động này không thể hoàn tác.`}
      />
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
