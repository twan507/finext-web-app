'use client';

import React, { useEffect, useState } from 'react';
import { Box, Typography, Stack, LinearProgress, Alert, Skeleton } from '@mui/material';
import { useAuth } from '@/components/auth/AuthProvider';
import { fetchQuota, type QuotaStatus, type QuotaWindow } from 'services/chatQuota';
import { borderRadius, fontWeight } from 'theme/tokens';

const TIER_LABELS: Record<QuotaStatus['tier'], string> = {
    standard: 'Tiêu chuẩn',
    advanced: 'Nâng cao',
    unlimited: 'Không giới hạn',
};

// Khoảng thời gian từ bây giờ đến reset_at, dạng "X giờ Y phút" / "X phút".
function formatTimeUntil(resetAt: string): string | null {
    const diffMs = new Date(resetAt).getTime() - Date.now();
    if (Number.isNaN(diffMs) || diffMs <= 0) return null;
    const totalMinutes = Math.ceil(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
}

function progressColor(ratio: number): 'primary' | 'warning' | 'error' {
    if (ratio >= 1) return 'error';
    if (ratio >= 0.9) return 'warning';
    return 'primary';
}

function QuotaBlock({ title, data }: { title: string; data: QuotaWindow }) {
    const ratio = data.limit > 0 ? data.used / data.limit : 0;
    const value = Math.min(100, Math.max(0, ratio * 100));
    const timeUntil = data.reset_at ? formatTimeUntil(data.reset_at) : null;

    let suffix = ' · chưa sử dụng';
    if (data.reset_at) suffix = timeUntil ? ` · làm mới sau ${timeUntil}` : ' · sắp làm mới';

    return (
        <Box>
            <Typography variant="body2" sx={{ fontWeight: fontWeight.semibold, mb: 1 }}>
                {title}
            </Typography>
            <LinearProgress
                variant="determinate"
                value={value}
                color={progressColor(ratio)}
                sx={{ height: 8, borderRadius: borderRadius.full }}
            />
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.75 }}>
                {data.used.toLocaleString('vi-VN')}/{data.limit.toLocaleString('vi-VN')} token{suffix}
            </Typography>
        </Box>
    );
}

export default function PageContent() {
    const { session } = useAuth();
    const [quota, setQuota] = useState<QuotaStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!session?.user) return;
        let active = true;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchQuota();
                if (!active) return;
                if (data) setQuota(data);
                else setError('Không tải được hạn mức. Vui lòng thử lại sau.');
            } catch (err: any) {
                if (!active) return;
                setError(err?.message || 'Không tải được hạn mức. Vui lòng thử lại sau.');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [session]);

    return (
        <Box sx={{ maxWidth: 600, width: '100%', color: 'text.primary' }}>
            {/* Header */}
            <Box sx={{ mb: 3 }}>
                <Typography variant="h5" component="h1" sx={{ fontWeight: fontWeight.bold }}>
                    Hạn mức trợ lý AI
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    Theo dõi lượng token bạn đã dùng và thời gian làm mới.
                </Typography>
            </Box>

            {loading && (
                <Stack spacing={3} sx={{ mt: 2 }}>
                    <Skeleton variant="rounded" height={56} />
                    <Skeleton variant="rounded" height={56} />
                </Stack>
            )}

            {!loading && error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                </Alert>
            )}

            {!loading && !error && quota && (
                <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                        Gói của bạn:{' '}
                        <Box component="span" sx={{ color: 'text.primary', fontWeight: fontWeight.semibold }}>
                            {TIER_LABELS[quota.tier]}
                        </Box>
                    </Typography>

                    {quota.unlimited ? (
                        <Typography variant="body1">Bạn đang dùng gói không giới hạn.</Typography>
                    ) : (
                        <Stack spacing={3}>
                            {quota.session && <QuotaBlock title="Phiên 5 giờ" data={quota.session} />}
                            {quota.weekly && <QuotaBlock title="Trong tuần" data={quota.weekly} />}
                        </Stack>
                    )}
                </Box>
            )}
        </Box>
    );
}
