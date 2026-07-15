'use client';

import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import OptionalAuthWrapper from 'components/auth/OptionalAuthWrapper';
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
  const [consented, setConsented] = useState(true);
  useEffect(() => {
    setConsented(localStorage.getItem(CONSENT_KEY) === '1');
  }, []);
  const accept = () => {
    localStorage.setItem(CONSENT_KEY, '1');
    setConsented(true);
  };
  const streaming = store.phase !== 'idle';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 140px)', minHeight: 0 }}>
      <AsOfChip asOf={store.asOf} />
      {/* MessageList tự sở hữu scroll container (height:1; overflowY:auto) + pin-to-bottom —
          box này KHÔNG set overflow để tránh double-scroll lồng nhau; chỉ làm flex cho con lấp đầy. */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {store.messages.length === 0 ? <EmptyState onPick={store.send} /> : <MessageList messages={store.messages} onRetry={store.retry} />}
      </Box>
      <Composer disabled={!consented || streaming} streaming={streaming} onSend={store.send} onStop={store.stop} />
      <ConsentModal open={!consented} onAccept={accept} />
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
