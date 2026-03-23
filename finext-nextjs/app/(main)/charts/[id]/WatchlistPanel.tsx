'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
    Box,
    Typography,
    IconButton,
    Autocomplete,
    TextField,
    Button,
    useTheme,
    alpha,

} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';

import { getResponsiveFontSize, fontWeight, borderRadius, durations } from 'theme/tokens';
import { getPriceColor, getVsiColor, getTrendColor } from 'theme/colorHelpers';
import { useSseCache } from 'hooks/useSseCache';
import { apiClient } from 'services/apiClient';
import AddWatchlistDialog from '../../watchlist/components/AddWatchlistDialog';
import ConfirmDialog from '../../watchlist/components/ConfirmDialog';

interface StockData {
    ticker: string;
    ticker_name?: string;
    close: number;
    diff: number;
    pct_change: number;
    vsi: number;
    trading_value?: number;
    exchange?: string;
    industry_name?: string;
}

interface IndustryInfo {
    name: string;
    tickers: string[];
}

interface Watchlist {
    id: string;
    _id?: string;
    name: string;
    coordinate: [number, number];
    stock_symbols: string[];
}

interface TickerOption {
    ticker: string;
    name: string;
}

interface WatchlistPanelProps {
    onTickerChange?: (ticker: string) => void;
}

