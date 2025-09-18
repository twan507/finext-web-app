'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from 'components/AuthProvider';

export default function HomePage() {
    const { session, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Đợi loading hoàn thành trước khi redirect
        if (!loading) {
            if (session && session.user) {
                // Nếu đã đăng nhập, redirect đến dashboard
                router.push('/dashboard');
            } else {
                // Nếu chưa đăng nhập, redirect đến home
                router.push('/home');
            }
        }
    }, [session, loading, router]);

    // Không hiển thị gì cả, chỉ redirect
    return null;
}
