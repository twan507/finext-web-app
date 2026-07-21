'use client';

import React from 'react';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { zIndex } from 'theme/tokens';

interface Orb {
    color: string;
    size: string;
    top: string;
    left: string;
    blur: number;
    opacity: number;
    anim: string;
    duration: string;
    keyframes: Record<string, { transform: string }>;
}

const KEYFRAMES = {
    auroraA: {
        '0%': { transform: 'translate(0, 0) scale(1)' },
        '50%': { transform: 'translate(4%, -5%) scale(1.12)' },
        '100%': { transform: 'translate(0, 0) scale(1)' },
    },
    auroraB: {
        '0%': { transform: 'translate(0, 0) scale(1)' },
        '50%': { transform: 'translate(-5%, 4%) scale(1.08)' },
        '100%': { transform: 'translate(0, 0) scale(1)' },
    },
    auroraC: {
        '0%': { transform: 'translate(0, 0) scale(1.05)' },
        '50%': { transform: 'translate(3%, 5%) scale(0.95)' },
        '100%': { transform: 'translate(0, 0) scale(1.05)' },
    },
};

/**
 * Nền aurora động: các quầng sáng tím trôi nhẹ (chỉ transform/opacity → không
 * reflow). Palette lấy từ nền auth sẵn có. Tôn trọng prefers-reduced-motion:
 * reduce → orb vẫn hiển thị nhưng đứng yên.
 */
export default function AuroraBackground() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const orbs: Orb[] = isDark
        ? [
            { color: 'radial-gradient(circle, rgba(178,130,255,0.55), transparent 70%)', size: '46vw', top: '30%', left: '30%', blur: 70, opacity: 0.7, anim: 'auroraA', duration: '22s', keyframes: KEYFRAMES.auroraA },
            { color: 'radial-gradient(circle, rgba(124,58,237,0.45), transparent 70%)', size: '40vw', top: '8%', left: '6%', blur: 80, opacity: 0.55, anim: 'auroraB', duration: '28s', keyframes: KEYFRAMES.auroraB },
            { color: 'radial-gradient(circle, rgba(80,140,255,0.35), transparent 70%)', size: '38vw', top: '55%', left: '58%', blur: 90, opacity: 0.5, anim: 'auroraC', duration: '34s', keyframes: KEYFRAMES.auroraC },
        ]
        : [
            { color: 'radial-gradient(circle, rgba(150,90,245,0.45), transparent 70%)', size: '46vw', top: '30%', left: '30%', blur: 60, opacity: 0.6, anim: 'auroraA', duration: '22s', keyframes: KEYFRAMES.auroraA },
            { color: 'radial-gradient(circle, rgba(124,58,237,0.32), transparent 70%)', size: '40vw', top: '8%', left: '6%', blur: 70, opacity: 0.45, anim: 'auroraB', duration: '28s', keyframes: KEYFRAMES.auroraB },
            { color: 'radial-gradient(circle, rgba(100,60,200,0.28), transparent 70%)', size: '38vw', top: '55%', left: '58%', blur: 80, opacity: 0.4, anim: 'auroraC', duration: '34s', keyframes: KEYFRAMES.auroraC },
        ];

    return (
        <Box
            aria-hidden
            sx={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                pointerEvents: 'none',
                zIndex: zIndex.base + 1,
            }}
        >
            {orbs.map((orb) => (
                <Box
                    key={orb.anim}
                    sx={{
                        position: 'absolute',
                        top: orb.top,
                        left: orb.left,
                        width: orb.size,
                        height: orb.size,
                        borderRadius: '50%',
                        background: orb.color,
                        filter: `blur(${orb.blur}px)`,
                        opacity: orb.opacity,
                        willChange: 'transform',
                        [`@keyframes ${orb.anim}`]: orb.keyframes,
                        animation: `${orb.anim} ${orb.duration} ease-in-out infinite`,
                        '@media (prefers-reduced-motion: reduce)': {
                            animation: 'none',
                        },
                    }}
                />
            ))}
        </Box>
    );
}
