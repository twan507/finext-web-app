// finext-nextjs/components/auth/AuthGateOverlay.tsx
'use client';

import { Box, Typography, Button } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { useRef, useState, useEffect, useCallback } from 'react';
import { buttonSize, borderRadius, getResponsiveFontSize, getGlowButton } from 'theme/tokens';

type ModalState = 'pinned-top' | 'fixed-center' | 'pinned-bottom';

interface AuthGateOverlayProps {
    /** Compact mode: simple flex-center, no scroll tracking. For side panels. */
    compact?: boolean;
}

export default function AuthGateOverlay({ compact = false }: AuthGateOverlayProps) {
    const theme = useTheme();
    const router = useRouter();
    const { session } = useAuth();
    const isDark = theme.palette.mode === 'dark';
    const glowStyles = getGlowButton(isDark);

    const containerRef = useRef<HTMLDivElement>(null);
    const [modalState, setModalState] = useState<ModalState>('pinned-top');
    const [containerLeft, setContainerLeft] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);

    const MODAL_HEIGHT = 200;
    const PADDING = 24;         // khoảng cách kẹp biên khi pinned
    const SWITCH_THRESHOLD = 60; // ngưỡng đổi trạng thái sớm hơn

    const calcState = useCallback(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const vpCenter = window.innerHeight / 2;
        setContainerLeft(rect.left);
        setContainerWidth(rect.width);
        const modalHalf = MODAL_HEIGHT / 2;
        if (rect.top + SWITCH_THRESHOLD + modalHalf > vpCenter) setModalState('pinned-top');
        else if (rect.bottom - SWITCH_THRESHOLD - modalHalf < vpCenter) setModalState('pinned-bottom');
        else setModalState('fixed-center');
    }, []);

    useEffect(() => {
        if (compact) return; // compact mode: no scroll tracking
        calcState();
        window.addEventListener('scroll', calcState, { passive: true });
        window.addEventListener('resize', calcState, { passive: true });
        return () => {
            window.removeEventListener('scroll', calcState);
            window.removeEventListener('resize', calcState);
        };
    }, [calcState, compact]);

    const isLoggedIn = !!session;

    // ─── Positioning ───
    const positionSx = compact
        ? {} // compact: no extra positioning, parent handles centering
        : modalState === 'fixed-center'
            ? { position: 'fixed' as const, top: '50%', left: containerLeft + containerWidth / 2, transform: 'translate(-50%, -50%)', zIndex: 1100 }
            : modalState === 'pinned-bottom'
                ? { position: 'absolute' as const, bottom: PADDING, left: '50%', transform: 'translateX(-50%)' }
                : { position: 'absolute' as const, top: PADDING, left: '50%', transform: 'translateX(-50%)' };

    // ─── Render modal content ───
    const renderContent = () => {
        if (isLoggedIn) {
            return (
                <>
                    {/* === LOGGED IN: Upgrade variant === */}
                    <WorkspacePremiumOutlinedIcon
                        sx={{
                            fontSize: compact ? 40 : 56,
                            color: theme.palette.warning.main,
                            filter: `drop-shadow(0 2px 8px ${alpha(theme.palette.warning.main, 0.3)})`,
                        }}
                    />

                    <Typography sx={{ fontSize: compact ? '1rem' : { xs: '1.2rem', sm: '1.4rem' }, fontWeight: 800, color: 'text.primary', mb: 1 }}>
                        Tính năng dành riêng cho hội viên Professional
                    </Typography>

                    <Typography sx={{ fontSize: compact ? '0.75rem' : '0.85rem', color: 'text.secondary', mb: 1.5 }}>
                        Finext cung cấp cho hội viên chuyên nghiệp bộ công cụ phân tích cao cấp, giúp bạn đưa ra quyết định đầu tư chính xác và hiệu quả hơn.
                    </Typography>

                    <Button
                        size={compact ? 'small' : 'medium'}
                        variant="contained"
                        onClick={() => router.push('/plans')}
                        sx={{
                            minWidth: 100,
                            height: compact ? buttonSize.sm.height : buttonSize.md.height,
                            fontSize: getResponsiveFontSize('sm'),
                            backgroundColor: theme.palette.warning.main,
                            color: theme.palette.warning.contrastText,
                            borderRadius: `${borderRadius.md}px`,
                            textTransform: 'none',
                            px: compact ? 2 : 4,
                            boxShadow: `0 0 10px ${alpha(theme.palette.warning.main, 0.3)}, 0 0 20px ${alpha(theme.palette.warning.main, 0.12)}, 0 4px 12px ${alpha(theme.palette.warning.main, 0.2)}`,
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&:hover': {
                                backgroundColor: theme.palette.warning.dark,
                                boxShadow: `0 0 14px ${alpha(theme.palette.warning.main, 0.45)}, 0 0 28px ${alpha(theme.palette.warning.main, 0.2)}, 0 4px 16px ${alpha(theme.palette.warning.main, 0.28)}`,
                                transform: 'translateY(-1px)',
                            },
                            '&:active': { transform: 'translateY(0)' },
                        }}
                    >
                        {'Trải nghiệm ngay'}
                    </Button>

                    {!compact && (
                        <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', mt: 2, maxWidth: 340, mx: 'auto', lineHeight: 1.6 }}>
                            Hơn 10.000+ nhà đầu tư đang sử dụng các công cụ này.{'\n'}
                            Cam kết dữ liệu chính xác và hiệu quả đầu tư vượt trội.
                        </Typography>
                    )}
                </>
            );
        }

        return (
            <>
                {/* === NOT LOGGED IN: Login variant === */}
                <BarChartOutlinedIcon
                    sx={{
                        fontSize: compact ? 40 : 56,
                        color: theme.palette.primary.main,
                        filter: `drop-shadow(0 2px 8px ${alpha(theme.palette.primary.main, 0.3)})`,
                    }}
                />

                <Typography sx={{ fontSize: compact ? '1rem' : { xs: '1.2rem', sm: '1.4rem' }, fontWeight: 800, color: 'text.primary', mb: 1 }}>
                    Vui lòng đăng nhập
                </Typography>

                <Typography sx={{ fontSize: compact ? '0.75rem' : '0.85rem', color: 'text.secondary', mb: 2.5 }}>
                    Bạn cần đăng nhập để sử dụng tính năng này
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                            const callbackUrl = encodeURIComponent(window.location.pathname);
                            router.push(`/login?callbackUrl=${callbackUrl}`);
                        }}
                        sx={{
                            minWidth: 100,
                            height: buttonSize.sm.height,
                            fontSize: getResponsiveFontSize('sm'),
                            color: theme.palette.primary.main,
                            borderColor: theme.palette.primary.main,
                            borderRadius: `${borderRadius.md}px`,
                            textTransform: 'none',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&:hover': {
                                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                                borderColor: theme.palette.primary.dark,
                                color: theme.palette.primary.dark,
                                boxShadow: (glowStyles as any)['&:hover']?.boxShadow,
                                transform: 'translateY(-2px)',
                            },
                            '&:active': { transform: 'translateY(0)' },
                        }}
                    >
                        Đăng nhập
                    </Button>
                    <Button
                        size="small"
                        variant="contained"
                        onClick={() => router.push('/register')}
                        sx={{
                            minWidth: 100,
                            height: buttonSize.sm.height,
                            fontSize: getResponsiveFontSize('sm'),
                            backgroundColor: theme.palette.primary.main,
                            color: theme.palette.primary.contrastText,
                            borderRadius: `${borderRadius.md}px`,
                            textTransform: 'none',
                            ...glowStyles,
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                    >
                        Đăng ký
                    </Button>
                </Box>
            </>
        );
    };

    return (
        <Box ref={compact ? undefined : containerRef} sx={{ position: 'absolute', inset: 0, zIndex: 10 }}>
            {/* Backdrop blur */}
            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    background: compact
                        ? `${theme.palette.background.default}B3`
                        : `linear-gradient(180deg, ${theme.palette.background.default}80 0%, ${theme.palette.background.default}66 33%, ${theme.palette.background.default}4D 66%, ${theme.palette.background.default}33 100%)`,
                    backdropFilter: 'blur(10px)',
                }}
            />

            {compact ? (
                /* ── Compact: simple flex-center ── */
                <Box sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Box sx={{ textAlign: 'center', px: 2, maxWidth: 280 }}>
                        {renderContent()}
                    </Box>
                </Box>
            ) : (
                /* ── Full: scroll-tracking position ── */
                <Box ref={containerRef} sx={{ ...positionSx, textAlign: 'center', maxWidth: 540 }}>
                    {renderContent()}
                </Box>
            )}
        </Box>
    );
}
