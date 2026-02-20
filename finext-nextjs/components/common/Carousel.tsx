'use client';

import { Box, useTheme, SxProps, Theme } from '@mui/material';
import { useState, useCallback, useEffect, ReactNode } from 'react';
import { layoutTokens, durations, easings } from '../../theme/tokens';

export interface Slide {
    id: string | number;
    component: ReactNode;
}

interface CarouselProps {
    slides: Slide[];
    autoPlayInterval?: number; // ms, default 6000, 0 to disable
    showDots?: boolean;
    sx?: SxProps<Theme>;
    minHeight?: string | number;
    height?: string | number;
}

export default function Carousel({
    slides,
    autoPlayInterval = 6000,
    showDots = true,
    sx,
    minHeight = '400px',
    height,
}: CarouselProps) {
    const theme = useTheme();

    // Carousel State
    const [currentSlide, setCurrentSlide] = useState(0);
    const [animationStyle, setAnimationStyle] = useState({
        opacity: 1,
        transform: 'translateX(0px)',
    });
    const [isPaused, setIsPaused] = useState(false);

    // Swipe State
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const minSwipeDistance = 50;

    // Carousel Logic
    const triggerSlideChange = useCallback((nextIndex: number) => {
        if (nextIndex === currentSlide) return;

        // Slide out direction
        const direction = nextIndex > currentSlide ? -1 : 1;

        // Slide out
        setAnimationStyle({
            opacity: 0,
            transform: `translateX(${direction * 20}px)`,
        });

        setTimeout(() => {
            setCurrentSlide(nextIndex);
            // Prepare next slide from opposite side
            setAnimationStyle({
                opacity: 0,
                transform: `translateX(${direction * -20}px)`,
            });

            setTimeout(() => {
                // Slide in
                setAnimationStyle({
                    opacity: 1,
                    transform: 'translateX(0px)',
                });
            }, 50);
        }, 300); // Wait for transition out
    }, [currentSlide]);

    // Swipe Helpers
    const startDrag = (clientX: number) => {
        setTouchStart(clientX);
        setTouchEnd(null);
    };

    const moveDrag = (clientX: number) => {
        setTouchEnd(clientX);
    };

    const endDrag = () => {
        if (!touchStart || !touchEnd) return;

        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            // Next slide
            const nextIndex = (currentSlide + 1) % slides.length;
            triggerSlideChange(nextIndex);
        }
        if (isRightSwipe) {
            // Prev slide
            const prevIndex = (currentSlide - 1 + slides.length) % slides.length;
            triggerSlideChange(prevIndex);
        }
        // Reset (optional, but good for cleanliness)
        setTouchStart(null);
        setTouchEnd(null);
    };

    // Touch Handlers
    const handleTouchStart = (e: React.TouchEvent) => {
        setIsPaused(true);
        startDrag(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        moveDrag(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        setIsPaused(false);
        endDrag();
    };

    // Mouse Handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        startDrag(e.clientX);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        // Only track move if we started (simple check) or just update always (standard drag)
        // Optimization: check e.buttons to ensure we are dragging
        if (e.buttons === 1) {
            moveDrag(e.clientX);
        }
    };

    const handleMouseUp = () => {
        endDrag();
    };

    const handleMouseEnter = () => {
        setIsPaused(true);
    };

    const handleMouseLeave = () => {
        setIsPaused(false);
        endDrag(); // Handle drag release outside
    };

    // Auto-play
    useEffect(() => {
        if (autoPlayInterval <= 0 || isPaused) return;
        const timer = setInterval(() => {
            const nextIndex = (currentSlide + 1) % slides.length;
            triggerSlideChange(nextIndex);
        }, autoPlayInterval);
        return () => clearInterval(timer);
    }, [currentSlide, triggerSlideChange, slides.length, autoPlayInterval, isPaused]);

    if (!slides || slides.length === 0) {
        return null;
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: height, ...sx as object }}>
            <Box
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onMouseEnter={handleMouseEnter}
                sx={{
                    transition: `opacity ${durations.slow} ${easings.easeInOut}, transform ${durations.slow} ${easings.easeInOut}`,
                    minHeight: minHeight,
                    height: height ? '100%' : undefined,
                    flex: height ? 1 : undefined,
                    ...animationStyle,
                    cursor: 'grab',
                    '&:active': {
                        cursor: 'grabbing',
                    },
                    userSelect: 'none',
                }}
            >
                {slides[currentSlide].component}
            </Box>

            {/* Dots Navigation */}
            {showDots && (
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 0.75, sm: 1.5 }, py: { xs: 0.75, sm: 1 } }}>
                    {slides.map((_, i) => (
                        <Box
                            key={i}
                            onClick={() => triggerSlideChange(i)}
                            sx={{
                                width: i === currentSlide
                                    ? { xs: layoutTokens.dotSize.large * 0.7, sm: layoutTokens.dotSize.large }
                                    : { xs: layoutTokens.dotSize.small * 0.7, sm: layoutTokens.dotSize.small },
                                height: { xs: layoutTokens.dotSize.small * 0.7, sm: layoutTokens.dotSize.small },
                                borderRadius: 999,
                                backgroundColor: i === currentSlide
                                    ? theme.palette.primary.main
                                    : theme.palette.action.disabled,
                                cursor: 'pointer',
                                transition: `all ${durations.slow} ${easings.smooth}`,
                                position: 'relative',
                                '&:hover': {
                                    transform: 'scale(1.2)',
                                    backgroundColor: theme.palette.primary.main,
                                }
                            }}
                        />
                    ))}
                </Box>
            )}
        </Box>
    );
}
