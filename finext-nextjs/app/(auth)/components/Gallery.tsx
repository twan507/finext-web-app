'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { layoutTokens, durations, easings, fontWeight, borderRadius } from 'theme/tokens';

export interface Slide {
    overline: string;
    headline: string;
    description: string;
}

interface GalleryProps {
    slides: Slide[];
    chartComponents?: React.ReactNode[];
    autoPlayInterval?: number;
}

export default function Gallery({
    slides,
    chartComponents,
    autoPlayInterval = 5000
}: GalleryProps) {
    const [currentSlide, setCurrentSlide] = useState(0);

    // Một timer duy nhất, dọn sạch mỗi lần đổi slide và khi unmount.
    // Bấm dot làm effect chạy lại → timer được reset, không thể desync.
    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentSlide((c) => (c + 1) % slides.length);
        }, autoPlayInterval);
        return () => clearTimeout(timer);
    }, [currentSlide, slides.length, autoPlayInterval]);

    const goToSlide = useCallback((index: number) => {
        setCurrentSlide(index);
    }, []);

    const slide = slides[currentSlide];
    const currentVisual = chartComponents?.[currentSlide];

    return (
        <Box
            sx={(theme) => {
                const isDark = theme.palette.mode === 'dark';
                return {
                    maxWidth: layoutTokens.authGalleryMaxWidth,
                    position: 'relative',
                    p: 4,
                    borderRadius: `${borderRadius.lg}px`,
                    // Dark: panel TỐI hơn nền để cắt quầng aurora phía sau — phủ sáng lên
                    // vùng vốn đã rực thì không tạo ra tách bạch nào.
                    // Light: panel sáng hơn nền, theo đúng logic ngược lại.
                    backgroundColor: isDark
                        ? 'rgba(11,7,24,0.58)'
                        : 'rgba(255,255,255,0.50)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(60,45,100,0.10)'}`,
                    boxShadow: isDark
                        // viền sáng mảnh ở cạnh trên cho cảm giác nổi khối
                        ? 'inset 0 1px 0 rgba(255,255,255,0.07), 0 28px 70px -24px rgba(0,0,0,0.75)'
                        : '0 24px 60px -28px rgba(60,45,120,0.35)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                };
            }}
        >
            {/* key={currentSlide} remount nội dung → animation vẽ lại từ đầu mỗi slide */}
            <Box
                key={currentSlide}
                sx={{
                    '@keyframes slideEnter': {
                        from: { opacity: 0, transform: 'translateY(10px)' },
                        to: { opacity: 1, transform: 'none' },
                    },
                    animation: `slideEnter ${durations.slower} ${easings.easeOutQuart} both`,
                    '@media (prefers-reduced-motion: reduce)': {
                        animation: 'none',
                    },
                }}
            >
                <Box>
                    <Typography
                        variant="overline"
                        sx={(theme) => ({
                            fontWeight: fontWeight.semibold,
                            letterSpacing: '0.16em',
                            color: theme.palette.mode === 'dark' ? '#8C5AFF' : '#6B46C1',
                        })}
                    >
                        {slide.overline}
                    </Typography>
                    <Typography
                        variant="h1"
                        sx={(theme) => ({
                            mb: 1,
                            color: theme.palette.text.primary,
                            fontWeight: fontWeight.bold,
                            letterSpacing: '-0.025em',
                            textWrap: 'balance',
                        })}
                    >
                        {slide.headline}
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={(theme) => ({
                            minHeight: '3.75rem',
                            mb: 1,
                            color: theme.palette.text.secondary,
                            // Trải hết bề ngang panel và căn đều hai biên như Word.
                            // Dòng cuối vẫn tự căn trái — đúng hành vi chuẩn của justify.
                            textAlign: 'justify',
                        })}
                    >
                        {slide.description}
                    </Typography>
                </Box>

                {currentVisual}
            </Box>

            {/* Thanh chỉ báo đặt ngoài vùng animation để không nhấp nháy theo slide */}
            <Box sx={{ display: 'flex', gap: 1, mt: 2.5, alignItems: 'center' }}>
                {slides.map((_, i) => {
                    const isActive = i === currentSlide;
                    return (
                        <Box
                            key={i}
                            component="button"
                            type="button"
                            aria-label={`Chuyển đến slide ${i + 1}`}
                            aria-current={isActive}
                            onClick={() => goToSlide(i)}
                            sx={(theme) => {
                                const accent = theme.palette.mode === 'dark' ? '#8C5AFF' : '#6B46C1';
                                return {
                                    position: 'relative',
                                    overflow: 'hidden',
                                    height: 3,
                                    width: isActive ? 46 : 26,
                                    p: 0,
                                    border: 'none',
                                    borderRadius: 999,
                                    cursor: 'pointer',
                                    backgroundColor: theme.palette.mode === 'dark'
                                        ? 'rgba(140,90,255,0.28)'
                                        : 'rgba(107,70,193,0.24)',
                                    transition: `width ${durations.slow} ${easings.easeOutQuart}, opacity ${durations.normal} ${easings.smooth}`,
                                    opacity: isActive ? 1 : 0.55,
                                    '&:hover': { opacity: 0.85 },
                                    '&:focus-visible': {
                                        outline: `2px solid ${accent}`,
                                        outlineOffset: '3px',
                                    },
                                    // Vạch chạy thể hiện thời gian còn lại của slide
                                    '&::after': isActive ? {
                                        content: '""',
                                        position: 'absolute',
                                        inset: 0,
                                        backgroundColor: accent,
                                        transformOrigin: 'left',
                                        animation: `dotFill ${autoPlayInterval}ms ${easings.linear} forwards`,
                                    } : {},
                                    '@keyframes dotFill': {
                                        from: { transform: 'scaleX(0)' },
                                        to: { transform: 'scaleX(1)' },
                                    },
                                    '@media (prefers-reduced-motion: reduce)': {
                                        transition: 'none',
                                        '&::after': isActive ? { animation: 'none', transform: 'scaleX(1)' } : {},
                                    },
                                };
                            }}
                        />
                    );
                })}
            </Box>
        </Box>
    );
}
