'use client';

import React, { useMemo, useState, useRef } from 'react';
import {
    Box,
    Typography,
    IconButton,
    Tooltip,
    Autocomplete,
    TextField,
    useTheme,
    alpha,
    Menu,
    MenuItem,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CloseIcon from '@mui/icons-material/Close';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { fontWeight, getResponsiveFontSize, borderRadius, durations } from 'theme/tokens';
import { getPriceColor, getVsiColor, getTrendColor } from 'theme/colorHelpers';

interface StockData {
    ticker: string;
    close: number;
    diff: number;
    pct_change: number;
    vsi: number;
    trading_value?: number;
    exchange?: string;
}

interface TickerOption {
    ticker: string;
    name: string;
}

type WatchlistSort = 'pct_change_asc' | 'pct_change_desc' | 'vsi_asc' | 'vsi_desc' | 'trading_value_asc' | 'trading_value_desc' | 'manual';

const SORT_OPTIONS: { key: WatchlistSort; label: string }[] = [
    { key: 'manual',             label: 'Thủ công' },
    { key: 'pct_change_desc',    label: '% Thay đổi ↓' },
    { key: 'pct_change_asc',     label: '% Thay đổi ↑' },
    { key: 'vsi_desc',           label: 'Thanh khoản ↓' },
    { key: 'vsi_asc',            label: 'Thanh khoản ↑' },
    { key: 'trading_value_desc', label: 'GTGD ↓' },
    { key: 'trading_value_asc',  label: 'GTGD ↑' },
];

interface Watchlist {
    id: string;
    _id?: string;
    name: string;
    coordinate: [number, number];
    stock_symbols: string[];
    page?: number;
    sort?: WatchlistSort;
}

interface WatchlistColumnProps {
    watchlist: Watchlist;
    stockDataMap: Map<string, StockData>;
    allTickers: TickerOption[];
    onDelete: () => void;
    onRenameSubmit: (newName: string) => void;
    onSortChange: (sort: WatchlistSort) => void;
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
    onRenameSubmit,
    onSortChange,
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

    // Menu state
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

    // Inline rename state
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(watchlist.name);
    const renameInputRef = useRef<HTMLInputElement>(null);

    const startRename = () => {
        setRenameValue(watchlist.name);
        setIsRenaming(true);
        setTimeout(() => renameInputRef.current?.select(), 0);
    };

    const commitRename = () => {
        const trimmed = renameValue.trim();
        if (trimmed && trimmed !== watchlist.name) {
            onRenameSubmit(trimmed);
        }
        setIsRenaming(false);
    };

    const cancelRename = () => {
        setRenameValue(watchlist.name);
        setIsRenaming(false);
    };

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

    // Sorted tickers
    const sortedTickers = useMemo(() => {
        const tickers = watchlist.stock_symbols;
        const sort = watchlist.sort ?? 'manual';
        if (sort === 'manual') return tickers;
        return [...tickers].sort((a, b) => {
            const da = stockDataMap.get(a);
            const db = stockDataMap.get(b);
            let av = 0, bv = 0;
            if (sort.startsWith('pct_change')) { av = da?.pct_change ?? 0; bv = db?.pct_change ?? 0; }
            else if (sort.startsWith('vsi'))   { av = da?.vsi ?? 0;        bv = db?.vsi ?? 0; }
            else                               { av = da?.trading_value ?? 0; bv = db?.trading_value ?? 0; }
            return sort.endsWith('_asc') ? av - bv : bv - av;
        });
    }, [watchlist.stock_symbols, watchlist.sort, stockDataMap]);

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
        gtgd: (n: number) => {
            // n is pre-divided by 10^9, restore then format
            const v = n * 1_000_000_000;
            if (v >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(1)}T`;
            if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
            if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
            if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
            return `${v}`;
        },
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
            {/* ── Header — toàn bộ là drag area ── */}
            <Box
                {...(dragHandleProps ?? {})}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 0.75,
                    py: 0.5,
                    borderBottom: collapsed ? 'none' : `1px solid ${divider}`,
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    cursor: dragHandleProps ? 'grab' : 'default',
                    userSelect: 'none',
                    '&:active': { cursor: dragHandleProps ? 'grabbing' : 'default' },
                }}
            >
                {/* Collapse button — stopPropagation để không trigger drag */}
                <IconButton
                    size="small"
                    onClick={() => setCollapsed(c => !c)}
                    onPointerDown={e => e.stopPropagation()}
                    sx={{ color: 'text.disabled', p: 0.25, mr: 0.25, flexShrink: 0, '&:hover': { color: 'text.secondary' } }}
                >
                    {collapsed
                        ? <ExpandMoreIcon sx={{ fontSize: 16 }} />
                        : <ExpandLessIcon sx={{ fontSize: 16 }} />
                    }
                </IconButton>

                {/* Name — double-click để đổi tên inline */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flex: 1 }}>
                    {isRenaming ? (
                        <TextField
                            inputRef={renameInputRef}
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={e => {
                                e.stopPropagation(); // ngăn dnd-kit bắt Space/Enter
                                if (e.key === 'Enter') commitRename();
                                if (e.key === 'Escape') cancelRename();
                            }}
                            onPointerDown={e => e.stopPropagation()}
                            variant="standard"
                            size="small"
                            autoFocus
                            InputProps={{
                                disableUnderline: false,
                                sx: {
                                    fontSize: getResponsiveFontSize('sm'),
                                    fontWeight: fontWeight.bold,
                                    px: 0,
                                },
                            }}
                            sx={{ flex: 1, minWidth: 0 }}
                        />
                    ) : (
                        <Typography
                            onDoubleClick={e => { e.stopPropagation(); startRename(); }}
                            sx={{
                                fontSize: getResponsiveFontSize('sm'),
                                fontWeight: fontWeight.bold,
                                color: 'text.primary',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                cursor: 'text',
                            }}
                        >
                            {watchlist.name}
                        </Typography>
                    )}
                    {aggregateChange != null && !isRenaming && (
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

                {/* ⋮ Menu button */}
                <Tooltip title="Tùy chỉnh" placement="top" arrow={false} slotProps={tooltipSlotProps}>
                    <IconButton
                        size="small"
                        onClick={e => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
                        onPointerDown={e => e.stopPropagation()}
                        sx={{ color: 'text.disabled', p: 0.25, flexShrink: 0, '&:hover': { color: 'text.secondary' } }}
                    >
                        <MoreVertIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Popup menu */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                slotProps={{
                    paper: {
                        sx: {
                            bgcolor: isDark ? 'rgba(22,22,26,0.72)' : 'rgba(255,255,255,0.72)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'}`,
                            borderRadius: `${borderRadius.md}px`,
                            boxShadow: isDark
                                ? '0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)'
                                : '0 8px 24px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
                            overflow: 'hidden',
                            px: 0.5,
                        },
                    },
                }}
                transformOrigin={{ horizontal: 'left', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
            >

                {/* Sort options */}
                {SORT_OPTIONS.map(opt => {
                    const active = (watchlist.sort ?? 'manual') === opt.key;
                    return (
                        <MenuItem
                            key={opt.key}
                            onClick={() => { setMenuAnchor(null); onSortChange(opt.key); }}
                            sx={{
                                py: 0.4,
                                px: 1,
                                gap: 0.75,
                                fontSize: getResponsiveFontSize('xs'),
                                borderRadius: `${borderRadius.sm}px`,
                                color: active ? 'primary.main' : 'text.secondary',
                                fontWeight: active ? fontWeight.semibold : 400,
                                '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                            }}
                        >
                            <Box component="span" sx={{ width: 10, fontSize: 9, flexShrink: 0, color: 'primary.main' }}>
                                {active ? '●' : ''}
                            </Box>
                            <Box component="span" sx={{ fontSize: getResponsiveFontSize('xs') }}>{opt.label}</Box>
                        </MenuItem>
                    );
                })}

                {/* Divider */}
                <Box sx={{ my: 0.5, mx: 1, height: '1px', bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }} />

                {/* Delete */}
                <MenuItem
                    onClick={() => { setMenuAnchor(null); onDelete(); }}
                    sx={{
                        py: 0.4,
                        px: 1,
                        gap: 0.75,
                        color: 'error.main',
                        fontSize: getResponsiveFontSize('xs'),
                        borderRadius: `${borderRadius.sm}px`,
                        '&:hover': { bgcolor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)' },
                    }}
                >
                    <DeleteIcon sx={{ fontSize: 13, flexShrink: 0 }} />
                    <Box component="span" sx={{ fontSize: getResponsiveFontSize('xs') }}>Xóa danh sách</Box>
                </MenuItem>
            </Menu>

            {/* ── Stock rows ── */}
            <Box sx={{
                flex: 1,
                overflowY: 'auto',
                display: collapsed ? 'none' : 'flex',
                flexDirection: 'column',
                gap: 0.5,
                p: 0.75,
            }}>
                {sortedTickers.map((ticker) => {
                    const data = stockDataMap.get(ticker);

                    if (!data) {
                        return (
                            <Box
                                key={ticker}
                                sx={{
                                    px: 1,
                                    py: 0.5,
                                    borderRadius: `${borderRadius.sm}px`,
                                    bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    '&:hover .remove-btn': { opacity: 1 },
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
                                        '&:hover': { textDecoration: 'underline' },
                                    }}
                                >
                                    {ticker}
                                </Typography>
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
                        );
                    }

                    const changeColor = getPriceColor(data.pct_change, data.exchange, theme);
                    const vsiColor = getVsiColor(data.vsi ?? 0, theme);
                    const cardBg = `linear-gradient(90deg, ${alpha(changeColor, 0.1)} 0%, ${alpha(changeColor, 0.05)} 50%, ${alpha(changeColor, 0.01)} 100%)`;
                    const cardBgHover = `linear-gradient(90deg, ${alpha(changeColor, 0.2)} 0%, ${alpha(changeColor, 0.1)} 50%, ${alpha(changeColor, 0.02)} 100%)`;

                    return (
                        <Box
                            key={ticker}
                            sx={{
                                px: 1,
                                py: 0.5,
                                borderRadius: `${borderRadius.sm}px`,
                                background: cardBg,
                                transition: `background ${durations.fast}`,
                                '&:hover': { background: cardBgHover },
                                '&:hover .remove-btn': { opacity: 1 },
                            }}
                        >
                            {/* Grid 3 cột: left | center tuyệt đối | right */}
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center' }}>
                                {/* [0,0] Ticker + icons */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                                    <Typography
                                        component="a"
                                        href={`/stocks/${ticker}`}
                                        target="_blank"
                                        sx={{
                                            fontSize: getResponsiveFontSize('xs'),
                                            fontWeight: fontWeight.bold,
                                            color: changeColor,
                                            textDecoration: 'none',
                                            '&:hover': { textDecoration: 'underline' },
                                        }}
                                    >
                                        {ticker}
                                    </Typography>
                                    <Tooltip title="Mở chart" placement="right" arrow={false} slotProps={tooltipSlotProps}>
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
                                {/* [0,1] +-% — căn giữa tuyệt đối */}
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('xs'),
                                        fontWeight: fontWeight.semibold,
                                        color: changeColor,
                                        fontVariantNumeric: 'tabular-nums',
                                        textAlign: 'center',
                                    }}
                                >
                                    {fmt.pct(data.pct_change)}
                                </Typography>
                                {/* [0,2] VSI — căn phải */}
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('xs'),
                                        fontWeight: fontWeight.semibold,
                                        color: vsiColor,
                                        fontVariantNumeric: 'tabular-nums',
                                        textAlign: 'right',
                                    }}
                                >
                                    {fmt.vsi(data.vsi ?? 0)}
                                </Typography>

                                {/* [1,0] Giá */}
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('xs'),
                                        fontWeight: fontWeight.medium,
                                        color: 'text.primary',
                                        fontVariantNumeric: 'tabular-nums',
                                        mt: 0.25,
                                    }}
                                >
                                    {fmt.price(data.close)}
                                </Typography>
                                {/* [1,1] +- — căn giữa tuyệt đối */}
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('xs'),
                                        fontWeight: fontWeight.medium,
                                        color: changeColor,
                                        fontVariantNumeric: 'tabular-nums',
                                        textAlign: 'center',
                                        mt: 0.25,
                                    }}
                                >
                                    {fmt.diff(data.diff)}
                                </Typography>
                                {/* [1,2] GTGD — căn phải */}
                                <Typography
                                    sx={{
                                        fontSize: getResponsiveFontSize('xs'),
                                        fontWeight: fontWeight.medium,
                                        color: 'text.secondary',
                                        fontVariantNumeric: 'tabular-nums',
                                        textAlign: 'right',
                                        mt: 0.25,
                                    }}
                                >
                                    {data.trading_value != null ? fmt.gtgd(data.trading_value) : '—'}
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
