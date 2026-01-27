// finext-nextjs/components/auth/OptionalAuthWrapper.tsx
'use client';

import { useAuth } from './AuthProvider';
import { Box, Skeleton } from '@mui/material';
import { ReactNode } from 'react';

interface OptionalAuthWrapperProps {
    children: ReactNode;
    /**
     * Nếu true, sẽ hiển thị skeleton thay vì spinner khi loading
     * Nếu false, sẽ render children ngay cả khi đang loading (tốt cho public pages)
     */
    requireAuth?: boolean;
    /**
     * Fallback component hiển thị khi loading (chỉ dùng khi requireAuth=true)
     */
    fallback?: ReactNode;
}

/**
 * Wrapper component giúp public routes không phải đợi auth loading
 * - Public routes: render ngay children, auth state sẽ được hydrate sau
 * - Protected routes: hiển thị fallback trong khi loading
 */
export function OptionalAuthWrapper({
    children,
    requireAuth = false,
    fallback
}: OptionalAuthWrapperProps) {
    const { loading } = useAuth();

    // Public routes: không cần đợi auth
    if (!requireAuth) {
        return <>{children}</>;
    }

    // Protected routes: hiển thị fallback khi loading
    if (loading) {
        return fallback || <DefaultAuthSkeleton />;
    }

    return <>{children}</>;
}

function DefaultAuthSkeleton() {
    return (
        <Box sx={{ p: 3 }}>
            <Skeleton variant="rectangular" height={60} sx={{ mb: 2, borderRadius: 1 }} />
            <Skeleton variant="rectangular" height={200} sx={{ mb: 2, borderRadius: 1 }} />
            <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 1 }} />
        </Box>
    );
}

export default OptionalAuthWrapper;
