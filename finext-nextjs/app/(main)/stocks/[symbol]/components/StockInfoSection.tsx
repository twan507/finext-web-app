'use client';

import { useState, useRef, useLayoutEffect } from 'react';
import {
    Box, Typography, useTheme, Divider, Dialog, DialogTitle, DialogContent, IconButton, Stack, Chip,
    type Theme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {
    getResponsiveFontSize, fontWeight, borderRadius, getGlassCard, transitions,
} from 'theme/tokens';
import InfoTooltip from 'components/common/InfoTooltip';
import type { IndexRawData } from '../../../home/components/marketSection/IndexDetailPanel';

const GROUP_FIELDS: { key: 'industry_name' | 'category_name' | 'marketcap_name'; label: string; tooltip: string }[] = [
    { key: 'industry_name', label: 'Ngành nghề', tooltip: 'Ngành nghề của cổ phiếu' },
    { key: 'category_name', label: 'Nhóm dòng tiền', tooltip: 'Nhóm dòng tiền của cổ phiếu' },
    { key: 'marketcap_name', label: 'Nhóm vốn hoá', tooltip: 'Nhóm vốn hoá của cổ phiếu' },
];

export interface StockInfoData {
    ticker: string;
    exchange?: string;
    name?: string;
    overview?: string;
    business_area?: string;
}

interface StockInfoSectionProps {
    info: StockInfoData | null;
    todayData: IndexRawData[];
    marketCap?: number | null;
}

const OVERVIEW_LINE_CLAMP = 5;

// Helpers — đồng bộ với MarketIndexChart header
const getChangeColor = (pctPercent: number, theme: Theme): string => {
    if (Math.abs(pctPercent) <= 0.005) return theme.palette.trend.ref;
    return pctPercent > 0 ? theme.palette.trend.up : theme.palette.trend.down;
};
const getArrow = (pctPercent: number): string => {
    if (Math.abs(pctPercent) <= 0.005) return '';
    return pctPercent > 0 ? '▲' : '▼';
};

// ─── Modal full-text ───
function FullTextDialog({ open, title, content, onClose }: {
    open: boolean; title: string; content: string; onClose: () => void;
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const glass = getGlassCard(isDark);
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            slotProps={{
                backdrop: {
                    sx: {
                        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.18)',
                    },
                },
            }}
            PaperProps={{
                sx: {
                    ...glass,
                    background: isDark ? 'rgba(28, 28, 32, 0.85)' : 'rgba(255, 255, 255, 0.92)',
                    backgroundImage: 'none',
                    borderRadius: `${borderRadius.lg}px`,
                },
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: getResponsiveFontSize('lg'),
                fontWeight: fontWeight.bold,
                pr: 1,
            }}>
                {title}
                <IconButton onClick={onClose} size="small">
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>
            <DialogContent>
                <Typography sx={{
                    fontSize: getResponsiveFontSize('sm'),
                    color: theme.palette.text.primary,
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.7,
                }}>
                    {content}
                </Typography>
            </DialogContent>
        </Dialog>
    );
}

// ─── Block text với "Xem thêm" ───
function ExpandableTextBlock({ title, text }: { title: string; text: string }) {
    const theme = useTheme();
    const [open, setOpen] = useState(false);
    const textRef = useRef<HTMLParagraphElement>(null);
    const [isOverflowing, setIsOverflowing] = useState(false);

    useLayoutEffect(() => {
        const el = textRef.current;
        if (!el) return;
        const check = () => {
            // +1 buffer cho sub-pixel rounding
            setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
        };
        check();
        const ro = new ResizeObserver(check);
        ro.observe(el);
        return () => ro.disconnect();
    }, [text]);

    const fadeColor = theme.palette.background.default;

    return (
        <Box>
            <Typography sx={{
                fontSize: getResponsiveFontSize('md'),
                fontWeight: fontWeight.bold,
                color: theme.palette.text.primary,
                mb: 1,
            }}>
                {title}
            </Typography>
            <Box sx={{ position: 'relative' }}>
                <Typography
                    ref={textRef}
                    sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        color: theme.palette.text.secondary,
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                        display: '-webkit-box',
                        WebkitLineClamp: OVERVIEW_LINE_CLAMP,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}
                >
                    {text}
                </Typography>
                {isOverflowing && (
                    <Box
                        component="span"
                        onClick={() => setOpen(true)}
                        sx={{
                            position: 'absolute',
                            right: 0,
                            bottom: 0,
                            fontSize: getResponsiveFontSize('sm'),
                            lineHeight: 1.7,
                            color: theme.palette.primary.main,
                            cursor: 'pointer',
                            fontWeight: fontWeight.semibold,
                            pl: 6,
                            background: `linear-gradient(to right, transparent 0, ${fadeColor} 32px)`,
                            transition: transitions.colors,
                            '&:hover': { textDecoration: 'underline' },
                        }}
                    >
                        Xem thêm
                    </Box>
                )}
            </Box>
            <FullTextDialog open={open} title={title} content={text} onClose={() => setOpen(false)} />
        </Box>
    );
}

