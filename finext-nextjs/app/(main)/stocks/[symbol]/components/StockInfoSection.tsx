'use client';

import { useState } from 'react';
import {
    Box, Typography, useTheme, Divider, Dialog, DialogTitle, DialogContent, IconButton, Stack, Chip,
    type Theme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {
    getResponsiveFontSize, fontWeight, borderRadius, getGlassCard, transitions,
} from 'theme/tokens';
import type { IndexRawData } from '../../../home/components/marketSection/IndexDetailPanel';

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
}

const OVERVIEW_CLAMP_CHARS = 280;

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
    const isLong = text.length > OVERVIEW_CLAMP_CHARS;
    const display = isLong ? `${text.slice(0, OVERVIEW_CLAMP_CHARS).trimEnd()}…` : text;

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
            <Typography sx={{
                fontSize: getResponsiveFontSize('sm'),
                color: theme.palette.text.secondary,
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
            }}>
                {display}
                {isLong && (
                    <Box
                        component="span"
                        onClick={() => setOpen(true)}
                        sx={{
                            ml: 0.5,
                            color: theme.palette.primary.main,
                            cursor: 'pointer',
                            fontWeight: fontWeight.semibold,
                            transition: transitions.colors,
                            '&:hover': { textDecoration: 'underline' },
                        }}
                    >
                        Xem thêm
                    </Box>
                )}
            </Typography>
            <FullTextDialog open={open} title={title} content={text} onClose={() => setOpen(false)} />
        </Box>
    );
}

// ─── Main ───
export default function StockInfoSection({ info, todayData }: StockInfoSectionProps) {
    const theme = useTheme();
    const latest = todayData.length > 0 ? todayData[todayData.length - 1] : null;

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
