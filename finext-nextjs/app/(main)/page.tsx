'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from 'components/AuthProvider';

export default function HomePage() {
    const { session, loading } = useAuth();
    const router = useRouter();

    // Không hiển thị gì cả, chỉ redirect
    return null;
}
