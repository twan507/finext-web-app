'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, useTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { fontWeight, getResponsiveFontSize, borderRadius } from 'theme/tokens';
import { useSseCache } from 'hooks/useSseCache';
import { apiClient } from 'services/apiClient';
import WatchlistColumn from './components/WatchlistColumn';
import AddWatchlistDialog from './components/AddWatchlistDialog';
import ConfirmDialog from './components/ConfirmDialog';

interface StockData {
    ticker: string;
    ticker_name?: string;
    close: number;
    diff: number;
    pct_change: number;
    vsi: number;
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
    level: number;
    stock_symbols: string[];
}

export default function WatchlistContent() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogLevel, setDialogLevel] = useState(1);
    const [editingWatchlist, setEditingWatchlist] = useState<Watchlist | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    // SSE: all stock data
    const { data: stockDataRaw } = useSseCache<StockData[]>({
        keyword: 'home_today_stock',
    });

    const stockDataMap = useMemo(() => {
        const map = new Map<string, StockData>();
        if (stockDataRaw && Array.isArray(stockDataRaw)) {
            stockDataRaw.forEach(item => map.set(item.ticker, item));
        }
        return map;
    }, [stockDataRaw]);

    // All tickers for autocomplete
    const allTickers = useMemo(() => {
        if (!stockDataRaw || !Array.isArray(stockDataRaw)) return [];
        return stockDataRaw
            .map(s => ({ ticker: s.ticker, name: s.ticker_name || '' }))
            .sort((a, b) => a.ticker.localeCompare(b.ticker));
    }, [stockDataRaw]);

    // Industries: name → tickers[]
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

    // Group by level
    const groupedByLevel = useMemo(() => {
        const groups = new Map<number, Watchlist[]>();
        watchlists.forEach(wl => {
            if (!groups.has(wl.level)) groups.set(wl.level, []);
            groups.get(wl.level)!.push(wl);
        });
        return groups;
    }, [watchlists]);

    const occupiedLevels = useMemo(
        () => Array.from(groupedByLevel.keys()).sort((a, b) => a - b),
        [groupedByLevel],
    );
    const maxOccupied = occupiedLevels.length > 0 ? Math.max(...occupiedLevels) : 0;

    // ── handlers ──
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

    const openCreate = (level: number) => {
        setEditingWatchlist(null);
        setDialogLevel(level);
        setDialogOpen(true);
    };

    const openRename = (wl: Watchlist) => {
        setEditingWatchlist(wl);
        setDialogLevel(wl.level);
        setDialogOpen(true);
    };

    const handleSaved = () => {
        setDialogOpen(false);
        setEditingWatchlist(null);
        fetchWatchlists();
    };

    const handleUpdateStocks = async (wl: Watchlist, newSymbols: string[]) => {
        const wlId = wl.id || wl._id!;
        // Optimistic update — UI nhảy ngay
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
            // Rollback nếu API lỗi
            setWatchlists(prev =>
                prev.map(w => (w.id || w._id) === wlId ? { ...w, stock_symbols: wl.stock_symbols } : w),
            );
        }
    };

    // ── render ──
    if (loading) {
        return (
            <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={32} />
            </Box>
        );
    }

    // Empty state — just one button
    if (watchlists.length === 0) {
        return (
            <Box sx={{ py: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: fontWeight.bold, mb: 4 }}>
                    Danh sách theo dõi
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 2 }}>
                    <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('md') }}>
                        Bạn chưa có watchlist nào
                    </Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreate(1)} size="large">
                        Thêm Watchlist
                    </Button>
                </Box>
                <AddWatchlistDialog
                    open={dialogOpen}
                    onClose={() => { setDialogOpen(false); setEditingWatchlist(null); }}
                    onSaved={handleSaved}
                    defaultLevel={dialogLevel}
                    editingWatchlist={editingWatchlist}
                    industries={industries}
                />
            </Box>
        );
    }

    return (
        <Box sx={{ py: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: fontWeight.bold, mb: 3 }}>
                Danh sách theo dõi
            </Typography>

            {/* Rows for occupied levels */}
            {occupiedLevels.map(level => {
                const wls = groupedByLevel.get(level) || [];
                return (
                    <Box key={level} sx={{ mb: 1.5 }}>
                        <Box
                            sx={{
                                display: 'flex',
                                gap: 1.5,
                                overflowX: 'auto',
                                alignItems: 'flex-start',
                                '&::-webkit-scrollbar': { height: 5 },
                                '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                                '&::-webkit-scrollbar-thumb': {
                                    bgcolor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                                    borderRadius: 3,
                                },
                            }}
                        >
                            {wls.map(wl => (
                                <WatchlistColumn
                                    key={wl.id || wl._id}
                                    watchlist={wl}
                                    stockDataMap={stockDataMap}
                                    allTickers={allTickers}
                                    onDelete={() => handleDeleteClick(wl.id || wl._id!)}
                                    onRename={() => openRename(wl)}
                                    onAddStock={(ticker) =>
                                        handleUpdateStocks(wl, [...wl.stock_symbols, ticker])
                                    }
                                    onRemoveStock={(ticker) =>
                                        handleUpdateStocks(wl, wl.stock_symbols.filter(s => s !== ticker))
                                    }
                                />
                            ))}

                            {/* Add another WL to same row */}
                            <Box
                                onClick={() => openCreate(level)}
                                sx={{
                                    minWidth: 100,
                                    minHeight: 80,
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: `${borderRadius.md}px`,
                                    border: `1px dashed ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    '&:hover': {
                                        bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                                        borderColor: theme.palette.primary.main,
                                    },
                                }}
                            >
                                <AddIcon sx={{ fontSize: 22, color: 'text.disabled' }} />
                            </Box>
                        </Box>
                    </Box>
                );
            })}

            {/* Add new row — same square button style, aligned left */}
            {maxOccupied < 3 && (
                <Box
                    onClick={() => openCreate(maxOccupied + 1)}
                    sx={{
                        width: 100,
                        height: 80,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: `${borderRadius.md}px`,
                        border: `1px dashed ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        '&:hover': {
                            bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                            borderColor: theme.palette.primary.main,
                        },
                    }}
                >
                    <AddIcon sx={{ fontSize: 22, color: 'text.disabled' }} />
                </Box>
            )}

            <AddWatchlistDialog
                open={dialogOpen}
                onClose={() => { setDialogOpen(false); setEditingWatchlist(null); }}
                onSaved={handleSaved}
                defaultLevel={dialogLevel}
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
