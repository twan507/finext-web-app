'use client';
import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
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

  return (
    <Box sx={{ display: 'flex', flex: 1 }}>
      {/* Panel lịch sử: DÍNH (sticky) dưới appbar, cuộn RIÊNG; ẩn <900px */}
      <Box sx={{ display: { xs: 'none', md: 'flex' }, position: 'sticky', top: layoutTokens.appBarHeight, alignSelf: 'flex-start', height: VIEWPORT }}>
        <ConversationSidebar
          conversations={store.conversations}
          activeId={store.activeId}
          collapsed={collapsed}
          onNew={store.newConversation}
          onSelect={store.selectConversation}
          onToggle={() => setCollapsed((v) => !v)}
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
        {hasMessages ? (
          <>
            {/* Vùng tin nhắn flex:1 → đẩy composer xuống ĐÁY khi nội dung ngắn; nội dung dài thì cuộn window. */}
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <MessageList key={store.activeId} messages={store.messages} onRetry={store.retry} error={store.error} />
            </Box>
            <Composer disabled={consented !== true || streaming} streaming={streaming} onSend={store.send} onStop={store.stop} thinking={store.thinking} onToggleThinking={store.toggleThinking} />
          </>
        ) : (
          // Chưa có tin nhắn: lời chào + composer NỔI (kiểu ChatGPT/Claude), đặt ở ~40% chiều cao (spacer 2:3) — hơi cao hơn giữa. Gửi câu đầu → composer về đáy.
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', px: 2 }}>
            <Box sx={{ flexGrow: 2 }} />
            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <ChatGreeting name={session?.user?.full_name} />
              <Box sx={{ width: '100%' }}>
                <Composer centered disabled={consented !== true || streaming} streaming={streaming} onSend={store.send} onStop={store.stop} thinking={store.thinking} onToggleThinking={store.toggleThinking} />
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
