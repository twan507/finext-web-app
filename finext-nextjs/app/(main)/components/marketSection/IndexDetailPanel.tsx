'use client';

import { Box, Typography, useTheme, useMediaQuery, Divider } from '@mui/material';
import InfoTooltip from 'components/common/InfoTooltip';
import { getTrendColor, getVsiColor } from 'theme/colorHelpers';
import {
    getResponsiveFontSize,
    fontWeight,
    borderRadius,
    getGlassCard,
} from 'theme/tokens';

import type { RawMarketData } from './MarketIndexChart';

// Extended type cho index data với các trường bổ sung từ home_today_index
export interface IndexRawData extends RawMarketData {
    trading_value?: number;
    w_pct?: number;
    m_pct?: number;
    q_pct?: number;
    y_pct?: number;
    vsi?: number;
}

// ========== STAT ROW (label trái, value phải) ==========
function StatRow({ label, value, color, tooltip }: { label: string; value: string; color?: string; tooltip?: string }) {
    const theme = useTheme();
    return (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: { xs: 0.5, md: 1 }, px: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{
                    fontSize: getResponsiveFontSize('sm'),
                    color: theme.palette.text.secondary,
                    fontWeight: fontWeight.medium,
                }}>
                    {label}
                </Typography>
                {tooltip && <InfoTooltip title={tooltip} />}
            </Box>
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

// ========== INDEX DETAIL PANEL ==========
interface IndexDetailPanelProps {
    indexName: string;
    todayData: IndexRawData[];
}

export default function IndexDetailPanel({ indexName, todayData }: IndexDetailPanelProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    // Lấy record mới nhất (cuối mảng)
    const latest = todayData.length > 0 ? todayData[todayData.length - 1] : null;

    const glassStyles = (() => {
        const g = getGlassCard(isDark);
        return { background: g.background, backdropFilter: g.backdropFilter, WebkitBackdropFilter: g.WebkitBackdropFilter, border: g.border };
    })();

    const formatPct = (v: number | undefined | null) => {
        if (v == null) return '—';
        return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
    };
    const formatPrice = (v: number | undefined | null) => {
        if (v == null) return '—';
        return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    const formatVolume = (v: number | undefined | null) => {
        if (v == null) return '—';
        return v.toLocaleString('en-US');
    };
    const formatValue = (v: number | undefined | null) => {
        if (v == null) return '—';
        return `${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tỷ`;
    };
    const formatVsi = (v: number | undefined | null) => {
        if (v == null) return '—';
        return `${(v * 100).toFixed(2)}%`;
    };

    // ── MOBILE layout ──────────────────────────────────────────────────
    const MobilePanel = () => {
        const pctItems = [
            { label: '% Tuần', value: latest?.w_pct },
            { label: '% Tháng', value: latest?.m_pct },
            { label: '% Quý', value: latest?.q_pct },
            { label: '% Năm', value: latest?.y_pct },
        ];

        return (
            <Box sx={{ ...glassStyles, borderRadius: `${borderRadius.lg}px`, p: 1.5 }}>
                {/* Biến động – 4 items 1 hàng ngang */}
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    px: 0.5,
                    pb: 0.5,
                }}>
                    {pctItems.map((item) => {
                        const color = item.value != null ? getTrendColor(item.value, theme) : theme.palette.text.primary;
                        return (
                            <Box key={item.label} sx={{ textAlign: 'center' }}>
                                <Typography sx={{
                                    fontSize: getResponsiveFontSize('xs'),
                                    color: theme.palette.text.secondary,
                                    fontWeight: fontWeight.medium,
                                    mb: 0.25,
                                }}>
                                    {item.label}
                                </Typography>
                                <Typography sx={{
                                    fontSize: getResponsiveFontSize('sm'),
                                    fontWeight: fontWeight.bold,
                                    color,
                                }}>
                                    {formatPct(item.value)}
                                </Typography>
                            </Box>
                        );
                    })}
                </Box>

                {/* Thanh khoản */}
                <Divider sx={{ my: 0.75 }} />
                <StatRow
                    label="Chỉ số thanh khoản"
                    value={formatVsi(latest?.vsi)}
                    color={latest?.vsi != null ? getVsiColor(latest.vsi, theme) : undefined}
                    tooltip="Tỉ lệ thanh khoản phiên hiện tại so với trung bình 5 phiên gần nhất. Giá trị > 120% cho thấy đột biến về mặt thanh khoản."
                />
                <StatRow label="Khối lượng giao dịch" value={formatVolume(latest?.volume)} />
                <StatRow label="Giá trị giao dịch" value={formatValue(latest?.trading_value)} />
            </Box>
        );
    };

    // ── DESKTOP layout ──────────────────────────────────────────────────
    const DesktopPanel = () => (
        <Box sx={{ ...glassStyles, borderRadius: `${borderRadius.lg}px`, p: 2 }}>
            {/* Title */}
            <Typography sx={{
                fontSize: getResponsiveFontSize('md'),
                fontWeight: fontWeight.bold,
                color: theme.palette.text.primary,
                mb: 1.5,
            }}>
                Thông tin chi tiết {indexName}
            </Typography>

            {/* Section 1: OHLC */}
            <StatRow label="Open" value={formatPrice(latest?.open)} />
            <StatRow label="High" value={formatPrice(latest?.high)} color={theme.palette.trend.up} />
            <StatRow label="Low" value={formatPrice(latest?.low)} color={theme.palette.trend.down} />
            <StatRow
                label="Close"
                value={formatPrice(latest?.close)}
                tooltip="Giá đóng cửa phiên gần nhất, hoặc giá khớp lệnh mới nhất nếu phiên đang diễn ra."
            />
            <Divider sx={{ my: 1 }} />

            {/* Section 2: Biến động */}
            <StatRow label="% Tuần" value={formatPct(latest?.w_pct)} color={latest?.w_pct != null ? getTrendColor(latest.w_pct, theme) : undefined} />
            <StatRow label="% Tháng" value={formatPct(latest?.m_pct)} color={latest?.m_pct != null ? getTrendColor(latest.m_pct, theme) : undefined} />
            <StatRow label="% Quý" value={formatPct(latest?.q_pct)} color={latest?.q_pct != null ? getTrendColor(latest.q_pct, theme) : undefined} />
            <StatRow label="% Năm" value={formatPct(latest?.y_pct)} color={latest?.y_pct != null ? getTrendColor(latest.y_pct, theme) : undefined} />

            {/* Section 3: Thanh khoản */}
            <Divider sx={{ my: 1 }} />
            <StatRow
                label="Chỉ số thanh khoản"
                value={formatVsi(latest?.vsi)}
                color={latest?.vsi != null ? getVsiColor(latest.vsi, theme) : undefined}
                tooltip="Tỉ lệ thanh khoản phiên hiện tại so với trung bình 5 phiên gần nhất. Giá trị > 120% cho thấy đột biến về mặt thanh khoản."
            />
            <StatRow label="Khối lượng giao dịch" value={formatVolume(latest?.volume)} />
            <StatRow label="Giá trị giao dịch" value={formatValue(latest?.trading_value)} />
        </Box>
    );

    return (
        <>
            <Box sx={{ display: { xs: 'block', md: 'none' } }}><MobilePanel /></Box>
            <Box sx={{ display: { xs: 'none', md: 'block' } }}><DesktopPanel /></Box>
        </>
    );
}
