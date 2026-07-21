'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import BrandLogo from '@/components/layout/BrandLogo';
import {
    layoutTokens,
    borderRadius,
    fontWeight,
    getResponsiveFontSize,
    iconSize,
    durations,
    easings,
    getGlassCard,
    getGlassHighlight,
    getGlassEdgeLight,
} from 'theme/tokens';

interface AuthCardProps {
    children: React.ReactNode;
    title: string;
    /** Ẩn logo trong card ở màn nhỏ (khi MobileBrandPanel đã hiển thị logo hero). */
    hideLogoOnMobile?: boolean;
}

/**
 * Khung glass-card dùng chung cho login/register/forgot-password.
 * Dựng trên token glassCard + highlight/edgeLight (mép kính chiết quang) + hiệu
 * ứng xuất hiện (fade + rise). Trước đây khối sx này bị copy-paste ~40 dòng/trang.
 */
export default function AuthCard({ children, title, hideLogoOnMobile = false }: AuthCardProps) {
    return (
        <Box
            sx={(theme) => {
                const isDark = theme.palette.mode === 'dark';
                return {
                    position: 'relative',
                    overflow: 'hidden',
                    width: '100%',
                    maxWidth: layoutTokens.authFormMaxWidth,
                    p: { xs: 2.5, md: 3 },
                    borderRadius: `${borderRadius.lg}px`,
                    ...getGlassCard(isDark),
                    '@keyframes authCardIn': {
                        from: { opacity: 0, transform: 'translateY(16px) scale(0.98)' },
                        to: { opacity: 1, transform: 'translateY(0) scale(1)' },
                    },
                    animation: `authCardIn ${durations.slower} ${easings.springOut} both`,
                    '@media (prefers-reduced-motion: reduce)': {
                        animation: 'none',
                    },
                    '&::before': { ...getGlassHighlight(isDark) },
                    '&::after': { ...getGlassEdgeLight(isDark) },
                };
            }}
        >
            <Box
                sx={{
                    display: hideLogoOnMobile ? { xs: 'none', lg: 'flex' } : 'flex',
                    justifyContent: 'center',
                    mb: 1.5,
                }}
            >
                <BrandLogo
                    href="/"
                    imageSize={iconSize.brandImage}
                    textSize={getResponsiveFontSize('h4')}
                    gap={layoutTokens.dotSize.small}
                    useColorOverlay={true}
                />
            </Box>

            <Typography
                component="h1"
                sx={(theme) => ({
                    textAlign: 'center',
                    mb: 2,
                    fontSize: getResponsiveFontSize('lg'),
                    fontWeight: fontWeight.semibold,
                    letterSpacing: '0.3px',
                    color: theme.palette.text.primary,
                })}
            >
                {title}
            </Typography>

            {children}
        </Box>
    );
}
