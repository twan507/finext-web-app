'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, Tooltip, useTheme, alpha } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { fontWeight, getResponsiveFontSize, borderRadius, durations } from 'theme/tokens';
import { getTrendColor } from 'theme/colorHelpers';
import type { IndexData } from './indexSections';

interface Props {
    code: string;
    name?: string;          // ticker_name → dùng làm tooltip trên mã
    data?: IndexData;
    detailHref?: string;    // bấm tên; undefined = không điều hướng
    chartHref: string;      // bấm icon chart
}

const fmt = {
    price: (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    diff: (n: number) => { const v = parseFloat(n.toFixed(2)); return `${v > 0 ? '+' : ''}${v.toFixed(2)}`; },
    pct: (n: number) => { const v = parseFloat((n * 100).toFixed(2)); return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`; },
    vsi: (n: number) => `${(n * 100).toFixed(0)}%`,
    gtgd: (n: number) => {
        const v = n * 1_000_000_000; // trading_value pre-divided by 1e9 (xem cảnh báo data ở plan)
        // VN không quen đơn vị "T" (nghìn tỷ) → dừng ở B, nghìn tỷ hiển thị dạng vài-nghìn B
        if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
        if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
        if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
        return `${v}`;
    },
};

export default function IndexCard({ code, name, data, detailHref, chartHref }: Props) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const router = useRouter();

    // Chưa có data → thẻ placeholder
    if (!data) {
        return (
            <Box sx={{
                px: 1, py: 0.5,
                borderRadius: `${borderRadius.sm}px`,
                bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            }}>
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold, color: 'text.secondary' }}>
                    {code}
                </Typography>
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.disabled', mt: 0.25 }}>—</Typography>
            </Box>
        );
    }

    const changeColor = getTrendColor(data.pct_change * 100, theme);
    const cardBg = `linear-gradient(90deg, ${alpha(changeColor, 0.1)} 0%, ${alpha(changeColor, 0.05)} 50%, ${alpha(changeColor, 0.01)} 100%)`;
    const cardBgHover = `linear-gradient(90deg, ${alpha(changeColor, 0.2)} 0%, ${alpha(changeColor, 0.1)} 50%, ${alpha(changeColor, 0.02)} 100%)`;

    const tooltipSlotProps = {
        tooltip: {
            sx: {
                bgcolor: isDark ? alpha('#1e1e1e', 0.92) : alpha('#fff', 0.92),
                color: 'text.primary',
                border: 'none',
                borderRadius: `${borderRadius.sm}px`,
                fontSize: getResponsiveFontSize('xs'),
                fontWeight: fontWeight.medium,
                backdropFilter: 'blur(8px)',
                boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.15)',
                px: 1, py: 0.5,
            },
        },
    };

    const codeNode = (
        <Typography
            component={detailHref ? 'a' : 'span'}
            href={detailHref}
            onClick={detailHref ? (e: React.MouseEvent) => { e.preventDefault(); router.push(detailHref); } : undefined}
            sx={{
                fontSize: getResponsiveFontSize('xs'),
                fontWeight: fontWeight.bold,
                color: changeColor,
                textDecoration: 'none',
                cursor: detailHref ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                '&:hover': detailHref ? { textDecoration: 'underline' } : {},
            }}
        >
            {code}
        </Typography>
    );

    return (
        <Box sx={{
            px: 1, py: 0.5,
            borderRadius: `${borderRadius.sm}px`,
            background: cardBg,
            border: `1px solid ${alpha(changeColor, 0.5)}`,
            transition: `background ${durations.fast}, border-color ${durations.fast}`,
            '&:hover': { background: cardBgHover, borderColor: alpha(changeColor, 0.4) },
        }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '4fr 3fr 3fr', alignItems: 'center' }}>
                {/* [0,0] mã + icon chart */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                    {name ? (
                        <Tooltip title={name} placement="top" arrow={false} slotProps={tooltipSlotProps}>
                            {codeNode}
                        </Tooltip>
                    ) : codeNode}
                    <Tooltip title="Mở chart" placement="right" arrow={false} slotProps={tooltipSlotProps}>
                        <Box
                            component="span"
                            onClick={() => router.push(chartHref)}
                            sx={{
                                display: 'inline-flex', alignItems: 'center', cursor: 'pointer',
                                color: alpha(theme.palette.text.secondary, 0.4), flexShrink: 0,
                                transition: `color ${durations.fast}`,
                                '&:hover': { color: theme.palette.primary.main },
                            }}
                        >
                            <TrendingUpIcon sx={{ fontSize: 14 }} />
                        </Box>
                    </Tooltip>
                </Box>
                {/* [0,1] % thay đổi */}
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold, color: changeColor, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
                    {fmt.pct(data.pct_change)}
                </Typography>
                {/* [0,2] VSI */}
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                    {data.vsi != null ? fmt.vsi(data.vsi) : '—'}
                </Typography>
                {/* [1,0] giá */}
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.medium, color: changeColor, fontVariantNumeric: 'tabular-nums', mt: 0.25 }}>
                    {fmt.price(data.close)}
                </Typography>
                {/* [1,1] +/- điểm */}
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.medium, color: changeColor, fontVariantNumeric: 'tabular-nums', textAlign: 'center', mt: 0.25 }}>
                    {fmt.diff(data.diff)}
                </Typography>
                {/* [1,2] GTGD */}
                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.medium, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', textAlign: 'right', mt: 0.25 }}>
                    {data.trading_value != null ? fmt.gtgd(data.trading_value) : '—'}
                </Typography>
            </Box>
        </Box>
    );
}
