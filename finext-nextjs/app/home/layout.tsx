'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from 'components/AuthProvider';
import {
    AppBar, Box, CssBaseline, Toolbar, CircularProgress, useTheme,
    alpha, useMediaQuery
} from '@mui/material';


import BrandLogo from 'components/BrandLogo';
import AuthButtons from 'components/AuthButtons';
import { layoutTokens } from '../../theme/tokens';
import ThemeToggleButton from '@/components/ThemeToggleButton';



export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { session, loading: authLoading } = useAuth();
    const router = useRouter();
    const theme = useTheme();

    // Responsive breakpoints
    const lgDown = useMediaQuery(theme.breakpoints.down('lg'));

    const isDark = theme.palette.mode === "dark";
    const centerX = "42%";
    const centerY = "52%";

    const layers = isDark
        ? {
            base: "linear-gradient(180deg, #0B0718 0%, #120A28 40%, #160D33 100%)",
            before: `radial-gradient(circle at ${centerX} ${centerY}, rgba(178,130,255,0.70) 0%, rgba(158,110,255,0.46) 12%, rgba(118,80,230,0.28) 22%, rgba(82,50,190,0.16) 30%, rgba(52,30,130,0.10) 38%, rgba(32,20,90,0.06) 44%, rgba(22,14,60,0.03) 50%, rgba(14,9,36,0.00) 58%)`,
            after: `radial-gradient(circle at ${centerX} ${centerY}, rgba(0,0,0,0) 45%, rgba(8,5,16,0.30) 70%, rgba(6,4,12,0.55) 100%), radial-gradient(circle at ${centerX} ${centerY}, rgba(110,70,220,0.10) 0%, rgba(110,70,220,0.00) 60%)`,
            blurPx: 36,
        }
        : {
            base: "linear-gradient(180deg, #ECE9FF 0%, #E5E0FF 40%, #DCD6FF 100%)",
            before: `radial-gradient(circle at ${centerX} ${centerY}, rgba(150, 90, 245, 0.55) 0%, rgba(130, 75, 230, 0.34) 14%, rgba(110, 65, 210, 0.22) 24%, rgba(90, 55, 185, 0.14) 34%, rgba(70, 45, 160, 0.10) 42%, rgba(60, 40, 140, 0.06) 50%, rgba(50, 35, 120, 0.04) 58%, rgba(50, 35, 120, 0.00) 66%)`,
            after: `radial-gradient(circle at ${centerX} ${centerY}, rgba(0,0,0,0) 55%, rgba(0,0,0,0.10) 85%, rgba(0,0,0,0.16) 100%), radial-gradient(circle at ${centerX} ${centerY}, rgba(100,60,200,0.10) 0%, rgba(100,60,200,0.00) 60%)`,
            blurPx: 28,
        };

    useEffect(() => {
        // Home pages can be accessed without authentication
        // Remove redirect to login for public access
    }, [session, authLoading, router]);

    // Show loading only while checking auth, but don't block access
    if (authLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}>
                <CircularProgress />
            </Box>
        );
    }
    return (
        <Box sx={{
            display: 'flex',
            height: '100vh',
            width: '100vw',
            position: "relative",
            overflow: 'hidden', // Prevent overflow
            background: layers.base,
            "&::before": {
                content: '""',
                position: "absolute",
                inset: 0, // Changed from "-15%" to prevent overflow
                pointerEvents: "none",
                background: layers.before,
                filter: `blur(${layers.blurPx}px)`,
                zIndex: -2,
                transform: 'scale(1.2)', // Add scale to maintain blur effect without overflow
            },
            "&::after": {
                content: '""',
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background: layers.after,
                zIndex: -1,
            },
        }}>
            <CssBaseline />

            {/* Theme Toggle Button */}
            <Box sx={{ position: 'fixed', bottom: 16, right: 10, zIndex: 1000 }}>
                <ThemeToggleButton />
            </Box>

            {/* APP BAR */}
            <AppBar
                position="fixed"
                elevation={0}
                sx={{
                    width: '100%',
                    height: layoutTokens.appBarHeight,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', // Thêm đổ bóng viền dưới
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}`, // Thêm viền mỏng
                    backdropFilter: 'blur(8px)', // Thêm hiệu ứng blur
                    display: 'flex',
                    justifyContent: 'center',
                    zIndex: 100, // Ensure AppBar is above all content
                }}
            >
                <Box sx={{ width: '100%', mx: 'auto' }}>
                    <Toolbar sx={{
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        px: { xs: 2, lg: "5px !important" },
                        minHeight: `${layoutTokens.toolbarMinHeight}px !important`,
                        height: layoutTokens.appBarHeight,
                        maxHeight: layoutTokens.appBarHeight,
                        width: '100%',
                        mx: 'auto',
                        maxWidth: 1400,
                    }}>
                        {/* Container bên trái, chứa logo */}
                        <Box sx={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            position: 'relative',
                        }}>
                            <BrandLogo href="/" />
                        </Box>

                        {/* Container bên phải, chứa AuthButtons hoặc UserAvatar */}
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                        }}>
                            {/* Nút đăng nhập/đăng ký hiển thị khi chưa đăng nhập */}
                            {!session && (
                                <AuthButtons variant={lgDown ? 'compact' : 'full'} />
                            )}

                            {/* UserAvatar hiển thị khi đã đăng nhập */}
                            {session && (
                                "Nghĩ xem có nên ghi gì ko"
                            )}
                        </Box>
                    </Toolbar>
                </Box>
            </AppBar>

            {/* MAIN */}
            <Box component="main" sx={{
                flexGrow: 1,
                width: '100%',
                height: '100vh',
                mt: `${layoutTokens.appBarHeight}px`,
                maxHeight: `calc(100vh - ${layoutTokens.appBarHeight}px)`,
                overflow: 'hidden', // Prevent main content overflow
                display: 'flex',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 1, // Main content above background but below AppBar
            }}>
                <Box sx={{
                    width: '100%',
                    height: '100%',
                    mx: 'auto',
                    overflow: 'auto', // Allow scrolling within content area only
                    maxWidth: '100%', // Prevent horizontal overflow
                }}>
                    {children}
                </Box>
            </Box>
        </Box>
    );
}