// ─── Main ───
export default function StockInfoSection({ info, todayData, marketCap }: StockInfoSectionProps) {
    const theme = useTheme();
    const latest = todayData.length > 0 ? todayData[todayData.length - 1] : null;
    const marketCapDisplay = marketCap == null
        ? '—'
        : `${marketCap.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tỷ`;

    const currentPrice = latest?.close ?? 0;
    const priceChange = parseFloat((latest?.diff ?? 0).toFixed(2));
    const percentChange = parseFloat(((latest?.pct_change ?? 0) * 100).toFixed(2));
    const isPositive = priceChange >= 0;
    const changeColor = getChangeColor(percentChange, theme);
    const arrow = getArrow(percentChange);
    const showSign = priceChange !== 0 && Math.abs(percentChange) > 0.005;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Biến động giá (trên) — đồng bộ với MarketIndexChart header */}
            <Box>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Typography
                        variant="h4"
                        sx={{
                            fontWeight: fontWeight.bold,
                            color: theme.palette.text.primary,
                            fontSize: getResponsiveFontSize('h3'),
                        }}
                    >
                        {currentPrice.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}
                    </Typography>
                    <Typography
                        sx={{
                            color: changeColor,
                            fontWeight: fontWeight.bold,
                            fontSize: getResponsiveFontSize('lg'),
                        }}
                    >
                        {showSign ? (isPositive ? '+' : '-') : ''}
                        {Math.abs(priceChange).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}
                    </Typography>
                    <Chip
                        label={`${arrow}${arrow ? ' ' : ''}${Math.abs(percentChange).toFixed(2)}%`}
                        size="small"
                        sx={{
                            backgroundColor: changeColor,
                            color: '#ffffff',
                            fontWeight: fontWeight.bold,
                            fontSize: getResponsiveFontSize('md'),
                            height: 24,
                        }}
                    />
                </Stack>
                {/* Tên công ty (dưới) — md, secondary, không đậm */}
                {info?.name && (
                    <Typography
                        sx={{
                            color: theme.palette.text.secondary,
                            fontSize: getResponsiveFontSize('md'),
                            mt: 0.5,
                        }}
                    >
                        {info.name}
                    </Typography>
                )}

                {/* Vốn hoá | Ngành nghề | Nhóm dòng tiền | Nhóm vốn hoá */}
                <Box sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    columnGap: 'clamp(16px, 4vw, 80px)',
                    rowGap: 2,
                    mt: 2,
                }}>
                    {/* Vốn hoá (leftmost) */}
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                            <Typography sx={{
                                fontSize: getResponsiveFontSize('xs'),
                                color: theme.palette.text.secondary,
                                fontWeight: fontWeight.medium,
                            }}>
                                Vốn hoá
                            </Typography>
                            <InfoTooltip title="Tổng giá trị thị trường (tỷ đồng)" />
                        </Box>
                        <Typography sx={{
                            fontSize: getResponsiveFontSize('sm'),
                            fontWeight: fontWeight.semibold,
                            color: theme.palette.text.primary,
                        }}>
                            {marketCapDisplay}
                        </Typography>
                    </Box>

                    {GROUP_FIELDS.map((field) => (
                        <Box key={field.key}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                <Typography sx={{
                                    fontSize: getResponsiveFontSize('xs'),
                                    color: theme.palette.text.secondary,
                                    fontWeight: fontWeight.medium,
                                }}>
                                    {field.label}
                                </Typography>
                                <InfoTooltip title={field.tooltip} />
                            </Box>
                            <Typography sx={{
                                fontSize: getResponsiveFontSize('sm'),
                                fontWeight: fontWeight.semibold,
                                color: theme.palette.text.primary,
                            }}>
                                {(latest as any)?.[field.key] || '—'}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            </Box>

            <Divider />

            {/* Overview | Lĩnh vực kinh doanh — vertical divider giữa */}
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1px 1fr' },
                columnGap: { xs: 0, md: 3 },
                rowGap: { xs: 2.5, md: 0 },
            }}>
                <ExpandableTextBlock title="Tổng quan" text={info?.overview || '—'} />
                <Box sx={{
                    display: { xs: 'none', md: 'block' },
                    bgcolor: theme.palette.divider,
                    width: '1px',
                    alignSelf: 'stretch',
                }} />
                <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                    <Divider />
                </Box>
                <ExpandableTextBlock title="Lĩnh vực kinh doanh" text={info?.business_area || '—'} />
            </Box>
        </Box>
    );
}
