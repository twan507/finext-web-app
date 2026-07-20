'use client';

import { useCallback, useEffect, useState } from 'react';
import { Box, Typography, LinearProgress, Alert, Skeleton, IconButton, Tooltip } from '@mui/material';
import { RefreshOutlined } from '@mui/icons-material';
import { useAuth } from '@/components/auth/AuthProvider';
import { fetchQuota, type QuotaStatus, type QuotaWindow } from 'services/chatQuota';
import { borderRadius, fontWeight, getResponsiveFontSize } from 'theme/tokens';

const TIER_LABELS: Record<QuotaStatus['tier'], string> = {
    standard: 'Tiêu chuẩn',
    advanced: 'Nâng cao (×5)',
    unlimited: 'Không giới hạn',
};

// "Làm mới sau X giờ Y phút" (tương đối) cho phiên 5 giờ.
function resetRelative(resetAt: string | null): string {
    if (!resetAt) return 'Chưa sử dụng';
    const diffMs = new Date(resetAt).getTime() - Date.now();
    if (Number.isNaN(diffMs) || diffMs <= 0) return 'Sắp làm mới';
    const totalMin = Math.ceil(diffMs / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `Làm mới sau ${h} giờ ${m} phút` : `Làm mới sau ${m} phút`;
}

// "Làm mới Thứ Ba, 10:00" (tuyệt đối) cho hạn mức tuần.
function resetAbsolute(resetAt: string | null): string {
    if (!resetAt) return 'Chưa sử dụng';
    const d = new Date(resetAt);
    if (Number.isNaN(d.getTime())) return 'Sắp làm mới';
    const day = d.toLocaleDateString('vi-VN', { weekday: 'long' });
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `Làm mới ${day}, ${time}`;
}

function barColor(ratio: number): 'primary' | 'warning' | 'error' {
    if (ratio >= 1) return 'error';
    if (ratio >= 0.9) return 'warning';
    return 'primary';
}

// 1 hàng usage: nhãn trái (tên + mốc reset) · thanh tiến trình · chỉ số phải (% hoặc ∞).
function UsageRow({ name, sub, value, right, color }: {
    name: string;
    sub: string;
    value: number;
    right: React.ReactNode;
    color: 'primary' | 'warning' | 'error';
}) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 3 }, py: 1.5 }}>
            {/* Cột nhãn đủ rộng để "Làm mới sau X giờ Y phút" nằm gọn một dòng ở màn hình lớn;
                trên mobile hẹp thì vẫn cho xuống dòng để không tràn. */}
            <Box sx={{ width: { xs: 120, sm: 210 }, flexShrink: 0 }}>
                <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.semibold }}>{name}</Typography>
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', mt: 0.25, whiteSpace: { xs: 'normal', sm: 'nowrap' } }}>{sub}</Typography>
            </Box>
            <LinearProgress
                variant="determinate"
                value={value}
                color={color}
                sx={{ flex: 1, height: 8, borderRadius: borderRadius.full }}
            />
            <Box sx={{ minWidth: 72, textAlign: 'right', flexShrink: 0 }}>{right}</Box>
        </Box>
    );
}

const INFINITY = (
    <Typography component="span" sx={{ fontSize: '1.25rem', lineHeight: 1, color: 'primary.main', fontWeight: fontWeight.semibold }}>
        ∞
    </Typography>
);

function pctLabel(w: QuotaWindow): React.ReactNode {
    const ratio = w.limit > 0 ? w.used / w.limit : 0;
    return (
        <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary', whiteSpace: 'nowrap' }}>
            {Math.min(100, Math.round(ratio * 100))}% đã dùng
        </Typography>
    );
}

export default function PageContent() {
    const { session } = useAuth();
    const [quota, setQuota] = useState<QuotaStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchQuota();
            if (data) setQuota(data);
            else setError('Không tải được hạn mức. Vui lòng thử lại sau.');
        } catch {
            setError('Không tải được hạn mức. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (session?.user) void load();
    }, [session, load]);

    const tier = quota?.tier ?? 'standard';
    const unlimited = quota?.unlimited ?? false;

    return (
        <Box sx={{ maxWidth: 880, width: '100%', color: 'text.primary' }}>
            {/* Tiêu đề + badge bậc */}
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
                <Typography component="h1" sx={{ fontSize: getResponsiveFontSize('h4'), fontWeight: fontWeight.bold }}>
                    Hạn mức sử dụng
                </Typography>
                {quota && (
                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary', fontWeight: fontWeight.medium }}>
                        {TIER_LABELS[tier]}
                    </Typography>
                )}
            </Box>

            {loading && (
                <Box sx={{ mt: 1 }}>
                    <Skeleton variant="rounded" height={40} sx={{ mb: 2 }} />
                    <Skeleton variant="rounded" height={40} />
                </Box>
            )}

            {!loading && error && <Alert severity="error">{error}</Alert>}

            {!loading && !error && quota && (
                <>
                    {/* Phiên hiện tại */}
                    <UsageRow
                        name="Phiên hiện tại"
                        sub={unlimited ? '' : resetRelative(quota.session?.reset_at ?? null)}
                        value={unlimited || !quota.session ? 0 : Math.min(100, (quota.session.used / Math.max(1, quota.session.limit)) * 100)}
                        right={unlimited || !quota.session ? INFINITY : pctLabel(quota.session)}
                        color={quota.session ? barColor(quota.session.used / Math.max(1, quota.session.limit)) : 'primary'}
                    />

                    {/* Hạn mức tuần */}
                    <Typography sx={{ fontSize: getResponsiveFontSize('md'), fontWeight: fontWeight.semibold, mt: 3, mb: 0.5 }}>
                        Hạn mức tuần
                    </Typography>
                    <UsageRow
                        name="Toàn bộ"
                        sub={unlimited ? '' : resetAbsolute(quota.weekly?.reset_at ?? null)}
                        value={unlimited || !quota.weekly ? 0 : Math.min(100, (quota.weekly.used / Math.max(1, quota.weekly.limit)) * 100)}
                        right={unlimited || !quota.weekly ? INFINITY : pctLabel(quota.weekly)}
                        color={quota.weekly ? barColor(quota.weekly.used / Math.max(1, quota.weekly.limit)) : 'primary'}
                    />

                    {/* Footer: cập nhật + làm mới */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 4, color: 'text.secondary' }}>
                        <Typography sx={{ fontSize: getResponsiveFontSize('xs') }}>Cập nhật lần cuối: vừa xong</Typography>
                        <Tooltip title="Làm mới" placement="top">
                            <IconButton size="small" onClick={() => void load()} aria-label="Làm mới" sx={{ color: 'text.secondary' }}>
                                <RefreshOutlined sx={{ fontSize: 16 }} />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </>
            )}
        </Box>
    );
}