export default function WatchlistPanel({ onTickerChange }: WatchlistPanelProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogCoordinate, setDialogCoordinate] = useState<[number, number]>([0, 0]);
    const [editingWatchlist, setEditingWatchlist] = useState<Watchlist | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

    // SSE: all stock data
    const { data: stockDataRaw } = useSseCache<StockData[]>({ keyword: 'home_today_stock' });

    const stockDataMap = useMemo(() => {
        const map = new Map<string, StockData>();
        if (stockDataRaw && Array.isArray(stockDataRaw)) {
            stockDataRaw.forEach(item => map.set(item.ticker, item));
        }
        return map;
    }, [stockDataRaw]);

    const allTickers = useMemo(() => {
        if (!stockDataRaw || !Array.isArray(stockDataRaw)) return [];
        return stockDataRaw
            .map(s => ({ ticker: s.ticker, name: s.ticker_name || '' }))
            .sort((a, b) => a.ticker.localeCompare(b.ticker));
    }, [stockDataRaw]);

    const industries = useMemo<IndustryInfo[]>(() => {
        if (!stockDataRaw || !Array.isArray(stockDataRaw)) return [];
        const map = new Map<string, string[]>();
        stockDataRaw.forEach(s => {
            const ind = s.industry_name;
            if (!ind) return;
            if (!map.has(ind)) map.set(ind, []);
            map.get(ind)!.push(s.ticker);
        });
        return Array.from(map.entries())
            .map(([name, tickers]) => ({ name, tickers: tickers.sort() }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [stockDataRaw]);

    const fetchWatchlists = useCallback(async () => {
        try {
            const res = await apiClient<Watchlist[]>({
                url: '/api/v1/watchlists/me',
                method: 'GET',
                requireAuth: true,
            });
            if (res.data) setWatchlists(res.data);
        } catch (err) {
            console.error('Failed to fetch watchlists:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchWatchlists(); }, [fetchWatchlists]);

    // Sort watchlists by coordinate: x first, then y
    const sortedWatchlists = useMemo(() => {
        return [...watchlists].sort((a, b) => {
            if (a.coordinate[0] !== b.coordinate[0]) return a.coordinate[0] - b.coordinate[0];
            return a.coordinate[1] - b.coordinate[1];
        });
    }, [watchlists]);

    // Handlers
    const handleDeleteClick = (id: string) => {
        setDeleteTargetId(id);
        setConfirmOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTargetId) return;
        try {
            await apiClient({ url: `/api/v1/watchlists/${deleteTargetId}`, method: 'DELETE', requireAuth: true });
            setWatchlists(prev => prev.filter(w => (w.id || w._id) !== deleteTargetId));
        } catch (err) {
            console.error('Delete failed:', err);
        }
        setDeleteTargetId(null);
    };

    const openCreate = (coordinate: [number, number]) => {
        setEditingWatchlist(null);
        setDialogCoordinate(coordinate);
        setDialogOpen(true);
    };

    const openRename = (wl: Watchlist) => {
        setEditingWatchlist(wl);
        setDialogCoordinate(wl.coordinate);
        setDialogOpen(true);
    };

    const handleSaved = () => {
        setDialogOpen(false);
        setEditingWatchlist(null);
        fetchWatchlists();
    };

    const handleUpdateStocks = async (wl: Watchlist, newSymbols: string[]) => {
        const wlId = wl.id || wl._id!;
        setWatchlists(prev =>
            prev.map(w => (w.id || w._id) === wlId ? { ...w, stock_symbols: newSymbols } : w),
        );
        try {
            await apiClient({
                url: `/api/v1/watchlists/${wlId}`,
                method: 'PUT',
                body: { stock_symbols: newSymbols },
                requireAuth: true,
            });
        } catch (err) {
            console.error('Update stocks failed:', err);
            setWatchlists(prev =>
                prev.map(w => (w.id || w._id) === wlId ? { ...w, stock_symbols: wl.stock_symbols } : w),
            );
        }
    };

    const toggleCollapse = (id: string) => {
        setCollapsedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const fmt = {
        price: (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        diff: (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}`,
        pct: (n: number) => `${(n * 100) > 0 ? '+' : ''}${(n * 100).toFixed(2)}%`,
        vsi: (n: number) => `${(n * 100).toFixed(0)}%`,
        gtgd: (n: number) => {
            const v = n * 1_000_000_000;
            if (v >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(1)}T`;
            if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
            if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
            if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
            return `${v}`;
        },
    };

    const divider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    // Next available coordinate for "add" button
    const nextCoordinate = useMemo<[number, number]>(() => {
        if (watchlists.length === 0) return [0, 0];
        const maxCol = Math.max(...watchlists.map(w => w.coordinate[0]));
        const inLastCol = watchlists.filter(w => w.coordinate[0] === maxCol);
        const maxRow = Math.max(...inLastCol.map(w => w.coordinate[1]));
        return [maxCol, maxRow + 1];
    }, [watchlists]);

    const renderWatchlistCard = (wl: Watchlist) => {
        const wlId = wl.id || wl._id!;
        const collapsed = collapsedIds.has(wlId);

        // Aggregate pct_change
        let total = 0, count = 0;
        wl.stock_symbols.forEach(ticker => {
            const d = stockDataMap.get(ticker);
            if (d && d.pct_change != null) { total += d.pct_change; count++; }
        });
        const aggregateChange = count > 0 ? total / count : null;
        const headerColor = aggregateChange != null
            ? getTrendColor(aggregateChange * 100, theme)
            : theme.palette.text.secondary;

        // Tickers available for autocomplete
        const existing = new Set(wl.stock_symbols);
        const tickerOptions = allTickers.filter(t => !existing.has(t.ticker));

        return (
            <Box
                key={wlId}
                sx={{
                    borderRadius: `${borderRadius.md}px`,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                    overflow: 'hidden',
                    mb: 1,
                }}
            >
                {/* Header */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 1.5,
                        py: 0.5,
                        borderBottom: collapsed ? 'none' : `1px solid ${divider}`,
                        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    }}
                >
                    <Box
                        onClick={() => toggleCollapse(wlId)}
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flex: 1, cursor: 'pointer', userSelect: 'none' }}
                    >
                        <Typography
                            sx={{
                                fontSize: getResponsiveFontSize('xs'),
                                fontWeight: fontWeight.bold,
                                color: 'text.primary',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {wl.name}
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
                    <Box sx={{ display: 'flex', flexShrink: 0, ml: 0.5 }}>
                        <IconButton size="small" onClick={() => openRename(wl)} sx={{ color: 'text.secondary', p: 0.25 }}>
                            <EditIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteClick(wlId)} sx={{ color: 'text.secondary', p: 0.25 }}>
                            <DeleteIcon sx={{ fontSize: 13 }} />
                        </IconButton>
                    </Box>
                </Box>

                {/* Stock rows */}
                {!collapsed && (
                    <>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 0.75 }}>
                            {wl.stock_symbols.map((ticker) => {
                                const data = stockDataMap.get(ticker);

                                if (!data) {
                                    return (
                                        <Box
                                            key={ticker}
                                            onClick={() => onTickerChange?.(ticker)}
                                            sx={{
                                                px: 1, py: 0.5,
                                                borderRadius: `${borderRadius.sm}px`,
                                                bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                cursor: 'pointer',
                                                '&:hover .remove-btn': { opacity: 1 },
                                            }}
                                        >
                                            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold, color: 'text.primary' }}>
                                                {ticker}
                                            </Typography>
                                            <Box
                                                component="span"
                                                className="remove-btn"
                                                onClick={(e) => { e.stopPropagation(); handleUpdateStocks(wl, wl.stock_symbols.filter(s => s !== ticker)); }}
                                                sx={{ display: 'inline-flex', cursor: 'pointer', opacity: 0, transition: `opacity ${durations.fast}, color ${durations.fast}`, color: alpha(theme.palette.text.secondary, 0.3), '&:hover': { color: theme.palette.error.main } }}
                                            >
                                                <CloseIcon sx={{ fontSize: 12 }} />
                                            </Box>
                                        </Box>
                                    );
                                }

                                const changeColor = getPriceColor(data.pct_change, data.exchange, theme);
                                const vsiColor = getVsiColor(data.vsi ?? 0, theme);
                                const cardBg = `linear-gradient(90deg, ${alpha(changeColor, 0.1)} 0%, ${alpha(changeColor, 0.01)} 50%, ${alpha(changeColor, 0.001)} 100%)`;
                                const cardBgHover = `linear-gradient(90deg, ${alpha(changeColor, 0.2)} 0%, ${alpha(changeColor, 0.02)} 50%, ${alpha(changeColor, 0.002)} 100%)`;

                                return (
                                    <Box
                                        key={ticker}
                                        onClick={() => onTickerChange?.(ticker)}
                                        sx={{
                                            px: 1, py: 0.5,
                                            borderRadius: `${borderRadius.sm}px`,
                                            background: cardBg,
                                            cursor: 'pointer',
                                            transition: `background ${durations.fast}`,
                                            '&:hover': { background: cardBgHover },
                                            '&:hover .remove-btn': { opacity: 1 },
                                        }}
                                    >
                                        {/* Grid 3 cột: left | center | right */}
                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center' }}>
                                            {/* [0,0] Ticker + remove */}
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                                                <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.bold, color: changeColor }}>
                                                    {ticker}
                                                </Typography>
                                                <Box
                                                    component="span"
                                                    className="remove-btn"
                                                    onClick={(e) => { e.stopPropagation(); handleUpdateStocks(wl, wl.stock_symbols.filter(s => s !== ticker)); }}
                                                    sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', color: alpha(theme.palette.text.secondary, 0.35), opacity: 0, transition: `opacity ${durations.fast}, color ${durations.fast}`, '&:hover': { color: theme.palette.error.main } }}
                                                >
                                                    <CloseIcon sx={{ fontSize: 12 }} />
                                                </Box>
                                            </Box>
                                            {/* [0,1] +-% */}
                                            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold, color: changeColor, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
                                                {fmt.pct(data.pct_change)}
                                            </Typography>
                                            {/* [0,2] VSI */}
                                            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold, color: vsiColor, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                                                {fmt.vsi(data.vsi ?? 0)}
                                            </Typography>
                                            {/* [1,0] Giá */}
                                            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.medium, color: 'text.primary', fontVariantNumeric: 'tabular-nums', mt: 0.25 }}>
                                                {fmt.price(data.close)}
                                            </Typography>
                                            {/* [1,1] +- */}
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
                            })}

                            {wl.stock_symbols.length === 0 && (
                                <Typography
                                    sx={{
                                        px: 1.5, py: 1,
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

                        {/* Add stock autocomplete */}
                        <Box sx={{ px: 0.75, py: 0.5, borderTop: `1px solid ${divider}` }}>
                            <AutocompleteAdd
                                tickerOptions={tickerOptions}
                                onAdd={(ticker) => handleUpdateStocks(wl, [...wl.stock_symbols, ticker])}
                                isDark={isDark}
                            />
                        </Box>
                    </>
                )}
            </Box>
        );
    };

    return (
        <Box
            sx={{
                width: 280,
                height: '100%',
                borderLeft: 1,
                borderColor: 'divider',
                backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            {/* Header */}
            <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.bold, color: 'text.primary' }}>
                    Danh sách theo dõi
                </Typography>
                <IconButton size="small" onClick={() => openCreate(nextCoordinate)} sx={{ color: 'text.secondary', p: 0.25 }}>
                    <AddIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
                {loading ? (
                    <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', textAlign: 'center', py: 2 }}>
                        Đang tải...
                    </Typography>
                ) : watchlists.length === 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, gap: 1 }}>
                        <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary' }}>
                            Chưa có watchlist
                        </Typography>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                            onClick={() => openCreate([0, 0])}
                            sx={{ textTransform: 'none', fontSize: getResponsiveFontSize('xs') }}
                        >
                            Tạo Watchlist
                        </Button>
                    </Box>
                ) : (
                    sortedWatchlists.map(wl => renderWatchlistCard(wl))
                )}
            </Box>

            <AddWatchlistDialog
                open={dialogOpen}
                onClose={() => { setDialogOpen(false); setEditingWatchlist(null); }}
                onSaved={handleSaved}
                defaultCoordinate={dialogCoordinate}
                editingWatchlist={editingWatchlist}
                industries={industries}
            />

            <ConfirmDialog
                open={confirmOpen}
                onClose={() => { setConfirmOpen(false); setDeleteTargetId(null); }}
                onConfirm={handleDeleteConfirm}
                title="Xóa Watchlist"
                message="Bạn có chắc muốn xóa watchlist này? Hành động không thể hoàn tác."
            />
        </Box>
    );
}

// Separate component to avoid key reset issues with autocomplete
function AutocompleteAdd({ tickerOptions, onAdd, isDark }: { tickerOptions: TickerOption[]; onAdd: (ticker: string) => void; isDark: boolean }) {
    const [key, setKey] = useState(0);

    return (
        <Autocomplete
            key={key}
            options={tickerOptions}
            getOptionLabel={(opt) => opt.ticker}
            renderOption={(props, opt) => (
                <Box component="li" {...props} sx={{ display: 'flex', gap: 1, fontSize: getResponsiveFontSize('xs') }}>
                    <Typography component="span" sx={{ fontWeight: fontWeight.bold, fontSize: 'inherit' }}>
                        {opt.ticker}
                    </Typography>
                    {opt.name && (
                        <Typography component="span" sx={{ color: 'text.secondary', fontSize: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {opt.name}
                        </Typography>
                    )}
                </Box>
            )}
            filterOptions={(options, { inputValue }) => {
                const q = inputValue.toUpperCase();
                if (!q) return options.slice(0, 20);
                return options.filter(o => o.ticker.includes(q)).slice(0, 20);
            }}
            onChange={(_, val) => {
                if (val) {
                    onAdd(val.ticker);
                    setKey(k => k + 1);
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
    );
}
