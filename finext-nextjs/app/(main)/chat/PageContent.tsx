'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Box, CircularProgress, Drawer, IconButton, Typography, alpha, useTheme } from '@mui/material';
import { AddCommentOutlined, HistoryOutlined, InfoOutlined, WarningAmberOutlined } from '@mui/icons-material';
import { layoutTokens, getResponsiveFontSize, fontWeight } from 'theme/tokens';
import OptionalAuthWrapper from 'components/auth/OptionalAuthWrapper';
import { useAuth } from 'components/auth/AuthProvider';
import useChatStore from '../../../hooks/useChatStore';
import ConversationSidebar from './components/ConversationSidebar';
import MessageList from './components/MessageList';
import Composer from './components/Composer';
import ChatGreeting from './components/EmptyState';
import AsOfChip from './components/AsOfChip';
import ChatSkeleton from './components/ChatSkeleton';

// Chiều cao khả kiến dưới appbar (appbar là sticky top). Dùng cho panel lịch sử sticky + empty state.
const VIEWPORT = `calc(100dvh - ${layoutTokens.appBarHeight}px - env(titlebar-area-height, 0px))`;

// Thanh thông báo nhỏ NGAY TRÊN ô chat khi chạm limit / server quá tải (kèm link xem chi tiết nếu là limit user).
// severity='info' dùng cho nhắc sớm 50%/75%: nhẹ nhàng hơn vì user vẫn chat tiếp được bình thường.
function LimitNotice({ notice, severity = 'warning' }: { notice: { message: string; detail: boolean }; severity?: 'warning' | 'info' }) {
    const Icon = severity === 'info' ? InfoOutlined : WarningAmberOutlined;
    return (
        <Box sx={{ px: { xs: 2, md: 3 } }}>
            <Box
                sx={(t) => ({
                    maxWidth: 760,
                    mx: 'auto',
                    mb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.75,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: alpha(t.palette[severity].main, t.palette.mode === 'dark' ? 0.18 : 0.12),
                    border: `1px solid ${alpha(t.palette[severity].main, 0.3)}`,
                })}
            >
                <Icon sx={{ fontSize: 18, color: `${severity}.main`, flexShrink: 0 }} />
                <Typography sx={{ flex: 1, minWidth: 0, fontSize: getResponsiveFontSize('sm'), color: 'text.primary' }}>{notice.message}</Typography>
                {notice.detail && (
                    <Box
                        component={Link}
                        href="/profile/ai-usage"
                        sx={{ flexShrink: 0, fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.medium, color: 'primary.main', textDecoration: 'none', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}
                    >
                        Xem chi tiết
                    </Box>
                )}
            </Box>
        </Box>
    );
}

function ChatApp({ initialConversationId }: { initialConversationId?: string }) {
  // Consent: KHÔNG cần pop-up — người dùng đã đồng ý khi tạo tài khoản (điều khoản + /policies/privacy).
  const store = useChatStore(initialConversationId);
  const { session } = useAuth();
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false); // Drawer lịch sử (mobile)
  // Bong bóng góc (mobile): nền glass nhẹ, hợp giao diện chung.
  const bubbleSx = {
    pointerEvents: 'auto' as const,
    width: 38,
    height: 38,
    color: 'text.primary',
    bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.7 : 0.85),
    backdropFilter: 'blur(12px)',
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.palette.mode === 'dark' ? '0 2px 10px rgba(0,0,0,0.4)' : '0 2px 10px rgba(15,23,42,0.1)',
    '&:hover': { bgcolor: theme.palette.background.paper }
  };
  const streaming = store.phase !== 'idle';
  const hasMessages = store.messages.length > 0;

  // URL riêng mỗi hội thoại: /chat/{serverId} khi đã lưu, /chat khi chat mới. replaceState → KHÔNG điều hướng
  // lại, KHÔNG remount, KHÔNG giật UI người dùng đang thao tác.
  const activeServerId = store.conversations.find((c) => c.id === store.activeId)?.serverId ?? null;
  const initialPendingRef = useRef(!!initialConversationId);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeServerId) initialPendingRef.current = false;
    // Đừng hạ URL về /chat khi vẫn đang chờ mở hội thoại ban đầu (tránh nháy /chat/{id} → /chat → /chat/{id}).
    if (!activeServerId && initialPendingRef.current) return;
    const target = activeServerId ? `/chat/${activeServerId}` : '/chat';
    if (window.location.pathname !== target) window.history.replaceState(null, '', target);
  }, [activeServerId]);

  // FLIP "trượt xuống": khi gửi câu ĐẦU (empty → có tin nhắn), composer trượt mượt từ vị trí giữa
  // xuống đáy thay vì nhảy tức thì. Đo vị trí thật (không phụ thuộc kích thước màn hình).
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

  return (
    <Box sx={{ display: 'flex', flex: 1 }}>
      {/* MOBILE: 2 bong bóng góc trên — trái = hội thoại mới, phải = lịch sử (mở Drawer). Ẩn ở >=md (đã có sidebar). */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          top: `calc(${layoutTokens.appBarHeight}px + 10px)`,
          left: 0,
          right: 0,
          px: 1.5,
          justifyContent: 'space-between',
          zIndex: 20,
          pointerEvents: 'none'
        }}
      >
        <IconButton onClick={store.newConversation} aria-label="Cuộc trò chuyện mới" sx={bubbleSx}>
          <AddCommentOutlined sx={{ fontSize: 20 }} />
        </IconButton>
        <IconButton onClick={() => setHistoryOpen(true)} aria-label="Lịch sử trò chuyện" sx={bubbleSx}>
          <HistoryOutlined sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* Drawer lịch sử (mobile): dùng lại ConversationSidebar; chọn/tạo mới → đóng Drawer. */}
      <Drawer anchor="right" open={historyOpen} onClose={() => setHistoryOpen(false)}>
        <ConversationSidebar
          conversations={store.conversations}
          activeId={store.activeId}
          collapsed={false}
          loading={store.historyLoading}
          onNew={() => {
            store.newConversation();
            setHistoryOpen(false);
          }}
          onSelect={(id) => {
            store.selectConversation(id);
            setHistoryOpen(false);
          }}
          onToggle={() => setHistoryOpen(false)}
          onDelete={store.deleteConversation}
          onTogglePin={store.togglePin}
          onRename={store.renameConversation}
        />
      </Drawer>

      {/* Panel lịch sử: DÍNH (sticky) dưới appbar, cuộn RIÊNG; ẩn <900px */}
      <Box sx={{ display: { xs: 'none', md: 'flex' }, position: 'sticky', top: layoutTokens.appBarHeight, alignSelf: 'flex-start', height: VIEWPORT }}>
        <ConversationSidebar
          conversations={store.conversations}
          activeId={store.activeId}
          collapsed={collapsed}
          loading={store.historyLoading}
          onNew={store.newConversation}
          onSelect={store.selectConversation}
          onToggle={() => setCollapsed((v) => !v)}
          onDelete={store.deleteConversation}
          onTogglePin={store.togglePin}
          onRename={store.renameConversation}
        />
      </Box>

      {/* Khu chat: TRÔI theo trang → cuộn bằng thanh cuộn TRÌNH DUYỆT; composer tự dính đáy viewport */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {store.asOf && (
          <Box sx={{ px: { xs: 2, md: 3 }, pt: 1.5 }}>
            <Box sx={{ maxWidth: 760, mx: 'auto' }}>
              <AsOfChip asOf={store.asOf} />
            </Box>
          </Box>
        )}
        {store.msgLoading ? (
          // Đang tải messages của 1 hội thoại cũ (lazy-load khi mở) — spinner ngắn.
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        ) : hasMessages ? (
          <>
            {/* Vùng tin nhắn flex:1 → đẩy composer xuống ĐÁY khi nội dung ngắn; nội dung dài thì cuộn window. */}
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <MessageList key={store.activeId} messages={store.messages} onRetry={store.retry} onFeedback={store.sendFeedback} error={store.error} pending={store.awaitingReply} />
            </Box>
            {/* Chặn (429/503) ưu tiên hơn nhắc sớm — không hiện hai thanh cùng lúc. */}
            {store.limitNotice ? <LimitNotice notice={store.limitNotice} /> : store.quotaWarn ? <LimitNotice notice={store.quotaWarn} severity="info" /> : null}
            <Composer ref={setComposerNode} disabled={streaming} streaming={streaming} onSend={store.send} onStop={store.stop} thinking={store.thinking} onToggleThinking={store.toggleThinking} />
          </>
        ) : (
          // Chưa có tin nhắn: lời chào + composer NỔI (kiểu ChatGPT/Claude), đặt ở ~40% chiều cao (spacer 2:3) — hơi cao hơn giữa. Gửi câu đầu → composer về đáy.
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', px: 2, overflow: 'hidden' }}>
            <Box sx={{ flexGrow: 2 }} />
            {/* Lời chào + Composer + GLOW CHUNG: quầng gradient nằm DƯỚI chữ, trùm cả lời chào lẫn ô nhập (không cắt ngang). */}
            <Box sx={{ position: 'relative', width: '100%', maxWidth: 760 }}>
              <Box
                aria-hidden
                sx={(t) => ({
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '135%',
                  height: '260%',
                  borderRadius: '50%',
                  background: `radial-gradient(ellipse at center, ${alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.3 : 0.17)} 0%, transparent 68%)`,
                  filter: 'blur(46px)',
                  pointerEvents: 'none',
                  zIndex: 0,
                })}
              />
              <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <ChatGreeting name={session?.user?.full_name} />
                <Box sx={{ width: '100%' }}>
                  <Composer ref={setComposerNode} centered disabled={streaming} streaming={streaming} onSend={store.send} onStop={store.stop} thinking={store.thinking} onToggleThinking={store.toggleThinking} />
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

export default function PageContent({ initialConversationId }: { initialConversationId?: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <OptionalAuthWrapper requireAuth loadingFallback={<ChatSkeleton />}>
        <ChatApp initialConversationId={initialConversationId} />
      </OptionalAuthWrapper>
    </Box>
  );
}
