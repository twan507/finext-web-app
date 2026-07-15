'use client';

import { useEffect, useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { AddCommentOutlined } from '@mui/icons-material';
import OptionalAuthWrapper from 'components/auth/OptionalAuthWrapper';
import { useAuth } from 'components/auth/AuthProvider';
import useChatStore from '../../../hooks/useChatStore';
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
  // null = chưa biết (trước mount) → chặn flash composer/modal cho cả 2 phía cổng consent.
  const [consented, setConsented] = useState<boolean | null>(null);
  useEffect(() => {
    // Chỉ xét consent khi đã đăng nhập; logged-out để blur gate của OptionalAuthWrapper lo.
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 140px)', minHeight: 0 }}>
      {(store.asOf || hasMessages) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <AsOfChip asOf={store.asOf} />
          {hasMessages && (
            <Tooltip title="Cuộc trò chuyện mới" placement="bottom">
              <IconButton size="small" onClick={store.newChat} sx={{ ml: 'auto', color: 'text.secondary' }}>
                <AddCommentOutlined sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}
      {/* MessageList tự sở hữu scroll container (height:1; overflowY:auto) + pin-to-bottom —
          box này KHÔNG set overflow để tránh double-scroll lồng nhau; chỉ làm flex cho con lấp đầy. */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {hasMessages ? (
          <MessageList messages={store.messages} onRetry={store.retry} error={store.error} />
        ) : (
          <EmptyState onPick={store.send} />
        )}
      </Box>
      <Composer disabled={consented !== true || streaming} streaming={streaming} onSend={store.send} onStop={store.stop} />
      {session && <ConsentModal open={consented === false} onAccept={accept} />}
    </Box>
  );
}

export default function PageContent() {
  return (
    <Box sx={{ py: 2 }}>
      <OptionalAuthWrapper requireAuth loadingFallback={<ChatSkeleton />}>
        <ChatApp />
      </OptionalAuthWrapper>
    </Box>
  );
}
