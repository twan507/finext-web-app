'use client';

import { useRouter } from 'next/navigation';

import { Dispatch, SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import { Box, Typography, Skeleton, useTheme, useMediaQuery, Divider } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import type { RawMarketData, ChartData, TimeRange } from '../components/MarketIndexChart';
import IndexTable from '../components/IndexTable';
import Carousel from 'components/common/Carousel';
import InfoTooltip from 'components/common/InfoTooltip';
import { getTrendColor, getVsiColor } from 'theme/colorHelpers';

import {
    getResponsiveFontSize,
    fontWeight,
    borderRadius,
    spacing,
    transitions,
    getGlassCard,
} from 'theme/tokens';

// Lazy load heavy chart component
const MarketIndexChart = dynamic(
    () => import('../components/MarketIndexChart').then(mod => ({ default: mod.default })),
    {
        loading: () => <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />,
        ssr: false
    }
);

// ========== INDEX LISTS ==========
const MAIN_INDEXES = ['VNINDEX', 'VN30', 'HNXINDEX', 'UPINDEX'];
const DERIVATIVE_INDEXES = ['VN30F1M', 'VN30F2M', 'VN100F1M', 'VN100F2M'];
const FINEXT_INDEXES = ['FNXINDEX', 'LARGECAP', 'MIDCAP', 'SMALLCAP'];
const MOBILE_INDEXES = ['VNINDEX', 'HNXINDEX', 'UPINDEX', 'FNXINDEX', 'LARGECAP', 'MIDCAP', 'SMALLCAP', 'VN30', 'VN30F1M'];


// Type cho SSE data
type IndexDataByTicker = Record<string, RawMarketData[]>;

// Tab type cho bảng index
type IndexTabType = 'main' | 'derivative' | 'finext';

// Extended type cho index data với các trường bổ sung từ home_today_index
interface IndexRawData extends RawMarketData {
    trading_value?: number;
    w_pct?: number;
    m_pct?: number;
    q_pct?: number;
    y_pct?: number;
    vsi?: number;
}

// ========== PROPS INTERFACE ==========
interface MarketSectionProps {
    ticker: string;
    indexName: string;
    eodData: ChartData;
    intradayData: ChartData;
    isLoading: boolean;
    error: string | null;
    timeRange: TimeRange;
    onTimeRangeChange: Dispatch<SetStateAction<TimeRange>>;
    indexTab: IndexTabType;
    onIndexTabChange: Dispatch<SetStateAction<IndexTabType>>;
    onTickerChange: (newTicker: string) => void;
    todayAllData: IndexDataByTicker;
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
function IndexDetailPanel({ indexName, todayData }: { indexName: string; todayData: IndexRawData[] }) {
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
        return `${Math.round(v).toLocaleString('en-US')} Tỷ`;
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

// ========== INDEX TABLES SECTION (Single merged table on mobile, Row on desktop) ==========
function IndexTablesSection({ ticker, onTickerChange, todayAllData }: {
    ticker: string;
    onTickerChange: (t: string) => void;
    todayAllData: IndexDataByTicker;
}) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const titleSx = {
        fontSize: getResponsiveFontSize('md'),
        fontWeight: fontWeight.semibold,
        color: theme.palette.text.primary,
        ml: 1,
        mb: 1.5,
        pb: 1,
        borderBottom: `2px solid ${theme.palette.primary.main}`,
        display: 'inline-block',
    };

    const tables = [
        { id: 'coso', title: 'Cơ sở', list: MAIN_INDEXES },
        { id: 'phaisinh', title: 'Phái sinh', list: DERIVATIVE_INDEXES },
        { id: 'finext', title: 'Finext', list: FINEXT_INDEXES },
    ];

    // Mobile: gộp tất cả chỉ số thành 1 bảng duy nhất, bỏ tiêu đề
    if (isMobile) {
        return (
            <Box sx={{ mt: 3 }}>
                <IndexTable
                    selectedTicker={ticker}
                    onTickerChange={onTickerChange}
                    indexList={MOBILE_INDEXES}
                    todayAllData={todayAllData}
                />
            </Box>
        );
    }

    // Desktop: 3 cột riêng biệt với tiêu đề
    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 3,
            mt: 3,
            overflowX: 'auto',
            '&::-webkit-scrollbar': { display: 'none' },
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
        }}>
            {tables.map((t) => (
                <Box key={t.id} sx={{ width: 330, flexShrink: 0 }}>
                    <Typography sx={titleSx}>{t.title}</Typography>
                    <IndexTable
                        selectedTicker={ticker}
                        onTickerChange={onTickerChange}
                        indexList={t.list}
                        todayAllData={todayAllData}
                    />
                </Box>
            ))}
        </Box>
    );
}

// ========== MAIN COMPONENT ==========
export default function MarketSection({
    ticker,
    indexName,
    eodData,
    intradayData,
    isLoading,
    error,
    timeRange,
    onTimeRangeChange,
    indexTab,
    onIndexTabChange,
    onTickerChange,
    todayAllData,
}: MarketSectionProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const router = useRouter();

    return (

        <Box>
            {/* Title - Thị trường (clickable) */}
            <Box
                onClick={() => router.push('/markets')}
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    mb: 2,
                }}
            >
                <Typography variant="h1" sx={{ fontSize: getResponsiveFontSize('h1') }}>
                    Thị trường
                </Typography>
                <ChevronRightIcon sx={{ fontSize: getResponsiveFontSize('h2'), mt: 1, color: theme.palette.text.secondary }} />
            </Box>

            {/* ========== TOP SECTION: Chart + Detail Panel ========== */}
            <Box sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: { xs: 2, md: 3 },
            }}>
                {/* Left: Chart */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <MarketIndexChart
                        key={ticker}
                        symbol={ticker}
                        title={`Chỉ số ${indexName}`}
                        eodData={eodData}
                        intradayData={intradayData}
                        isLoading={isLoading}
                        error={error}
                        timeRange={timeRange}
                        onTimeRangeChange={onTimeRangeChange}
                    />
                </Box>

                {/* Right: Index Detail Panel */}
                <Box sx={{
                    width: { xs: '100%', md: 340 },
                    flexShrink: 0,
                }}>
                    <IndexDetailPanel indexName={indexName} todayData={todayAllData[ticker] || []} />
                </Box>
            </Box>

            {/* ========== BOTTOM SECTION: 3 Index Tables ========== */}
            <IndexTablesSection
                ticker={ticker}
                onTickerChange={onTickerChange}
                todayAllData={todayAllData}
            />
        </Box>
    );
}
