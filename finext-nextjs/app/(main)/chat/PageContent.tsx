'use client';
import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import OptionalAuthWrapper from 'components/auth/OptionalAuthWrapper';
import { useAuth } from 'components/auth/AuthProvider';
import useChatStore from '../../../hooks/useChatStore';
import ConversationSidebar from './components/ConversationSidebar';
import MessageList from './components/MessageList';
import Composer from './components/Composer';
import EmptyState from './components/EmptyState';
import ConsentModal from './components/ConsentModal';
import AsOfChip from './components/AsOfChip';
import ChatSkeleton from './components/ChatSkeleton';

const CONSENT_KEY = 'finext-chat-consent';

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
    <Box sx={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Panel lịch sử ẩn trên mobile (<900px) → khu chat full width; desktop mới hiện (spec R4). */}
      <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
        <ConversationSidebar
          conversations={store.conversations}
          activeId={store.activeId}
          collapsed={collapsed}
          onNew={store.newConversation}
          onSelect={store.selectConversation}
          onToggle={() => setCollapsed((v) => !v)}
        />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {store.asOf && (
          <Box sx={{ px: 3, pt: 1.5 }}>
            <Box sx={{ maxWidth: 760, mx: 'auto' }}>
              <AsOfChip asOf={store.asOf} />
            </Box>
          </Box>
        )}
        {hasMessages ? (
          <MessageList key={store.activeId} messages={store.messages} onRetry={store.retry} error={store.error} />
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex' }}>
            <EmptyState onPick={store.send} />
          </Box>
        )}
        <Composer disabled={consented !== true || streaming} streaming={streaming} onSend={store.send} onStop={store.stop} />
      </Box>
      {session && <ConsentModal open={consented === false} onAccept={accept} />}
    </Box>
  );
}

export default function PageContent() {
  return (
    <Box sx={{ height: '100%', minHeight: 0 }}>
      <OptionalAuthWrapper requireAuth loadingFallback={<ChatSkeleton />}>
        <ChatApp />
      </OptionalAuthWrapper>
    </Box>
  );
}
