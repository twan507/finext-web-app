'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Box, alpha, useTheme, IconButton as MuiIconButton } from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    CandlestickChartOutlined,
    StarBorderPurple500Outlined,
    FilterAltOutlined,
} from '@mui/icons-material';
import { useAuth } from '@/components/auth/AuthProvider';
import { useSignInModal } from '@/hooks/useSignInModal';
import SignInModal from '@/app/(auth)/components/LoginModal';

const BAR_HEIGHT = 56;
const FAB_SIZE = 60;
const CURVE_DEPTH = 26; // Độ sâu lõm notch
const SCROLL_THRESHOLD = 10;

export default function MobileBottomBar() {
    const theme = useTheme();
    const router = useRouter();
    const { session } = useAuth();
    const { isOpen: isSignInOpen, openModal: openSignInModal, closeModal: closeSignInModal } = useSignInModal();
    const [visible, setVisible] = useState(true);
    const lastScrollY = useRef(0);
    const ticking = useRef(false);

    const handleScroll = useCallback(() => {
        if (ticking.current) return;
        ticking.current = true;

        requestAnimationFrame(() => {
            const currentScrollY = window.scrollY;
            const delta = currentScrollY - lastScrollY.current;

            if (Math.abs(delta) > SCROLL_THRESHOLD) {
                setVisible(delta < 0 || currentScrollY < 10);
                lastScrollY.current = currentScrollY;
            }

            ticking.current = false;
        });
    }, []);

    useEffect(() => {
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    const bgColor = theme.palette.component.appBar.background;
    const borderColor = alpha(theme.palette.divider, 0.12);

    const iconButtonSx = {
        width: 38,
        height: 38,
        borderRadius: '10px',
        color: theme.palette.text.secondary,
        transition: 'color 0.2s ease, background-color 0.2s ease',
        '&:hover': {
            color: theme.palette.primary.main,
            bgcolor: alpha(theme.palette.primary.main, 0.08),
        },
        '&:active': {
            transform: 'scale(0.92)',
        },
    };

    const handleLogoClick = useCallback(() => {
        if (session) {
            router.push('/profile');
        } else {
            openSignInModal();
        }
    }, [session, router, openSignInModal]);

    return (
        <Box
            component="nav"
            aria-label="Mobile navigation"
            sx={{
                display: { xs: 'block', md: 'none' },
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: theme.zIndex.appBar + 1,
                height: BAR_HEIGHT,
                pointerEvents: 'none',
                transform: visible ? 'translateY(0)' : `translateY(${BAR_HEIGHT}px)`,
                transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                willChange: 'transform',
            }}
        >
            {/* Nút logo ở giữa - nằm trong vùng lõm */}
            <Box
                sx={{
                    position: 'absolute',
                    bottom: BAR_HEIGHT - CURVE_DEPTH - FAB_SIZE / 2 + 16,
                    left: '50%',
                    transform: visible ? 'translateX(-50%)' : 'translateX(-50%) translateY(20px)',
                    zIndex: 3,
                    pointerEvents: 'auto',
                    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                <MuiIconButton
                    onClick={handleLogoClick}
                    aria-label="Trang cá nhân"
                    sx={{
                        width: FAB_SIZE,
                        height: FAB_SIZE,
                        borderRadius: '50%',
                        bgcolor: 'transparent',
                        boxShadow: `0 0 12px ${alpha(theme.palette.primary.main, 0.35)}, 0 0 24px ${alpha(theme.palette.primary.main, 0.15)}`,
                        overflow: 'hidden',
                        p: 0,
                        transition: 'box-shadow 0.25s ease, transform 0.2s ease',
                        '&:hover': {
                            bgcolor: 'transparent',
                            boxShadow: `0 0 16px ${alpha(theme.palette.primary.main, 0.5)}, 0 0 32px ${alpha(theme.palette.primary.main, 0.25)}`,
                            transform: 'scale(1.05)',
                        },
                        '&:active': {
                            bgcolor: 'transparent',
                            transform: 'scale(0.95)',
                        },
                    }}
                >
                    <Image
                        src="/finext-icon-color.png"
                        alt="Finext"
                        width={FAB_SIZE}
                        height={FAB_SIZE}
                        style={{ borderRadius: '50%', objectFit: 'cover' }}
                    />
                </MuiIconButton>
            </Box>

            {/* Thanh bar chính với notch */}
            <Box
                sx={{
                    position: 'absolute',
                    bottom: -8,
                    left: 0,
                    right: 0,
                    height: BAR_HEIGHT + 8,
                    pointerEvents: 'auto',
                }}
            >
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        bgcolor: alpha(bgColor, 0.60),
                        borderTop: `1px solid ${borderColor}`,
                        boxShadow: `0 -6px 15px ${alpha(theme.palette.common.black, 0.05)}, 0 -2px 15px ${alpha(theme.palette.common.white, 0.15)}`,
                        backdropFilter: 'blur(12px)',
                    }}
                />

                {/* Các nút - phân bố đều 2 bên */}
                <Box
                    sx={{
                        position: 'relative',
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        height: '100%',
                        pb: '6px',
                        px: 0,
                    }}
                >
                    {/* Bên trái: 2 nút phân bố đều */}
                    <Box sx={{ display: 'flex', flex: 1, justifyContent: 'space-evenly', alignItems: 'center' }}>
                        <MuiIconButton
                            onClick={() => router.back()}
                            aria-label="Quay lại"
                            sx={iconButtonSx}
                        >
                            <ArrowBackIcon sx={{ fontSize: 26 }} />
                        </MuiIconButton>
                        <MuiIconButton
                            onClick={() => router.push('/charts')}
                            aria-label="Biểu đồ"
                            sx={iconButtonSx}
                        >
                            <CandlestickChartOutlined sx={{ fontSize: 26 }} />
                        </MuiIconButton>
                    </Box>

                    {/* Khoảng trống giữa cho FAB */}
                    <Box sx={{ width: FAB_SIZE + 20, flexShrink: 0 }} />

                    {/* Bên phải: 2 nút phân bố đều */}
                    <Box sx={{ display: 'flex', flex: 1, justifyContent: 'space-evenly', alignItems: 'center' }}>
                        <MuiIconButton
                            onClick={() => router.push('/watchlist')}
                            aria-label="Watchlist"
                            sx={iconButtonSx}
                        >
                            <StarBorderPurple500Outlined sx={{ fontSize: 26 }} />
                        </MuiIconButton>
                        <MuiIconButton
                            onClick={() => router.push('/stocks')}
                            aria-label="Bộ lọc"
                            sx={iconButtonSx}
                        >
                            <FilterAltOutlined sx={{ fontSize: 26 }} />
                        </MuiIconButton>
                    </Box>
                </Box>
            </Box>

            <SignInModal
                open={isSignInOpen}
                onClose={closeSignInModal}
            />
        </Box>
    );
}
