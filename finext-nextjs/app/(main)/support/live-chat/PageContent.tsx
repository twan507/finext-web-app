'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LiveChatContent() {
  const router = useRouter();

  useEffect(() => {
    window.open('https://zalo.me/0988888156', '_blank');
    router.back();
  }, [router]);

  return null;
}
