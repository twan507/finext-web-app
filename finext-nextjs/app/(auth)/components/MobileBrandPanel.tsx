'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import BrandLogo from '@/components/layout/BrandLogo';
import { getResponsiveFontSize, fontWeight } from 'theme/tokens';

/**
 * Panel thương hiệu hero cho màn nhỏ (xs → lg ẩn). Khôi phục storytelling cho
 * mobile vốn chỉ còn form trơ (Gallery bị ẩn): logo + glow + tagline + trust line.
 */
export default function MobileBrandPanel() {
    return (
        <Box
            sx={{
                display: { xs: 'flex', lg: 'none' },
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                position: 'relative',
                gap: 1,
                pt: 1,
            }}
        >
            {/* Glow halo phía sau logo */}
            <Box
                aria-hidden
                sx={(theme) => ({
                    position: 'absolute',
                    top: -24,
                    width: 190,
                    height: 190,
                    borderRadius: '50%',
                    pointerEvents: 'none',
                    filter: 'blur(26px)',
                    background:
                        theme.palette.mode === 'dark'
                            ? 'radial-gradient(circle, rgba(180,126,255,0.38), transparent 70%)'
                            : 'radial-gradient(circle, rgba(139,92,246,0.28), transparent 70%)',
                })}
            />

            <Box sx={{ position: 'relative', zIndex: 1 }}>
                <BrandLogo
                    href="/"
                    imageSize={34}
                    textSize={getResponsiveFontSize('h3')}
                    gap={8}
                    useColorOverlay={true}
                />
            </Box>

            <Typography
                sx={(theme) => ({
                    position: 'relative',
                    zIndex: 1,
                    fontSize: getResponsiveFontSize('lg'),
                    fontWeight: fontWeight.bold,
                    letterSpacing: '-0.01em',
                    background:
                        theme.palette.mode === 'dark'
                            ? 'linear-gradient(135deg, #FFFFFF 0%, #C4B5FD 55%, #8B5CF6 100%)'
                            : 'linear-gradient(135deg, #1F2937 0%, #6B46C1 55%, #8B5CF6 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                    WebkitTextFillColor: 'transparent',
                })}
            >
                Phân tích chứng khoán thông minh
            </Typography>

            <Typography
                variant="body2"
                sx={(theme) => ({
                    position: 'relative',
                    zIndex: 1,
                    color: theme.palette.text.secondary,
                    fontSize: getResponsiveFontSize('xs'),
                })}
            >
                1.600+ mã cổ phiếu · Dữ liệu realtime · Phân tích kỹ thuật
            </Typography>
        </Box>
    );
}
