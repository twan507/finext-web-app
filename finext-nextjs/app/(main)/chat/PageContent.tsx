'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, CircularProgress, alpha } from '@mui/material';
import { layoutTokens } from 'theme/tokens';
import OptionalAuthWrapper from 'components/auth/OptionalAuthWrapper';
import { useAuth } from 'components/auth/AuthProvider';
import useChatStore from '../../../hooks/useChatStore';
import ConversationSidebar from './components/ConversationSidebar';
import MessageList from './components/MessageList';
import Composer from './components/Composer';
import ChatGreeting from './components/EmptyState';
import ConsentModal from './components/ConsentModal';
import AsOfChip from './components/AsOfChip';
import ChatSkeleton from './components/ChatSkeleton';

const CONSENT_KEY = 'finext-chat-consent';
// Chiều cao khả kiến dưới appbar (appbar là sticky top). Dùng cho panel lịch sử sticky + empty state.
const VIEWPORT = `calc(100dvh - ${layoutTokens.appBarHeight}px - env(titlebar-area-height, 0px))`;

function ChatApp() {
  const store = useChatStore();
  const { session } = useAuth();
  const [consented, setConsented] = useState<boolean | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (!session) return;
    setConsented(localStorage.getItem(CONSENT_KEY) === '1');
  }, [session]);
  const accept = () => {
    localStorage.setItem(CONSENT_KEY, '1');
    setConsented(true);
  };
  const streaming = store.phase !== 'idle';
  const hasMessages = store.messages.length > 0;

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
              <MessageList key={store.activeId} messages={store.messages} onRetry={store.retry} error={store.error} />
            </Box>
            <Composer ref={setComposerNode} disabled={consented !== true || streaming} streaming={streaming} onSend={store.send} onStop={store.stop} thinking={store.thinking} onToggleThinking={store.toggleThinking} />
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
                  <Composer ref={setComposerNode} centered disabled={consented !== true || streaming} streaming={streaming} onSend={store.send} onStop={store.stop} thinking={store.thinking} onToggleThinking={store.toggleThinking} />
                </Box>
              </Box>
            </Box>
            <Box sx={{ flexGrow: 3 }} />
          </Box>
        )}
      </Box>

      {session && <ConsentModal open={consented === false} onAccept={accept} />}
    </Box>
  );
}

export default function PageContent() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <OptionalAuthWrapper requireAuth loadingFallback={<ChatSkeleton />}>
        <ChatApp />
      </OptionalAuthWrapper>
    </Box>
  );
}
