'use client';

import { useMemo } from 'react';
import { Box, Typography, Divider, useTheme, useMediaQuery } from '@mui/material';
import {
    getResponsiveFontSize,
    fontWeight,
    borderRadius,
    getGlassCard,
} from 'theme/tokens';
import { getTrendColor } from 'theme/colorHelpers';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NNTDRecord {
    date: string;
    ticker: string;
    sell_volume: number;
    buy_volume: number;
    sell_value: number;
    buy_value: number;
    net_volume: number;
    net_value: number;
    type: string;
}

interface NNTDSummaryPanelProps {
    data: NNTDRecord[];
}

// ── StatRow ───────────────────────────────────────────────────────────────────

function StatRow({ label, value, color, compact }: { label: string; value: string; color?: string; compact?: boolean }) {
    const theme = useTheme();
    return (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: compact ? 0.5 : 1.5, px: 0.5 }}>
            <Typography sx={{
                fontSize: getResponsiveFontSize('xs'),
                color: theme.palette.text.secondary,
                fontWeight: fontWeight.medium,
            }}>
                {label}
            </Typography>
            <Typography sx={{
                fontSize: getResponsiveFontSize('sm'),
                fontWeight: fontWeight.semibold,
                color: color || theme.palette.text.primary,
            }}>
                {value}
            </Typography>
        </Box>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NNTDSummaryPanel({ data }: NNTDSummaryPanelProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isDark = theme.palette.mode === 'dark';

    const glassStyles = useMemo(() => {
        const g = getGlassCard(isDark);
        return { background: g.background, backdropFilter: g.backdropFilter, WebkitBackdropFilter: g.WebkitBackdropFilter, border: g.border };
    }, [isDark]);

    const isLoading = !data || data.length === 0;

    // Aggregate: lấy records ngày mới nhất có dữ liệu thực
    const summary = useMemo(() => {
        if (!data || data.length === 0) {
            return null;
        }

        // Lấy danh sách ngày duy nhất, sắp xếp giảm dần
        const uniqueDates = Array.from(new Set(data.map((r) => r.date))).sort((a, b) => b.localeCompare(a));

        // Tìm ngày mới nhất có dữ liệu thực (không phải toàn 0)
        let targetDate = uniqueDates[0];
        for (const date of uniqueDates) {
            const records = data.filter((r) => r.date === date);
            const hasData = records.some(
                (r) => r.buy_volume !== 0 || r.sell_volume !== 0 || r.net_volume !== 0 ||
                    r.buy_value !== 0 || r.sell_value !== 0 || r.net_value !== 0
            );
            if (hasData) {
                targetDate = date;
                break;
            }
        }

        const latestRecords = data.filter((r) => r.date === targetDate);

        const buyVolume = latestRecords.reduce((sum, r) => sum + (r.buy_volume || 0), 0);
        const sellVolume = latestRecords.reduce((sum, r) => sum + (r.sell_volume || 0), 0);
        const netVolume = latestRecords.reduce((sum, r) => sum + (r.net_volume || 0), 0);
        const buyValue = latestRecords.reduce((sum, r) => sum + (r.buy_value || 0), 0);
        const sellValue = latestRecords.reduce((sum, r) => sum + (r.sell_value || 0), 0);
        const netValue = latestRecords.reduce((sum, r) => sum + (r.net_value || 0), 0);

        return { buyVolume, sellVolume, netVolume, buyValue, sellValue, netValue };
    }, [data]);

    const DASH = '—';
    const formatVolume = (v: number) => v.toLocaleString('en-US');
    const formatValue = (v: number) => `${v.toFixed(2)} tỷ`;

    return (
        <Box sx={{
            ...glassStyles,
            borderRadius: `${borderRadius.lg}px`,
            p: isMobile ? 1 : 1.5,
            height: '100%',
        }}>
            {/* Volume section */}
            <StatRow
                label="KL Mua"
                value={isLoading || !summary ? DASH : formatVolume(summary.buyVolume)}
                color={isLoading || !summary ? theme.palette.text.secondary : theme.palette.trend.up}
                compact={isMobile}
            />
            <StatRow
                label="KL Bán"
                value={isLoading || !summary ? DASH : formatVolume(summary.sellVolume)}
                color={isLoading || !summary ? theme.palette.text.secondary : theme.palette.trend.down}
                compact={isMobile}
            />
            <StatRow
                label="KL Mua-Bán"
                value={isLoading || !summary ? DASH : formatVolume(summary.netVolume)}
                color={isLoading || !summary ? theme.palette.text.secondary : getTrendColor(summary.netVolume, theme)}
                compact={isMobile}
            />

            <Divider sx={{ my: isMobile ? 0.5 : 1 }} />

            {/* Value section */}
            <StatRow
                label="GT Mua"
                value={isLoading || !summary ? DASH : formatValue(summary.buyValue)}
                color={isLoading || !summary ? theme.palette.text.secondary : theme.palette.trend.up}
                compact={isMobile}
            />
            <StatRow
                label="GT Bán"
                value={isLoading || !summary ? DASH : formatValue(summary.sellValue)}
                color={isLoading || !summary ? theme.palette.text.secondary : theme.palette.trend.down}
                compact={isMobile}
            />
            <StatRow
                label="GT Mua-Bán"
                value={isLoading || !summary ? DASH : formatValue(summary.netValue)}
                color={isLoading || !summary ? theme.palette.text.secondary : getTrendColor(summary.netValue, theme)}
                compact={isMobile}
            />
        </Box>
    );
}
