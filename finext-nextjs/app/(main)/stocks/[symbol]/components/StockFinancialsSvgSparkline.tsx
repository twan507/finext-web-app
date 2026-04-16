'use client';

import { useMemo } from 'react';

interface Props {
    values: (number | null)[];
    width?: number;
    height?: number;
    color?: string;
}

export default function StockFinancialsSvgSparkline({
    values,
    width = 72,
    height = 18,
    color = 'currentColor',
}: Props) {
    const bars = useMemo(() => {
        if (!values || values.length < 2) return null;

        const validValues = values.filter((v): v is number => v != null && isFinite(v));
        if (validValues.length < 2) return null;

        const min = Math.min(...validValues);
        const max = Math.max(...validValues);
        // Use 0 as baseline when all values are positive, matching the FocusChart y-axis
        const baseline = Math.min(0, min);
        const range = max - baseline || 1;

        const n = values.length;
        const gap = 1.5;
        const barWidth = (width - gap * (n - 1)) / n;
        const padY = 1;
        const usableHeight = height - padY * 2;

        return values.map((v, i) => {
            if (v == null || !isFinite(v)) return null;
            const barH = Math.max(1.5, usableHeight * ((v - baseline) / range));
            const x = i * (barWidth + gap);
            const y = padY + usableHeight - barH;
            return { x, y, w: barWidth, h: barH };
        });
    }, [values, width, height]);

    if (!bars) {
        return (
            <svg width={width} height={height} aria-hidden="true">
                <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
            </svg>
        );
    }

    return (
        <svg width={width} height={height} aria-hidden="true">
            {bars.map((bar, i) =>
                bar ? (
                    <rect
                        key={i}
                        x={bar.x}
                        y={bar.y}
                        width={bar.w}
                        height={bar.h}
                        rx={1}
                        fill={color}
                    />
                ) : null,
            )}
        </svg>
    );
}
