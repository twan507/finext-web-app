// finext-nextjs/components/auth/OptionalAuthWrapper.tsx
'use client';

import { useAuth } from './AuthProvider';
import { Box, Skeleton } from '@mui/material';
import { ReactNode } from 'react';
import AuthGateOverlay from './AuthGateOverlay';

interface OptionalAuthWrapperProps {
    children: ReactNode;
    /**
     * Nếu true, yêu cầu quyền truy cập (đăng nhập + feature).
     * Khi chưa có quyền → phủ blur overlay + floating modal lên content thật.
     * Content vẫn load bình thường phía dưới.
     * Nếu false, render children bình thường (public).
     */
    requireAuth?: boolean;
    /**
     * Danh sách feature keys cần check (ví dụ: ['advanced_feature', 'broker_feature']).
     * Chỉ cần user có ÍT NHẤT 1 trong các features này là được xem.
     * Nếu không truyền, chỉ check đăng nhập.
     */
    requiredFeatures?: string[];
    /**
     * Compact mode cho side panels (280px).
     * Dùng simple flex-center thay vì scroll-tracking.
     */
    compact?: boolean;
}

/**
 * Auth gate wrapper với blur overlay:
 * - Public (requireAuth=false): render children bình thường
 * - Protected (requireAuth=true):
 *   + Đang loading → hiển thị skeleton
 *   + Chưa đăng nhập hoặc thiếu feature → render children + phủ blur overlay
 *   + Đã đăng nhập + có feature → render children bình thường
 */
export function OptionalAuthWrapper({
    children,
    requireAuth = false,
    requiredFeatures,
    compact = false,
}: OptionalAuthWrapperProps) {
    const { loading, session, features } = useAuth();

    // Public: render ngay
    if (!requireAuth) {
        return <>{children}</>;
    }

    // Đang loading auth: skeleton
    if (loading) {
        return <DefaultAuthSkeleton compact={compact} />;
    }

    // Check quyền: chưa login → gate
    // Nếu có requiredFeatures → check user có ít nhất 1 feature trùng không
    const hasRequiredFeature = !requiredFeatures || requiredFeatures.length === 0
        || requiredFeatures.some(f => features.includes(f));
    const needsGate = !session || !hasRequiredFeature;

    if (needsGate) {
        return (
            <Box sx={{ position: 'relative', overflow: 'hidden', ...(compact ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : {}) }}>
                <Box sx={{ p: compact ? 0 : { xs: 3, md: 3 }, ...(compact ? { flex: 1 } : {}) }}>
                    {children}
                </Box>
                <AuthGateOverlay compact={compact} />
            </Box>
        );
    }

    // Có đầy đủ quyền → render bình thường
    return <>{children}</>;
}

function DefaultAuthSkeleton({ compact }: { compact?: boolean }) {
    if (compact) {
        return (
            <Box sx={{ p: 1 }}>
                <Skeleton variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
                <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 1 }} />
            </Box>
        );
    }
    return (
        <Box sx={{ p: 3 }}>
            <Skeleton variant="rectangular" height={60} sx={{ mb: 2, borderRadius: 1 }} />
            <Skeleton variant="rectangular" height={200} sx={{ mb: 2, borderRadius: 1 }} />
            <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 1 }} />
        </Box>
    );
}

export default OptionalAuthWrapper;
