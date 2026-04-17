'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
    Box,
    Typography,
    IconButton,
    Autocomplete,
    TextField,
    Button,
    Tooltip,
    Menu,
    MenuItem,
    Snackbar,
    Alert,
    useTheme,
    alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RefreshIcon from '@mui/icons-material/Refresh';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { DndContext, closestCenter, rectIntersection, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { getResponsiveFontSize, fontWeight, borderRadius, durations } from 'theme/tokens';
import { getPriceColor, getVsiColor, getTrendColor } from 'theme/colorHelpers';
import { useSseCache } from 'services/sseClient';
import { apiClient } from 'services/apiClient';
import AddWatchlistDialog from '../../watchlist/components/AddWatchlistDialog';
import ConfirmDialog from '../../watchlist/components/ConfirmDialog';
import { OptionalAuthWrapper } from '@/components/auth/OptionalAuthWrapper';
import { BASIC_AND_ABOVE } from '@/components/auth/features';
import { useAuth } from '@/components/auth/AuthProvider';

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

type WatchlistSort = 'pct_change_asc' | 'pct_change_desc' | 'vsi_asc' | 'vsi_desc' | 'trading_value_asc' | 'trading_value_desc' | 'manual';

const SORT_OPTIONS: { key: WatchlistSort; label: string }[] = [
    { key: 'manual', label: 'Thủ công' },
    { key: 'pct_change_desc', label: '% Thay đổi ↓' },
    { key: 'pct_change_asc', label: '% Thay đổi ↑' },
    { key: 'vsi_desc', label: 'Thanh khoản ↓' },
    { key: 'vsi_asc', label: 'Thanh khoản ↑' },
    { key: 'trading_value_desc', label: 'GTGD ↓' },
    { key: 'trading_value_asc', label: 'GTGD ↑' },
];

interface Watchlist {
    id: string;
    _id?: string;
    name: string;
    coordinate: [number, number];
    stock_symbols: string[];
    page: number;
    sort: string;
    collapsed?: boolean;
}

interface TickerOption {
    ticker: string;
    name: string;
}

interface WatchlistPanelProps {
    onTickerChange?: (ticker: string) => void;
}

function SortablePageTab({ page, isActive, isDark, onClick }: {
    page: number;
    isActive: boolean;
    isDark: boolean;
    onClick: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `page-${page}` });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
    return (
        <Box
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            sx={{
                px: 1, py: 0.25,
                borderRadius: `${borderRadius.sm}px`,
                cursor: 'pointer',
                fontSize: getResponsiveFontSize('xs'),
                fontWeight: isActive ? fontWeight.semibold : fontWeight.medium,
                color: isActive ? 'primary.main' : 'text.secondary',
                bgcolor: isActive ? (isDark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.08)') : 'transparent',
                border: `1px solid ${isActive ? 'rgba(99,102,241,0.4)' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
                transition: 'all 0.15s',
                userSelect: 'none',
                '&:hover': { color: 'primary.main', borderColor: 'rgba(99,102,241,0.4)' },
            }}
        >
            Trang {page}
        </Box>
    );
}

export default function WatchlistPanel({ onTickerChange }: WatchlistPanelProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { session, loading: authLoading } = useAuth();
    const isLoggedIn = !!session;

    const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogCoordinate, setDialogCoordinate] = useState<[number, number]>([0, 0]);
    const [editingWatchlist, setEditingWatchlist] = useState<Watchlist | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    // Snackbar
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'error' | 'success' }>({ open: false, message: '', severity: 'error' });

    // Menu state — per watchlist card
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [menuWlId, setMenuWlId] = useState<string | null>(null);
    // Sub-menu state for "Move to page"
    const [moveMenuAnchor, setMoveMenuAnchor] = useState<null | HTMLElement>(null);

    // Inline rename state
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);

    // DnD sensors for stock reorder
    const stockSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    // DnD sensors for page tab reorder
    const pageSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    // SSE: all stock data — only subscribe when logged in
    const { data: stockDataRaw } = useSseCache<StockData[]>({ keyword: 'home_today_stock', enabled: isLoggedIn });

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
        if (!isLoggedIn) {
            setLoading(false);
            return;
        }
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
    }, [isLoggedIn]);

    useEffect(() => { if (!authLoading) fetchWatchlists(); }, [fetchWatchlists, authLoading]);

    // Derived pages list
    const pages = useMemo(() => {
        const pageNums = new Set(watchlists.map(w => w.page ?? 1));
        pageNums.add(1);
        pageNums.add(currentPage);
        return Array.from(pageNums).sort((a, b) => a - b);
    }, [watchlists, currentPage]);

    const pageSortableIds = useMemo(() => pages.map(p => `page-${p}`), [pages]);

    const handlePageDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = pageSortableIds.indexOf(active.id as string);
        const newIndex = pageSortableIds.indexOf(over.id as string);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(pages, oldIndex, newIndex);

        // Build mapping: old page number -> new page number (1-based position)
        const pageMapping: { old_page: number; new_page: number }[] = [];
        reordered.forEach((oldPageNum, idx) => {
            const newPageNum = idx + 1;
            if (oldPageNum !== newPageNum) {
                pageMapping.push({ old_page: oldPageNum, new_page: newPageNum });
            }
        });

        if (pageMapping.length === 0) return;

        // Optimistic UI update
        setWatchlists(prev => prev.map(w => {
            const mapping = pageMapping.find(m => m.old_page === (w.page ?? 1));
            if (mapping) return { ...w, page: mapping.new_page };
            return w;
        }));

        const currentMapping = pageMapping.find(m => m.old_page === currentPage);
        if (currentMapping) setCurrentPage(currentMapping.new_page);

        apiClient({
            url: '/api/v1/watchlists/reorder-pages',
            method: 'POST',
            body: { page_mapping: pageMapping },
            requireAuth: true,
        }).catch(() => {
            fetchWatchlists();
        });
    }, [pages, pageSortableIds, currentPage, fetchWatchlists]);

    // Sort watchlists by coordinate: x first, then y — filtered by currentPage
    const sortedWatchlists = useMemo(() => {
        return [...watchlists]
            .filter(w => (w.page ?? 1) === currentPage)
            .sort((a, b) => {
                if (a.coordinate[0] !== b.coordinate[0]) return a.coordinate[0] - b.coordinate[0];
                return a.coordinate[1] - b.coordinate[1];
            });
    }, [watchlists, currentPage]);

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

    const handleCollapseChange = async (wl: Watchlist, newCollapsed: boolean) => {
        const wlId = wl.id || wl._id!;
        setWatchlists(prev => prev.map(w => (w.id || w._id) === wlId ? { ...w, collapsed: newCollapsed } : w));
        try {
            await apiClient({ url: `/api/v1/watchlists/${wlId}`, method: 'PUT', body: { collapsed: newCollapsed }, requireAuth: true });
        } catch {
            setWatchlists(prev => prev.map(w => (w.id || w._id) === wlId ? { ...w, collapsed: wl.collapsed } : w));
        }
    };

    // Stock drag-drop reorder (only when sort=manual)
    const handleStockDragEnd = (wl: Watchlist, event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const symbols = wl.stock_symbols;
        const oldIndex = symbols.indexOf(active.id as string);
        const newIndex = symbols.indexOf(over.id as string);
        if (oldIndex !== -1 && newIndex !== -1) {
            handleUpdateStocks(wl, arrayMove(symbols, oldIndex, newIndex));
        }
    };

    // Inline rename
    const startRename = (wl: Watchlist) => {
        const wlId = wl.id || wl._id!;
        setRenamingId(wlId);
        setRenameValue(wl.name);
        setTimeout(() => renameInputRef.current?.select(), 0);
    };

    const commitRename = async (wl: Watchlist) => {
        const trimmed = renameValue.trim();
        const wlId = wl.id || wl._id!;
        if (!trimmed || trimmed === wl.name) {
            setRenamingId(null);
            return;
        }
        // Optimistic update
        setWatchlists(prev => prev.map(w => (w.id || w._id) === wlId ? { ...w, name: trimmed } : w));
        setRenamingId(null);
        try {
            await apiClient({
                url: `/api/v1/watchlists/${wlId}`,
                method: 'PUT',
                body: { name: trimmed },
                requireAuth: true,
            });
        } catch (err: unknown) {
            // Revert
            setWatchlists(prev => prev.map(w => (w.id || w._id) === wlId ? { ...w, name: wl.name } : w));
            const apiErr = err as { message?: string };
            const message = apiErr?.message || (err instanceof Error ? err.message : 'Đổi tên thất bại');
            setSnackbar({ open: true, message, severity: 'error' });
        }
    };

    const cancelRename = () => {
        setRenamingId(null);
    };

    // Move to page
    const handleMoveToPage = async (wl: Watchlist, targetPage: number) => {
        const wlId = wl.id || wl._id!;
        const oldPage = wl.page ?? 1;
        if (targetPage === oldPage) return;

        // Find a valid coordinate in the target page (append to first column)
        const targetPageWls = watchlists.filter(w => (w.page ?? 1) === targetPage);
        const col0Items = targetPageWls.filter(w => w.coordinate[0] === 0);
        const newRow = col0Items.length > 0 ? Math.max(...col0Items.map(w => w.coordinate[1])) + 1 : 0;
        const newCoordinate: [number, number] = [0, newRow];

        // Optimistic update
        setWatchlists(prev => prev.map(w =>
            (w.id || w._id) === wlId
                ? { ...w, page: targetPage, coordinate: newCoordinate }
                : w
        ));

        try {
            await apiClient({
                url: `/api/v1/watchlists/${wlId}`,
                method: 'PUT',
                body: { page: targetPage, coordinate: newCoordinate },
                requireAuth: true,
            });
        } catch (err) {
            console.error('Move to page failed:', err);
            fetchWatchlists();
        }
    };

    // Sort change
    const handleSortChange = async (wl: Watchlist, sort: WatchlistSort) => {
        const wlId = wl.id || wl._id!;
        const oldSort = wl.sort;
        setWatchlists(prev => prev.map(w => (w.id || w._id) === wlId ? { ...w, sort } : w));
        try {
            await apiClient({
                url: `/api/v1/watchlists/${wlId}`,
                method: 'PUT',
                body: { sort },
                requireAuth: true,
            });
        } catch (err) {
            console.error('Sort change failed:', err);
            setWatchlists(prev => prev.map(w => (w.id || w._id) === wlId ? { ...w, sort: oldSort } : w));
        }
    };

    const fmt = {
        price: (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        diff: (n: number) => { const v = parseFloat(n.toFixed(2)); return `${v > 0 ? '+' : ''}${v.toFixed(2)}`; },
        pct: (n: number) => { const v = parseFloat((n * 100).toFixed(2)); return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`; },
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

    // Next available coordinate for current page: always a new column
    const nextCoordinate = useMemo<[number, number]>(() => {
        const pageWls = watchlists.filter(w => (w.page ?? 1) === currentPage);
        if (pageWls.length === 0) return [0, 0];
        const maxCol = Math.max(...pageWls.map(w => w.coordinate[0]));
        return [maxCol + 1, 0];
    }, [watchlists, currentPage]);

    const currentPageHasWatchlists = useMemo(
        () => watchlists.some(w => (w.page ?? 1) === currentPage),
        [watchlists, currentPage],
    );

    const renderWatchlistCard = (wl: Watchlist) => {
        const wlId = wl.id || wl._id!;
        const collapsed = wl.collapsed ?? false;
        const isRenaming = renamingId === wlId;

        // Aggregate pct_change — weighted average by trading_value, fallback to simple average
        let weightedSum = 0, totalWeight = 0, simpleSum = 0, simpleCount = 0;
        wl.stock_symbols.forEach(ticker => {
            const d = stockDataMap.get(ticker);
            if (d && d.pct_change != null) {
                const w = d.trading_value ?? 0;
                weightedSum += d.pct_change * w;
                totalWeight += w;
                simpleSum += d.pct_change;
                simpleCount++;
            }
        });
        const aggregateChange = simpleCount > 0
            ? (totalWeight > 0 ? weightedSum / totalWeight : simpleSum / simpleCount)
            : null;
        const headerColor = aggregateChange != null
            ? getTrendColor(aggregateChange * 100, theme)
            : theme.palette.text.secondary;

        // Sorted tickers (client-side sort)
        const sort = (wl.sort ?? 'manual') as WatchlistSort;
        const isManualSort = sort === 'manual';
        const sortedTickers = (isManualSort
            ? wl.stock_symbols
            : [...wl.stock_symbols].sort((a, b) => {
                const da = stockDataMap.get(a);
                const db = stockDataMap.get(b);
                let av = 0, bv = 0;
                if (sort.startsWith('pct_change')) { av = da?.pct_change ?? 0; bv = db?.pct_change ?? 0; }
                else if (sort.startsWith('vsi')) { av = da?.vsi ?? 0; bv = db?.vsi ?? 0; }
                else { av = da?.trading_value ?? 0; bv = db?.trading_value ?? 0; }
                return sort.endsWith('_asc') ? av - bv : bv - av;
            })).filter((ticker, index, arr) => arr.indexOf(ticker) === index);

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
                        px: 0.75,
                        py: 0.5,
                        borderBottom: collapsed ? 'none' : `1px solid ${divider}`,
                        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        userSelect: 'none',
                    }}
                >
                    {/* Collapse button */}
                    <IconButton
                        size="small"
                        onClick={() => handleCollapseChange(wl, !collapsed)}
                        sx={{ color: 'text.disabled', p: 0.25, mr: 0.25, flexShrink: 0, '&:hover': { color: 'text.secondary' } }}
                    >
                        {collapsed
                            ? <ExpandMoreIcon sx={{ fontSize: 16 }} />
                            : <ExpandLessIcon sx={{ fontSize: 16 }} />
                        }
                    </IconButton>

                    {/* Name — double-click to rename inline */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flex: 1 }}>
                        {isRenaming ? (
                            <TextField
                                inputRef={renameInputRef}
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onBlur={() => commitRename(wl)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') commitRename(wl);
                                    if (e.key === 'Escape') cancelRename();
                                }}
                                variant="standard"
                                size="small"
                                autoFocus
                                InputProps={{
                                    disableUnderline: false,
                                    sx: {
                                        fontSize: getResponsiveFontSize('xs'),
                                        fontWeight: fontWeight.bold,
                                        px: 0,
                                    },
                                }}
                                sx={{ flex: 1, minWidth: 0 }}
                            />
                        ) : (
                            <Typography
                                onDoubleClick={() => startRename(wl)}
                                sx={{
                                    fontSize: getResponsiveFontSize('xs'),
                                    fontWeight: fontWeight.bold,
                                    color: 'text.primary',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    cursor: 'text',
                                }}
                            >
                                {wl.name}
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
                            onClick={e => { setMenuAnchor(e.currentTarget); setMenuWlId(wlId); }}
                            sx={{ color: 'text.disabled', p: 0.25, flexShrink: 0, '&:hover': { color: 'text.secondary' } }}
                        >
                            <MoreVertIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                    </Tooltip>
                </Box>

                {/* Stock rows */}
                {!collapsed && (
                    <>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 0.75, overflowX: 'hidden' }}>
                            <DndContext sensors={stockSensors} collisionDetection={closestCenter} onDragEnd={(e) => handleStockDragEnd(wl, e)}>
                                <SortableContext items={sortedTickers} strategy={verticalListSortingStrategy}>
                                    {sortedTickers.map((ticker) => {
                                        const data = stockDataMap.get(ticker);

                                        if (!data) {
                                            return (
                                                <SortableStockRow key={ticker} id={ticker} disabled={!isManualSort}>
                                                    {(dragListeners) => {
                                                        const cardDragSx = isManualSort ? { cursor: 'grab', '&:active': { cursor: 'grabbing' } } : {};
                                                        return (
                                                            <Box
                                                                {...(dragListeners ?? {})}
                                                                onClick={() => onTickerChange?.(ticker)}
                                                                sx={{
                                                                    ...cardDragSx,
                                                                    px: 1, py: 0.5,
                                                                    borderRadius: `${borderRadius.sm}px`,
                                                                    bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                                    cursor: isManualSort ? 'grab' : 'pointer',
                                                                    '&:hover .remove-btn': { opacity: 1 },
                                                                }}
                                                            >
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                                                                    <Typography
                                                                        onPointerDown={e => e.stopPropagation()}
                                                                        onClick={() => onTickerChange?.(ticker)}
                                                                        sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.semibold, color: 'text.primary', cursor: 'pointer' }}
                                                                    >
                                                                        {ticker}
                                                                    </Typography>
                                                                </Box>
                                                                <Box
                                                                    component="span"
                                                                    className="remove-btn"
                                                                    onPointerDown={e => e.stopPropagation()}
                                                                    onClick={(e) => { e.stopPropagation(); handleUpdateStocks(wl, wl.stock_symbols.filter(s => s !== ticker)); }}
                                                                    sx={{ display: 'inline-flex', cursor: 'pointer', opacity: 0, transition: `opacity ${durations.fast}, color ${durations.fast}`, color: alpha(theme.palette.text.secondary, 0.3), '&:hover': { color: theme.palette.error.main } }}
                                                                >
                                                                    <CloseIcon sx={{ fontSize: 12 }} />
                                                                </Box>
                                                            </Box>
                                                        );
                                                    }}
                                                </SortableStockRow>
                                            );
                                        }

                                        const changeColor = getPriceColor(data.pct_change, data.exchange, theme);
                                        const vsiColor = getVsiColor(data.vsi ?? 0, theme);
                                        const cardBg = `linear-gradient(90deg, ${alpha(changeColor, 0.1)} 0%, ${alpha(changeColor, 0.01)} 50%, ${alpha(changeColor, 0.001)} 100%)`;
                                        const cardBgHover = `linear-gradient(90deg, ${alpha(changeColor, 0.2)} 0%, ${alpha(changeColor, 0.02)} 50%, ${alpha(changeColor, 0.002)} 100%)`;

                                        return (
                                            <SortableStockRow key={ticker} id={ticker} disabled={!isManualSort}>
                                                {(dragListeners) => {
                                                    const cardDragSx = isManualSort ? { cursor: 'grab', '&:active': { cursor: 'grabbing' } } : {};
                                                    return (
                                                        <Box
                                                            {...(dragListeners ?? {})}
                                                            onClick={() => onTickerChange?.(ticker)}
                                                            sx={{
                                                                ...cardDragSx,
                                                                px: 1, py: 0.5,
                                                                borderRadius: `${borderRadius.sm}px`,
                                                                background: cardBg,
                                                                cursor: isManualSort ? 'grab' : 'pointer',
                                                                transition: `background ${durations.fast}`,
                                                                '&:hover': { background: cardBgHover },
                                                                '&:hover .remove-btn': { opacity: 1 },
                                                            }}
                                                        >
                                                            {/* Grid 3 cột: left | center | right */}
                                                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center' }}>
                                                                {/* [0,0] Ticker + remove */}
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                                                                    <Typography
                                                                        onPointerDown={e => e.stopPropagation()}
                                                                        onClick={() => onTickerChange?.(ticker)}
                                                                        sx={{ fontSize: getResponsiveFontSize('xs'), fontWeight: fontWeight.bold, color: changeColor, cursor: 'pointer' }}
                                                                    >
                                                                        {ticker}
                                                                    </Typography>
                                                                    <Box
                                                                        component="span"
                                                                        className="remove-btn"
                                                                        onPointerDown={e => e.stopPropagation()}
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
                                                }}
                                            </SortableStockRow>
                                        );
                                    })}
                                </SortableContext>
                            </DndContext>

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

    // Find the watchlist that the menu is open for
    const menuWl = menuWlId ? watchlists.find(w => (w.id || w._id) === menuWlId) : null;

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
            <OptionalAuthWrapper requireAuth={true} requiredFeatures={BASIC_AND_ABOVE} compact>
                {/* Header */}
                <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.bold, color: 'text.primary' }}>
                        Danh sách theo dõi
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.25 }}>
                        <Tooltip title="Làm mới" placement="bottom" arrow={false} slotProps={tooltipSlotProps}>
                            <IconButton size="small" onClick={() => { setLoading(true); fetchWatchlists(); }} sx={{ color: 'text.secondary', p: 0.25 }}>
                                <RefreshIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Tạo mới" placement="bottom" arrow={false} slotProps={tooltipSlotProps}>
                            <IconButton size="small" onClick={() => openCreate(nextCoordinate)} sx={{ color: 'text.secondary', p: 0.25 }}>
                                <AddIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>

                {/* Page selector — draggable tabs */}
                <Box sx={{ px: 1, py: 0.75, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    <DndContext
                        sensors={pageSensors}
                        collisionDetection={rectIntersection}
                        onDragEnd={handlePageDragEnd}
                    >
                        <SortableContext items={pageSortableIds} strategy={horizontalListSortingStrategy}>
                            {pages.map(p => (
                                <SortablePageTab
                                    key={p}
                                    page={p}
                                    isActive={currentPage === p}
                                    isDark={isDark}
                                    onClick={() => setCurrentPage(p)}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                    <Box
                        onClick={() => { if (!currentPageHasWatchlists) return; const next = Math.max(...pages) + 1; setCurrentPage(next); }}
                        sx={{
                            px: 1, py: 0.25,
                            borderRadius: `${borderRadius.sm}px`,
                            cursor: currentPageHasWatchlists ? 'pointer' : 'not-allowed',
                            fontSize: getResponsiveFontSize('xs'),
                            color: currentPageHasWatchlists ? 'text.disabled' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'),
                            border: `1px dashed ${currentPageHasWatchlists ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)') : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')}`,
                            transition: 'all 0.15s',
                            userSelect: 'none',
                            opacity: currentPageHasWatchlists ? 1 : 0.6,
                            ...(currentPageHasWatchlists && { '&:hover': { color: 'text.secondary', borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' } }),
                        }}
                    >
                        + Trang mới
                    </Box>
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
                    {loading ? (
                        <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', textAlign: 'center', py: 2 }}>
                            Đang tải...
                        </Typography>
                    ) : watchlists.length === 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, gap: 1 }}>
                            <Typography sx={{ fontSize: getResponsiveFontSize('xs'), color: 'text.secondary', fontWeight: fontWeight.medium }}>
                                Bạn chưa có Watchlist
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

                {/* Shared ⋮ popup menu — glassmorphism, opens LEFT since panel is on right edge */}
                <Menu
                    anchorEl={menuAnchor}
                    open={Boolean(menuAnchor)}
                    onClose={() => { setMenuAnchor(null); setMenuWlId(null); }}
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
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
                >

                    {/* Sort options */}
                    {SORT_OPTIONS.map(opt => {
                        const active = menuWl ? (menuWl.sort ?? 'manual') === opt.key : false;
                        return (
                            <MenuItem
                                key={opt.key}
                                onClick={() => {
                                    if (menuWl) handleSortChange(menuWl, opt.key);
                                    setMenuAnchor(null);
                                    setMenuWlId(null);
                                }}
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

                    {/* Move to page */}
                    {pages.length > 1 && (
                        <MenuItem
                            onClick={(e) => setMoveMenuAnchor(e.currentTarget)}
                            sx={{
                                py: 0.4,
                                px: 1,
                                gap: 0.75,
                                fontSize: getResponsiveFontSize('xs'),
                                borderRadius: `${borderRadius.sm}px`,
                                color: 'primary.main',
                                '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                            }}
                        >
                            <DriveFileMoveIcon sx={{ fontSize: 13, flexShrink: 0 }} />
                            <Box component="span" sx={{ fontSize: getResponsiveFontSize('xs'), flex: 1 }}>Chuyển trang</Box>
                            <ChevronRightIcon sx={{ fontSize: 14, ml: -0.5, mt: 0.25 }} />
                        </MenuItem>
                    )}

                    {/* Delete */}
                    <MenuItem
                        onClick={() => {
                            if (menuWlId) handleDeleteClick(menuWlId);
                            setMenuAnchor(null);
                            setMenuWlId(null);
                            setMoveMenuAnchor(null);
                        }}
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

                {/* Sub-menu: Move to page */}
                <Menu
                    anchorEl={moveMenuAnchor}
                    open={Boolean(moveMenuAnchor)}
                    onClose={() => setMoveMenuAnchor(null)}
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
                                minWidth: 100,
                            },
                        },
                    }}
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
                >
                    {pages.map(p => {
                        const isCurrent = menuWl ? p === (menuWl.page ?? 1) : false;
                        return (
                            <MenuItem
                                key={p}
                                disabled={isCurrent}
                                onClick={() => {
                                    if (menuWl) handleMoveToPage(menuWl, p);
                                    setMoveMenuAnchor(null);
                                    setMenuAnchor(null);
                                    setMenuWlId(null);
                                }}
                                sx={{
                                    py: 0.4,
                                    px: 1,
                                    gap: 0.75,
                                    fontSize: getResponsiveFontSize('xs'),
                                    borderRadius: `${borderRadius.sm}px`,
                                    fontWeight: isCurrent ? fontWeight.semibold : fontWeight.medium,
                                    color: isCurrent ? 'primary.main' : 'text.secondary',
                                    '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
                                }}
                            >
                                <Box component="span" sx={{ width: 10, fontSize: 9, flexShrink: 0, color: 'primary.main' }}>
                                    {isCurrent ? '●' : ''}
                                </Box>
                                Trang {p}
                            </MenuItem>
                        );
                    })}
                </Menu>

                <AddWatchlistDialog
                    open={dialogOpen}
                    onClose={() => { setDialogOpen(false); setEditingWatchlist(null); }}
                    onSaved={handleSaved}
                    defaultCoordinate={dialogCoordinate}
                    defaultPage={currentPage}
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

                {/* Snackbar for errors */}
                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={4000}
                    onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert
                        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                        severity={snackbar.severity}
                        variant="filled"
                        sx={{ width: '100%' }}
                    >
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </OptionalAuthWrapper>
        </Box>
    );
}

// Separate component to avoid key reset issues with autocomplete
// Sortable wrapper for stock rows
function SortableStockRow({ id, disabled, children }: {
    id: string;
    disabled?: boolean;
    children: (listeners: Record<string, unknown> | undefined) => React.ReactNode;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });

    return (
        <Box
            ref={setNodeRef}
            style={{
                transform: CSS.Translate.toString(transform),
                transition: transition || undefined,
                opacity: isDragging ? 0.4 : 1,
                position: 'relative',
                zIndex: isDragging ? 1 : 0,
            }}
            {...attributes}
        >
            {children(disabled ? undefined : listeners)}
        </Box>
    );
}

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
            autoHighlight
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
