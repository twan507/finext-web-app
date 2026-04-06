'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/home');
  }, [router]);

  // Không render gì — redirect gần như tức thì
  return null;
}
