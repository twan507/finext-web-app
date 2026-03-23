'use client';

import React, { useMemo, useState } from 'react';
import {
    Box,
    Typography,
    IconButton,
    Tooltip,
    Autocomplete,
    TextField,
    useTheme,
    alpha,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { fontWeight, getResponsiveFontSize, borderRadius, durations } from 'theme/tokens';
import { getPriceColor, getVsiColor, getTrendColor } from 'theme/colorHelpers';

interface StockData {
    ticker: string;
    close: number;
    diff: number;
    pct_change: number;
    vsi: number;
    exchange?: string;
}

interface TickerOption {
    ticker: string;
    name: string;
}

interface Watchlist {
    id: string;
    _id?: string;
    name: string;
    coordinate: [number, number];
    stock_symbols: string[];
}

interface WatchlistColumnProps {
    watchlist: Watchlist;
    stockDataMap: Map<string, StockData>;
    allTickers: TickerOption[];
    onDelete: () => void;
    onRename: () => void;
    onAddStock: (ticker: string) => void;
    onRemoveStock: (ticker: string) => void;
    dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
    forceCollapsed?: boolean;
}

export default function WatchlistColumn({
    watchlist,
    stockDataMap,
    allTickers,
    onDelete,
    onRename,
    onAddStock,
    onRemoveStock,
    dragHandleProps,
    forceCollapsed,
}: WatchlistColumnProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [autocompleteKey, setAutocompleteKey] = useState(0);
    const [collapsedState, setCollapsed] = useState(false);
    const collapsed = forceCollapsed ?? collapsedState;

    // Aggregate pct_change
    const aggregateChange = useMemo(() => {
        let total = 0;
        let count = 0;
        watchlist.stock_symbols.forEach(ticker => {
            const d = stockDataMap.get(ticker);
            if (d && d.pct_change != null) {
                total += d.pct_change;
                count++;
            }
        });
        return count > 0 ? total / count : null;
    }, [watchlist.stock_symbols, stockDataMap]);

    const headerColor = aggregateChange != null
        ? getTrendColor(aggregateChange * 100, theme)
        : theme.palette.text.secondary;

    // Tickers available for autocomplete (exclude already added)
    const tickerOptions = useMemo(() => {
        const existing = new Set(watchlist.stock_symbols);
        return allTickers.filter(t => !existing.has(t.ticker));
    }, [allTickers, watchlist.stock_symbols]);

    const fmt = {
        price: (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        diff: (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}`,
        pct: (n: number) => `${(n * 100) > 0 ? '+' : ''}${(n * 100).toFixed(2)}%`,
        vsi: (n: number) => `${(n * 100).toFixed(0)}%`,
    };

    const divider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

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
                px: 1,
                py: 0.5,
            },
        },
    };

    return (
        <Box
            sx={{
                width: 260,
                flexShrink: 0,
                borderRadius: `${borderRadius.md}px`,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* ── Header ── */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 1.5,
                    py: 0.75,
                    borderBottom: collapsed ? 'none' : `1px solid ${divider}`,
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                }}
            >
                {/* Drag handle */}
                {dragHandleProps && (
                    <Box
                        {...dragHandleProps}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'grab',
                            color: 'text.disabled',
                            mr: 0.5,
                            '&:hover': { color: 'text.secondary' },
                            '&:active': { cursor: 'grabbing' },
                        }}
                    >
                        <DragIndicatorIcon sx={{ fontSize: 16 }} />
                    </Box>
                )}
                <Box
                    onClick={() => setCollapsed(c => !c)}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1, cursor: 'pointer', userSelect: 'none' }}
                >
                    <Typography
                        sx={{
                            fontSize: getResponsiveFontSize('sm'),
                            fontWeight: fontWeight.bold,
                            color: 'text.primary',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {watchlist.name}
                    </Typography>
                    {aggregateChange != null && (
                        <Typography
                            sx={{
                                fontSize: getResponsiveFontSize('xs'),
                                fontWeight: fontWeight.semibold,
                                color: headerColor,
                                flexShrink: 0,
                            }}
                        >
                            {fmt.pct(aggregateChange)}
                        </Typography>
                    )}
                </Box>
                <Box sx={{ display: 'flex', flexShrink: 0, ml: 1 }}>
                    <IconButton size="small" onClick={onRename} sx={{ color: 'text.secondary', p: 0.5 }}>
                        <EditIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                    <IconButton size="small" onClick={onDelete} sx={{ color: 'text.secondary', p: 0.5 }}>
                        <DeleteIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                </Box>
            </Box>

            {/* ── Stock rows ── */}
            <Box sx={{ flex: 1, overflowY: 'auto', display: collapsed ? 'none' : 'block' }}>
                {watchlist.stock_symbols.map((ticker, idx) => {
                    const data = stockDataMap.get(ticker);
                    const isLast = idx === watchlist.stock_symbols.length - 1;

                    if (!data) {
                        return (
                            <Box
                                key={ticker}
                                sx={{
                                    px: 1.5,
                                    py: 0.6,
                                    borderBottom: isLast ? 'none' : `1px solid ${divider}`,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}
                            >
                                <Typography
                                    component="a"
                                    href={`/stocks/${ticker}`}
                                        target="_blank"
                                    sx={{
                                        fontSize: getResponsiveFontSize('xs'),
                                        fontWeight: fontWeight.semibold,
                                        color: 'text.primary',
                                        textDecoration: 'none',
                                        cursor: 'pointer',
                                        '&:hover': { textDecoration: 'underline' },
                                    }}
                                >
                                    {ticker}
                                </Typography>
                                <IconButton
                                    size="small"
                                    onClick={() => onRemoveStock(ticker)}
                                    sx={{ color: 'text.disabled', p: 0.25, opacity: 0, '.MuiBox-root:hover > &': { opacity: 1 } }}
                                >
                                    <CloseIcon sx={{ fontSize: 13 }} />
                                </IconButton>
                            </Box>
                        );
                    }

                    const changeColor = getPriceColor(data.pct_change, data.exchange, theme);
                    const vsiColor = getVsiColor(data.vsi ?? 0, theme);

                    return (
                        <Box
                            key={ticker}
                            sx={{
                                px: 1.5,
                                py: 0.6,
                                borderBottom: isLast ? 'none' : `1px solid ${divider}`,
                                transition: `background ${durations.fast}`,
                                '&:hover': {
                                    bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                                },
                                '&:hover .remove-btn': { opacity: 1 },
                            }}
                        >
                            {/* Line 1: Ticker + chart icon | TK: VSI */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography
                                        component="a"
                                        href={`/stocks/${ticker}`}
                                        target="_blank"
                                        sx={{
                                            fontSize: getResponsiveFontSize('xs'),
                                            fontWeight: fontWeight.bold,
                                            color: changeColor,
                                            textDecoration: 'none',
                                            cursor: 'pointer',
                                            '&:hover': { textDecoration: 'underline' },
                                        }}
                                    >
                                        {ticker}
                                    </Typography>
                                    <Tooltip title="Mở chart" placement="right" arrow={false} componentsProps={tooltipSlotProps}>
                                        <Box
                                            component="span"
                                            onClick={() => window.open(`/charts/${ticker}`, '_blank')}
                                            sx={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                cursor: 'pointer',
                                                color: alpha(theme.palette.text.secondary, 0.4),
                                                flexShrink: 0,
                                                transition: `color ${durations.fast}`,
                                                '&:hover': { color: theme.palette.primary.main },
                                            }}
                                        >
                                            <TrendingUpIcon sx={{ fontSize: 14 }} />
                                        </Box>
                                    </Tooltip>
                                    {/* Remove button — visible on hover */}
                                    <Box
                                        component="span"
                                        className="remove-btn"
                                        onClick={() => onRemoveStock(ticker)}
                                        sx={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            color: alpha(theme.palette.text.secondary, 0.35),
                                            opacity: 0,
                                            transition: `opacity ${durations.fast}, color ${durations.fast}`,
                                            '&:hover': { color: theme.palette.error.main },
                                        }}
                                    >
                                        <CloseIcon sx={{ fontSize: 13 }} />
                                    </Box>
                                </Box>
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('xs'),
                                        fontWeight: fontWeight.semibold,
                                        color: vsiColor,
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {fmt.vsi(data.vsi ?? 0)}
                                </Typography>
                            </Box>

                            {/* Line 2: Price | Diff | Pct% */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.25 }}>
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('xs'),
                                        fontWeight: fontWeight.medium,
                                        color: 'text.primary',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {fmt.price(data.close)}
                                </Typography>
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('xs'),
                                        fontWeight: fontWeight.medium,
                                        color: changeColor,
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {fmt.diff(data.diff)}
                                </Typography>
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('xs'),
                                        fontWeight: fontWeight.semibold,
                                        color: changeColor,
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {fmt.pct(data.pct_change)}
                                </Typography>
                            </Box>
                        </Box>
                    );
                })}

                {watchlist.stock_symbols.length === 0 && (
                    <Typography
                        sx={{
                            px: 1.5,
                            py: 1.5,
                            fontSize: getResponsiveFontSize('xs'),
                            color: 'text.disabled',
                            textAlign: 'center',
                            fontStyle: 'italic',
                        }}
                    >
                        Thêm mã bên dưới
                    </Typography>
                )}
            </Box>

            {/* ── Add stock autocomplete ── */}
            <Box sx={{ px: 1, py: 0.75, borderTop: `1px solid ${divider}`, display: collapsed ? 'none' : 'block' }}>
                <Autocomplete
                    key={autocompleteKey}
                    options={tickerOptions}
                    getOptionLabel={(opt) => opt.ticker}
                    renderOption={(props, opt) => (
                        <Box component="li" {...props} sx={{ display: 'flex', gap: 1, fontSize: getResponsiveFontSize('xs') }}>
                            <Typography
                                component="span"
                                sx={{ fontWeight: fontWeight.bold, fontSize: 'inherit' }}
                            >
                                {opt.ticker}
                            </Typography>
                            {opt.name && (
                                <Typography
                                    component="span"
                                    sx={{ color: 'text.secondary', fontSize: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                >
                                    {opt.name}
                                </Typography>
                            )}
                        </Box>
                    )}
                    filterOptions={(options, { inputValue }) => {
                        const q = inputValue.toUpperCase();
                        if (!q) return options.slice(0, 20);
                        return options
                            .filter(o => o.ticker.includes(q))
                            .slice(0, 20);
                    }}
                    onChange={(_, val) => {
                        if (val) {
                            onAddStock(val.ticker);
                            setAutocompleteKey(k => k + 1);
                        }
                    }}
                    size="small"
                    noOptionsText="Không tìm thấy"
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            placeholder="+ Thêm mã..."
                            variant="standard"
                            InputProps={{
                                ...params.InputProps,
                                disableUnderline: true,
                                sx: { fontSize: getResponsiveFontSize('xs'), px: 0.5 },
                            }}
                        />
                    )}
                    sx={{
                        '& .MuiAutocomplete-popupIndicator': { display: 'none' },
                        '& .MuiAutocomplete-clearIndicator': { display: 'none' },
                    }}
                    slotProps={{
                        paper: {
                            sx: {
                                bgcolor: isDark ? '#1a1a1a' : '#fff',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                borderRadius: `${borderRadius.sm}px`,
                                mt: 0.5,
                            },
                        },
                    }}
                />
            </Box>
        </Box>
    );
}
