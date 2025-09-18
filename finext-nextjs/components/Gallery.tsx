'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { layoutTokens } from 'theme/tokens';

export interface Slide {
    overline: string;
    headline: string;
    description: string;
}

interface GalleryProps {
    slides: Slide[];
    chartComponent?: React.ReactNode;
    autoPlayInterval?: number;
}

export default function Gallery({
    slides,
    chartComponent,
    autoPlayInterval = 5000
}: GalleryProps) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [animationStyle, setAnimationStyle] = useState({
        opacity: 1,
        transform: 'translateX(0px)',
    });

    const triggerSlideChange = useCallback((nextIndex: number) => {
        if (nextIndex === currentSlide) return;

        // Bắt đầu hiệu ứng trượt ra (biến mất sang trái)
        setAnimationStyle({
            opacity: 0,
            transform: 'translateX(-40px)',
        });

        // Đợi hiệu ứng kết thúc rồi mới đổi nội dung
        setTimeout(() => {
            setCurrentSlide(nextIndex);
            // Đặt sẵn nội dung mới ở bên phải (vẫn đang ẩn)
            setAnimationStyle({
                opacity: 0,
                transform: 'translateX(40px)',
            });

            // Dùng một timeout nhỏ để đảm bảo trình duyệt đã render xong trạng thái trên
            setTimeout(() => {
                // Bắt đầu hiệu ứng trượt vào (xuất hiện từ phải sang)
                setAnimationStyle({
                    opacity: 1,
                    transform: 'translateX(0px)',
                });
            }, 20);
        }, 400); // khớp với transition duration
    }, [currentSlide]);

    useEffect(() => {
        const timer = setInterval(() => {
            const nextIndex = (currentSlide + 1) % slides.length;
            triggerSlideChange(nextIndex);
        }, autoPlayInterval);
        return () => clearInterval(timer);
    }, [currentSlide, triggerSlideChange, slides.length, autoPlayInterval]);

    const slide = slides[currentSlide];

    return (
        <Box sx={{ maxWidth: layoutTokens.authGalleryMaxWidth, position: 'relative' }}>
            <Box
                sx={{
                    transition: 'opacity 500ms ease-in-out, transform 500ms ease-in-out',
                    ...animationStyle,
                }}
            >
                <Box sx={{ ml: 1 }}>
                    <Typography
                        variant="overline"
                        sx={{ fontWeight: 'bold', opacity: 0.7 }}
                    >
                        {slide.overline}
                    </Typography>
                    <Typography
                        variant="h1"
                        sx={(theme) => ({
                            mb: 1,
                            background: theme.palette.mode === 'dark'
                                ? 'linear-gradient(135deg, #FFFFFF 0%, #E0E7FF 25%, #C4B5FD 50%, #A78BFA 75%, #8B5CF6 100%)'
                                : 'linear-gradient(135deg, #1F2937 0%, #4C1D95 25%, #6B46C1 50%, #7C3AED 75%, #8B5CF6 100%)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            color: 'transparent',
                            WebkitTextFillColor: 'transparent',
                            fontWeight: 700,
                            letterSpacing: '-0.02em',
                            textShadow: theme.palette.mode === 'dark'
                                ? '0 2px 8px rgba(139, 92, 246, 0.3)'
                                : '0 2px 8px rgba(107, 70, 193, 0.2)',
                        })}
                    >
                        {slide.headline}
                    </Typography>
                    <Typography variant="body2" sx={{ minHeight: '3.75rem' }}>
                        {slide.description}
                    </Typography>
                </Box>

                {/* Chart/Visual Component */}
                {chartComponent || (
                    <Box
                        sx={{
                            position: 'relative',
                            width: { md: '100%' },
                            height: { md: layoutTokens.authGalleryHeight },
                            borderRadius: 2,
                            background: 'linear-gradient(180deg, rgba(10,8,20,0.86) 0%, rgba(12,10,28,0.92) 100%)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
                            overflow: 'hidden',
                        }}
                    >
                        <Box
                            sx={{
                                position: 'absolute',
                                inset: 0,
                                background:
                                    'radial-gradient(circle at 20% 60%, rgba(140,90,255,0.18), transparent 40%), radial-gradient(circle at 70% 30%, rgba(80,140,255,0.16), transparent 45%)',
                            }}
                        />
                    </Box>
                )}
            </Box>

            {/* Các nút điều khiển được đặt bên ngoài để không bị ảnh hưởng bởi animation */}
            <Box sx={{ display: 'flex', gap: 1.8, mt: 2, pl: 0.5 }}>
                {slides.map((_, i) => (
                    <Box
                        key={i}
                        sx={(theme) => ({
                            width: i === currentSlide ? layoutTokens.dotSize.large : layoutTokens.dotSize.small,
                            height: layoutTokens.dotSize.small,
                            borderRadius: 999,
                            backgroundColor: i === currentSlide
                                ? theme.palette.mode === 'dark'
                                    ? '#8C5AFF'
                                    : '#6B46C1'
                                : theme.palette.mode === 'dark'
                                    ? 'rgba(140,90,255,0.6)'
                                    : 'rgba(80,60,140,0.3)',
                            cursor: 'pointer',
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            position: 'relative',
                            '&:hover': {
                                backgroundColor: i === currentSlide
                                    ? theme.palette.mode === 'dark'
                                        ? '#9966FF'
                                        : '#7C3AED'
                                    : theme.palette.mode === 'dark'
                                        ? 'rgba(140,90,255,0.4)'
                                        : 'rgba(80,60,140,0.5)',
                                transform: 'scale(1.1)',
                            },
                            '&::before': i === currentSlide ? {
                                content: '""',
                                position: 'absolute',
                                inset: -3,
                                borderRadius: 999,
                                background: 'linear-gradient(45deg, rgba(140,90,255,0.4), rgba(124,58,237,0.3))',
                                zIndex: -1,
                                opacity: 0.7,
                            } : {},
                        })}
                        onClick={() => triggerSlideChange(i)}
                    />
                ))}
            </Box>
        </Box>
    );
}