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

const BAR_HEIGHT = 52;
const FAB_SIZE = 58;
const NOTCH_GAP = 72; // Khoảng trống giữa cho notch
const CURVE_DEPTH = 30; // Độ sâu lõm notch
const SCROLL_THRESHOLD = 10;

export default function MobileBottomBar() {
    const theme = useTheme();
    const router = useRouter();
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
        width: 42,
        height: 42,
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
                    bottom: BAR_HEIGHT - CURVE_DEPTH - FAB_SIZE / 2 + 20,
                    left: '50%',
                    transform: visible ? 'translateX(-50%)' : 'translateX(-50%) translateY(20px)',
                    zIndex: 3,
                    pointerEvents: 'auto',
                    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                <MuiIconButton
                    onClick={() => router.push('/profile')}
                    aria-label="Trang cá nhân"
                    sx={{
                        width: FAB_SIZE,
                        height: FAB_SIZE,
                        borderRadius: '50%',
                        bgcolor: theme.palette.background.paper,
                        boxShadow: 'none',
                        overflow: 'hidden',
                        p: 0,
                        transition: 'box-shadow 0.25s ease, transform 0.2s ease',
                        '&:hover': {
                            boxShadow: `0 4px 18px ${alpha(theme.palette.primary.main, 0.2)}`,
                            transform: 'scale(1.05)',
                        },
                        '&:active': {
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
                    bottom: -4,
                    left: 0,
                    right: 0,
                    height: BAR_HEIGHT + 4,
                    pointerEvents: 'auto',
                    boxShadow: `0 -4px 12px ${alpha(theme.palette.common.black, 0.18)}`,
                }}
            >
                {/* SVG background với notch lõm xuống */}
                <Box
                    component="svg"
                    viewBox="0 0 400 100"
                    preserveAspectRatio="none"
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        filter: `drop-shadow(0 -4px 8px ${alpha(theme.palette.common.black, 0.25)})`,
                    }}
                >
                    <path
                        d={`
              M 0,0
              L ${200 - NOTCH_GAP},0
              C ${200 - NOTCH_GAP + 20},0 ${200 - NOTCH_GAP / 2},${CURVE_DEPTH * 100 / BAR_HEIGHT} 200,${CURVE_DEPTH * 100 / BAR_HEIGHT}
              C ${200 + NOTCH_GAP / 2},${CURVE_DEPTH * 100 / BAR_HEIGHT} ${200 + NOTCH_GAP - 20},0 ${200 + NOTCH_GAP},0
              L 400,0
              L 400,100
              L 0,100
              Z
            `}
                        fill={bgColor}
                        stroke={borderColor}
                        strokeWidth="0.8"
                        vectorEffect="non-scaling-stroke"
                    />
                </Box>

                {/* Backdrop blur */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
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
                            <ArrowBackIcon sx={{ fontSize: 22 }} />
                        </MuiIconButton>
                        <MuiIconButton
                            onClick={() => router.push('/charts')}
                            aria-label="Biểu đồ"
                            sx={iconButtonSx}
                        >
                            <CandlestickChartOutlined sx={{ fontSize: 22 }} />
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
                            <StarBorderPurple500Outlined sx={{ fontSize: 22 }} />
                        </MuiIconButton>
                        <MuiIconButton
                            onClick={() => router.push('/stocks')}
                            aria-label="Bộ lọc"
                            sx={iconButtonSx}
                        >
                            <FilterAltOutlined sx={{ fontSize: 22 }} />
                        </MuiIconButton>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
