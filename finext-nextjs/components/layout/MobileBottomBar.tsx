'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Box, alpha, useTheme, IconButton as MuiIconButton } from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    CandlestickChartOutlined,
    StarBorderPurple500Outlined,
    FilterAltOutlined,
} from '@mui/icons-material';
import MarketPhaseNavIcon from '@/app/(main)/MarketPhaseNavIcon';
import { MOBILE_BAR_HEIGHT, isMobileBarRoute, useMobileBarVisible } from './mobileBarStore';

const BAR_HEIGHT = MOBILE_BAR_HEIGHT;
const FAB_SIZE = 54;
const FAB_BOTTOM = 12; // khoảng hở từ đáy bar lên FAB — càng nhỏ thì FAB càng tụt sát viền dưới

export default function MobileBottomBar() {
    const theme = useTheme();
    const router = useRouter();
    const pathname = usePathname();
    // Dùng chung store với bong bóng Finext AI để hai thứ trồi/thụt cùng nhịp.
    const visible = useMobileBarVisible();

    // Quy tắc route nằm trong mobileBarStore để bong bóng Finext AI dùng chung, không lặp điều kiện.
    if (!isMobileBarRoute(pathname)) return null;

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
            {/* Nút giai đoạn thị trường ở giữa - nằm trong vùng lõm. Dùng CHUNG MarketPhaseNavIcon với rail desktop. */}
            <Box
                sx={{
                    position: 'absolute',
                    bottom: FAB_BOTTOM,
                    left: '50%',
                    transform: visible ? 'translateX(-50%)' : 'translateX(-50%) translateY(20px)',
                    zIndex: 3,
                    pointerEvents: 'auto',
                    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                <MuiIconButton
                    onClick={() => router.push('/phase')}
                    aria-label="Giai đoạn thị trường"
                    sx={{
                        width: FAB_SIZE,
                        height: FAB_SIZE,
                        borderRadius: '50%',
                        bgcolor: 'transparent',
                        // KHÔNG overflow:hidden — hào quang blur của vòng conic phải toả được ra ngoài khung.
                        p: 0,
                        transition: 'transform 0.2s ease',
                        '&:hover': { bgcolor: 'transparent', transform: 'scale(1.05)' },
                        // Chạm vào → vòng xoay + hào quang tăng tốc, giống hover ở rail desktop.
                        '&:active': {
                            bgcolor: 'transparent',
                            transform: 'scale(0.95)',
                            '& .mp-nav-ring::before': { animationDuration: '1.8s' },
                            '& .mp-nav-frame::before': { animationDuration: '2.2s' },
                        },
                    }}
                >
                    <MarketPhaseNavIcon aura size={FAB_SIZE} />
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
        </Box>
    );
}
