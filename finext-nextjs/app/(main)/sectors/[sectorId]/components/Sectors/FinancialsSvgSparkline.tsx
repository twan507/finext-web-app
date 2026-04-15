'use client';

import { useMemo } from 'react';

interface FinancialsSvgSparklineProps {
    values: (number | null)[];
    width?: number;
    height?: number;
    color?: string;
}

export default function FinancialsSvgSparkline({
    values,
    width = 72,
    height = 18,
    color = 'currentColor',
}: FinancialsSvgSparklineProps) {
    const path = useMemo(() => {
        if (!values || values.length < 2) return null;

        const validValues = values.filter((v): v is number => v != null && isFinite(v));
        if (validValues.length < 2) return null;

        const min = Math.min(...validValues);
        const max = Math.max(...validValues);
        const range = max === min ? 1 : max - min;

        const n = values.length;
        const xStep = width / (n - 1);
        const padY = 2; // padding top/bottom để stroke không bị clip

        const points = values.map((v, i) => {
            if (v == null || !isFinite(v)) return null;
            const x = i * xStep;
            const y = padY + (height - padY * 2) * (1 - (v - min) / range);
            return { x, y };
        });

        // Build SVG path — skip null points (break line)
        let d = '';
        let penDown = false;
        for (const pt of points) {
            if (pt == null) {
                penDown = false;
                continue;
            }
            if (!penDown) {
                d += `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
                penDown = true;
            } else {
                d += ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
            }
        }

        return d || null;
    }, [values, width, height]);

    if (!path) {
        return (
            <svg width={width} height={height} aria-hidden="true">
                <line
                    x1="0" y1={height / 2}
                    x2={width} y2={height / 2}
                    stroke="currentColor"
                    strokeOpacity="0.15"
                    strokeWidth="1"
                />
            </svg>
        );
    }

    return (
        <svg width={width} height={height} overflow="visible" aria-hidden="true">
            <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
