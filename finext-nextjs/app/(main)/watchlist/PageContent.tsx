'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { OptionalAuthWrapper } from '@/components/auth/OptionalAuthWrapper';
import { BASIC_AND_ABOVE } from '@/components/auth/features';
import { Box, Typography, useTheme, useMediaQuery, Snackbar, Alert } from '@mui/material';
import DotLoading from 'components/common/DotLoading';
import AddIcon from '@mui/icons-material/Add';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    rectIntersection,
    useDroppable,
    type DragStartEvent,
    type DragOverEvent,
    type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createPortal } from 'react-dom';
import { fontWeight, getResponsiveFontSize, borderRadius } from 'theme/tokens';
import { useSseCache } from 'services/sseClient';
import { apiClient } from 'services/apiClient';
import { useAuth } from '@/components/auth/AuthProvider';
import WatchlistColumn from './components/WatchlistColumn';
import SortableWatchlistCard from './components/SortableWatchlistCard';
import AddWatchlistDialog from './components/AddWatchlistDialog';
import ConfirmDialog from './components/ConfirmDialog';

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

interface Watchlist {
    id: string;
    _id?: string;
    name: string;
    coordinate: [number, number]; // [col, row]
    stock_symbols: string[];
    page: number;
    sort: WatchlistSort;
    collapsed?: boolean;
}

const COLUMN_WIDTH = 270;

function DroppableColumn({ colIdx, isDark, isActive, isMobile, children }: {
    colIdx: number;
    isDark: boolean;
    isActive: boolean;
    isMobile: boolean;
    children: React.ReactNode;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: `column-${colIdx}` });
    return (
        <Box
            ref={setNodeRef}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                width: isMobile ? '100%' : COLUMN_WIDTH,
                flexShrink: 0,
                minHeight: 80,
                borderRadius: `${borderRadius.md}px`,
                transition: 'background 0.15s',
                bgcolor: isOver && isActive ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)') : 'transparent',
            }}
        >
            {children}
        </Box>
    );
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
                px: 1.25, py: 0.35,
                borderRadius: `${borderRadius.sm}px`,
                cursor: 'pointer',
                fontSize: getResponsiveFontSize('xs'),
                fontWeight: isActive ? fontWeight.semibold : fontWeight.medium,
                color: isActive ? 'primary.main' : 'text.secondary',
                bgcolor: isActive
                    ? (isDark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.08)')
                    : 'transparent',
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

export default function WatchlistContent() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { session, loading: authLoading } = useAuth();

    const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogCoordinate, setDialogCoordinate] = useState<[number, number]>([0, 0]);
    const [editingWatchlist, setEditingWatchlist] = useState<Watchlist | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
    const [currentPage, setCurrentPage] = useState(1);

    // ── DnD state (cards) ──
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isReordering, setIsReordering] = useState(false);
    const watchlistsBeforeDrag = useRef<Watchlist[]>([]);
    const watchlistsRef = useRef<Watchlist[]>([]);

    // ── DnD state (page tabs) ──
    const pageSensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    );

    // Keep ref in sync with state so handlers can read latest without stale closures
    useEffect(() => { watchlistsRef.current = watchlists; }, [watchlists]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
        useSensor(KeyboardSensor),
    );

    // Helper: find column index — uses ref to avoid recreating on every state change
    const findColumnIndex = useCallback((id: string): number => {
        if (typeof id === 'string' && id.startsWith('column-')) {
            return parseInt(id.replace('column-', ''), 10);
        }
        const wl = watchlistsRef.current.find(w => (w.id || w._id) === id);
        if (wl) return wl.coordinate[0];
        return -1;
    }, []); // stable — reads from ref

    // ── DnD handlers (all stable — no watchlists in deps) ──
    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        watchlistsBeforeDrag.current = [...watchlistsRef.current];
    }, []);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeWlId = active.id as string;
        const overId = over.id as string;
        if (activeWlId === overId) return;

        const activeCol = findColumnIndex(activeWlId);
        const overCol = findColumnIndex(overId);
        if (activeCol === -1 || overCol === -1 || activeCol === overCol) return;

        const isOverColumn = overId.startsWith('column-');

        // Move item to the other column
        setWatchlists(prev => {
            const activeWl = prev.find(w => (w.id || w._id) === activeWlId);
            if (!activeWl) return prev;

            // Double-check column from prev state to avoid stale ref reads
            const prevActiveCol = activeWl.coordinate[0];
            if (prevActiveCol === overCol) return prev; // already in target column

            const activePage = activeWl.page ?? 1;

            // Get items in the target column sorted by row (same page only)
            const overColItems = prev
                .filter(w => w.coordinate[0] === overCol && (w.id || w._id) !== activeWlId && (w.page ?? 1) === activePage)
                .sort((a, b) => a.coordinate[1] - b.coordinate[1]);

            // Find insertion index — append at end if dropping on column itself
            const overIndex = isOverColumn ? -1 : overColItems.findIndex(w => (w.id || w._id) === overId);
            const insertAt = overIndex === -1 ? overColItems.length : overIndex;

            // Insert active item at the new position
            overColItems.splice(insertAt, 0, activeWl);

            // Recalculate coordinates for the target column
            const updatedTargetItems = overColItems.map((w, idx) => ({
                ...w,
                coordinate: [overCol, idx] as [number, number],
            }));

            // Recalculate coordinates for the source column (without the active item, same page only)
            const sourceColItems = prev
                .filter(w => w.coordinate[0] === prevActiveCol && (w.id || w._id) !== activeWlId && (w.page ?? 1) === activePage)
                .sort((a, b) => a.coordinate[1] - b.coordinate[1])
                .map((w, idx) => ({
                    ...w,
                    coordinate: [prevActiveCol, idx] as [number, number],
                }));

            // Rebuild full list — exclude only the affected col+page combinations
            const otherItems = prev.filter(
                w => !(
                    (w.coordinate[0] === prevActiveCol && (w.page ?? 1) === activePage) ||
                    (w.coordinate[0] === overCol && (w.page ?? 1) === activePage)
                )
            );
            return [...otherItems, ...sourceColItems, ...updatedTargetItems];
        });
    }, [findColumnIndex]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        const activeWlId = active.id as string;
        const overWlId = over ? (over.id as string) : null;
        const before = watchlistsBeforeDrag.current;

        // Start from latest known state (cross-column already applied via handleDragOver)
        let nextWatchlists = watchlistsRef.current;

        // Same-column reorder (cross-column was already handled in handleDragOver)
        if (overWlId && activeWlId !== overWlId && !overWlId.startsWith('column-')) {
            const activeWl = nextWatchlists.find(w => (w.id || w._id) === activeWlId);
            const overWl = nextWatchlists.find(w => (w.id || w._id) === overWlId);
            if (activeWl && overWl && activeWl.coordinate[0] === overWl.coordinate[0] && (activeWl.page ?? 1) === (overWl.page ?? 1)) {
                const col = activeWl.coordinate[0];
                const activePage = activeWl.page ?? 1;
                const colItems = nextWatchlists
                    .filter(w => w.coordinate[0] === col && (w.page ?? 1) === activePage)
                    .sort((a, b) => a.coordinate[1] - b.coordinate[1]);

                const activeIdx = colItems.findIndex(w => (w.id || w._id) === activeWlId);
                const overIdx = colItems.findIndex(w => (w.id || w._id) === overWlId);

                if (activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) {
                    const reordered = [...colItems];
                    const [moved] = reordered.splice(activeIdx, 1);
                    reordered.splice(overIdx, 0, moved);
                    const updatedColItems = reordered.map((w, idx) => ({
                        ...w,
                        coordinate: [col, idx] as [number, number],
                    }));
                    const otherItems = nextWatchlists.filter(w => w.coordinate[0] !== col || (w.page ?? 1) !== activePage);
                    nextWatchlists = [...otherItems, ...updatedColItems];
                }
            }
        }

        // Apply final UI state first
        setWatchlists(nextWatchlists);

        // Then send API with the same computed data — no rAF, no stale ref
        const changed = nextWatchlists.filter(w => {
            const prev = before.find(b => (b.id || b._id) === (w.id || w._id));
            if (!prev) return false;
            return prev.coordinate[0] !== w.coordinate[0] || prev.coordinate[1] !== w.coordinate[1];
        });

        if (changed.length === 0) return;

        setIsReordering(true);
        apiClient({
            url: '/api/v1/watchlists/reorder',
            method: 'POST',
            body: { items: changed.map(w => ({ id: w.id || w._id!, coordinate: w.coordinate })) },
            requireAuth: true,
        }).catch(() => {
            setWatchlists(before);
        }).finally(() => {
            setIsReordering(false);
        });
    }, [findColumnIndex]);

    // SSE: all stock data — only subscribe when logged in
    const { data: stockDataRaw } = useSseCache<StockData[]>({
        keyword: 'home_today_stock',
        enabled: !!session,
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
        if (!session) {
            setLoading(false);
            return;
        }
        try {
            const res = await apiClient<Watchlist[]>({
                url: '/api/v1/watchlists/me',
                method: 'GET',
                requireAuth: true,
                skipCache: true,
            });
            if (res.data) setWatchlists(res.data);
        } catch (err) {
            console.error('Failed to fetch watchlists:', err);
        } finally {
            setLoading(false);
        }
    }, [session]);

    useEffect(() => {
        if (!authLoading) fetchWatchlists();
    }, [authLoading, fetchWatchlists]);

    // Build visual columns from coordinates
    type ColumnItem =
        | { type: 'wl'; wl: Watchlist }
        | { type: 'add'; coordinate: [number, number] };

    const MAX_COLS = 5;  // max 5 columns

    // Derive pages list from all watchlists
    const pages = useMemo(() => {
        const pageNums = new Set(watchlists.map(w => w.page ?? 1));
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

        // Update currentPage if it was moved
        const currentMapping = pageMapping.find(m => m.old_page === currentPage);
        if (currentMapping) setCurrentPage(currentMapping.new_page);

        // Persist to backend
        apiClient({
            url: '/api/v1/watchlists/reorder-pages',
            method: 'POST',
            body: { page_mapping: pageMapping },
            requireAuth: true,
        }).catch(() => {
            // Rollback on failure
            fetchWatchlists();
        });
    }, [pages, pageSortableIds, currentPage, fetchWatchlists]);

    // Next coordinate for current page — append to last column, or start new column if < MAX_COLS
    const nextCoordinate = useMemo<[number, number]>(() => {
        const pageWls = watchlists.filter(w => (w.page ?? 1) === currentPage);
        if (pageWls.length === 0) return [0, 0];
        const colMap = new Map<number, number>();
        pageWls.forEach(w => {
            const col = w.coordinate[0];
            const row = w.coordinate[1];
            colMap.set(col, Math.max(colMap.get(col) ?? -1, row));
        });
        const maxCol = Math.max(...Array.from(colMap.keys()));
        if (colMap.size < MAX_COLS) return [maxCol + 1, 0];
        // All 5 cols used — append to last column
        return [maxCol, (colMap.get(maxCol) ?? -1) + 1];
    }, [watchlists, currentPage]);

    // Mobile: flat sorted list of watchlists for current page
    const mobileWatchlists = useMemo(() => {
        return watchlists
            .filter(wl => (wl.page ?? 1) === currentPage)
            .sort((a, b) => {
                if (a.coordinate[1] !== b.coordinate[1]) return a.coordinate[1] - b.coordinate[1];
                return a.coordinate[0] - b.coordinate[0];
            });
    }, [watchlists, currentPage]);

    const visualColumns = useMemo(() => {
        // Only show watchlists on currentPage
        const pageWatchlists = watchlists.filter(wl => (wl.page ?? 1) === currentPage);
        // Group WLs by col index, sorted by row within each col
        const colMap = new Map<number, Watchlist[]>();
        pageWatchlists.forEach(wl => {
            const [col] = wl.coordinate;
            if (!colMap.has(col)) colMap.set(col, []);
            colMap.get(col)!.push(wl);
        });
        // Sort each column's WLs by row
        colMap.forEach(wls => wls.sort((a, b) => a.coordinate[1] - b.coordinate[1]));

        const maxCol = colMap.size > 0 ? Math.max(...Array.from(colMap.keys())) : -1;
        const columns: ColumnItem[][] = [];

        // Build existing columns — each always gets a "+" button at the bottom
        for (let col = 0; col <= maxCol; col++) {
            const colItems: ColumnItem[] = [];
            const wls = colMap.get(col) || [];
            wls.forEach(wl => {
                colItems.push({ type: 'wl', wl });
            });
            // Always add "+" button at the bottom of each existing column
            const nextRow = wls.length > 0 ? Math.max(...wls.map(w => w.coordinate[1])) + 1 : 0;
            colItems.push({ type: 'add', coordinate: [col, nextRow] });
            columns.push(colItems);
        }

        // New column "+" button — only show if fewer than MAX_COLS columns are used
        if (colMap.size < MAX_COLS) {
            columns.push([{ type: 'add', coordinate: [maxCol + 1, 0] }]);
        }

        return columns.filter(col => col.length > 0);
    }, [watchlists, currentPage]);

    // Extract sortable IDs per column for SortableContext
    const columnSortableIds = useMemo(() => {
        return visualColumns.map(colItems =>
            colItems
                .filter((item): item is { type: 'wl'; wl: Watchlist } => item.type === 'wl')
                .map(item => item.wl.id || item.wl._id!)
        );
    }, [visualColumns]);

    const activeWatchlist = useMemo(
        () => (activeId ? watchlists.find(w => (w.id || w._id) === activeId) ?? null : null),
        [activeId, watchlists],
    );

    // ── handlers ──
    const handleDeleteClick = (id: string) => {
        setDeleteTargetId(id);
        setConfirmOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTargetId) return;
        try {
            const deleted = watchlistsRef.current.find(w => (w.id || w._id) === deleteTargetId);
            await apiClient({ url: `/api/v1/watchlists/${deleteTargetId}`, method: 'DELETE', requireAuth: true });

            if (deleted) {
                const col = deleted.coordinate[0];
                const page = deleted.page ?? 1;
                const remaining = watchlistsRef.current.filter(w => (w.id || w._id) !== deleteTargetId);
                const colItems = remaining
                    .filter(w => w.coordinate[0] === col && (w.page ?? 1) === page)
                    .sort((a, b) => a.coordinate[1] - b.coordinate[1])
                    .map((w, idx) => ({ ...w, coordinate: [col, idx] as [number, number] }));
                const others = remaining.filter(w => w.coordinate[0] !== col || (w.page ?? 1) !== page);
                setWatchlists([...others, ...colItems]);

                // Gửi coordinate mới lên BE cho các item bị renormalize
                const changed = colItems.filter(w => {
                    const prev = watchlistsRef.current.find(b => (b.id || b._id) === (w.id || w._id));
                    return prev && prev.coordinate[1] !== w.coordinate[1];
                });
                if (changed.length > 0) {
                    apiClient({
                        url: '/api/v1/watchlists/reorder',
                        method: 'POST',
                        body: { items: changed.map(w => ({ id: w.id || w._id!, coordinate: w.coordinate })) },
                        requireAuth: true,
                    }).catch(err => console.error('Reorder after delete failed:', err));
                }
            } else {
                setWatchlists(prev => prev.filter(w => (w.id || w._id) !== deleteTargetId));
            }
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

    const handleRenameSubmit = async (wl: Watchlist, newName: string) => {
        const wlId = wl.id || wl._id!;
        setWatchlists(prev => prev.map(w => (w.id || w._id) === wlId ? { ...w, name: newName } : w));
        try {
            await apiClient({
                url: `/api/v1/watchlists/${wlId}`,
                method: 'PUT',
                body: { name: newName },
                requireAuth: true,
            });
        } catch (err: unknown) {
            const apiErr = err as { message?: string };
            setSnackbar({ open: true, message: apiErr?.message || 'Đổi tên thất bại' });
            setWatchlists(prev => prev.map(w => (w.id || w._id) === wlId ? { ...w, name: wl.name } : w));
        }
    };

    const handleSortChange = async (wl: Watchlist, sort: WatchlistSort) => {
        const wlId = wl.id || wl._id!;
        setWatchlists(prev => prev.map(w => (w.id || w._id) === wlId ? { ...w, sort } : w));
        try {
            await apiClient({ url: `/api/v1/watchlists/${wlId}`, method: 'PUT', body: { sort }, requireAuth: true });
        } catch {
            setWatchlists(prev => prev.map(w => (w.id || w._id) === wlId ? { ...w, sort: wl.sort } : w));
        }
    };

    const handleCollapseChange = async (wl: Watchlist, collapsed: boolean) => {
        const wlId = wl.id || wl._id!;
        setWatchlists(prev => prev.map(w => (w.id || w._id) === wlId ? { ...w, collapsed } : w));
        try {
            await apiClient({ url: `/api/v1/watchlists/${wlId}`, method: 'PUT', body: { collapsed }, requireAuth: true });
        } catch {
            setWatchlists(prev => prev.map(w => (w.id || w._id) === wlId ? { ...w, collapsed: wl.collapsed } : w));
        }
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

    const handleMoveToPage = async (wl: Watchlist, targetPage: number) => {
        const wlId = wl.id || wl._id!;
        const oldPage = wl.page ?? 1;
        if (targetPage === oldPage) return;

        // Find a valid coordinate in the target page (append to first column)
        const targetPageWls = watchlistsRef.current.filter(w => (w.page ?? 1) === targetPage);
        const col0Items = targetPageWls.filter(w => w.coordinate[0] === 0);
        const newRow = col0Items.length > 0 ? Math.max(...col0Items.map(w => w.coordinate[1])) + 1 : 0;
        const newCoordinate: [number, number] = [0, newRow];

        // Optimistic update
        setWatchlists(prev => {
            // Move the watchlist to the target page with new coordinate
            const updated = prev.map(w =>
                (w.id || w._id) === wlId
                    ? { ...w, page: targetPage, coordinate: newCoordinate }
                    : w
            );
            // Re-normalize the source column (fill gaps in row indices)
            const sourceCol = wl.coordinate[0];
            const sourceColItems = updated
                .filter(w => w.coordinate[0] === sourceCol && (w.page ?? 1) === oldPage && (w.id || w._id) !== wlId)
                .sort((a, b) => a.coordinate[1] - b.coordinate[1])
                .map((w, idx) => ({ ...w, coordinate: [sourceCol, idx] as [number, number] }));
            const others = updated.filter(
                w => !(w.coordinate[0] === sourceCol && (w.page ?? 1) === oldPage && (w.id || w._id) !== wlId)
            );
            return [...others.filter(w => (w.id || w._id) === wlId || !(w.coordinate[0] === sourceCol && (w.page ?? 1) === oldPage)), ...sourceColItems];
        });

        try {
            await apiClient({
                url: `/api/v1/watchlists/${wlId}`,
                method: 'PUT',
                body: { page: targetPage, coordinate: newCoordinate },
                requireAuth: true,
            });
        } catch (err) {
            console.error('Move to page failed:', err);
            // Rollback
            fetchWatchlists();
        }
    };

    if (authLoading) {
        return (
            <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
                <DotLoading />
            </Box>
        );
    }

    // Title always rendered — loading only covers content below
    const renderTitle = () => (
        <Typography variant="h1" sx={{ fontSize: getResponsiveFontSize('h1'), lineHeight: 1.2, fontWeight: fontWeight.bold, mb: 2 }}>
            Danh sách theo dõi
        </Typography>
    );

    // Loading state — dots animation matching global app loading
    if (loading) {
        return (
            <Box sx={{ py: 2 }}>
                {renderTitle()}
                <OptionalAuthWrapper requireAuth={true} requiredFeatures={BASIC_AND_ABOVE}>
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            minHeight: '40vh',
                            width: '100%',
                        }}
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 2,
                            }}
                        >
                            <DotLoading />
                        </Box>
                    </Box>
                </OptionalAuthWrapper>
            </Box>
        );
    }

    if (watchlists.length === 0) {
        return (
            <Box sx={{ py: 2 }}>
                {renderTitle()}
                <OptionalAuthWrapper requireAuth={true} requiredFeatures={BASIC_AND_ABOVE}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 2 }}>
                        <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('md'), fontWeight: fontWeight.medium }}>
                            Bạn chưa có Watchlist
                        </Typography>
                        <Box
                            onClick={() => openCreate([0, 0])}
                            sx={{
                                width: 80,
                                height: 80,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: `${borderRadius.md}px`,
                                border: `2px dashed`,
                                borderColor: 'primary.main',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: isDark
                                    ? '0 0 14px 3px rgba(99,102,241,0.3), inset 0 0 14px 3px rgba(99,102,241,0.12)'
                                    : '0 0 14px 3px rgba(99,102,241,0.18), inset 0 0 14px 3px rgba(99,102,241,0.07)',
                                '&:hover': {
                                    boxShadow: isDark
                                        ? '0 0 26px 7px rgba(99,102,241,0.5), inset 0 0 26px 7px rgba(99,102,241,0.2)'
                                        : '0 0 26px 7px rgba(99,102,241,0.32), inset 0 0 26px 7px rgba(99,102,241,0.12)',
                                    borderColor: 'primary.light',
                                    '& .add-icon': { color: 'primary.light' },
                                },
                            }}
                        >
                            <AddIcon className="add-icon" sx={{ fontSize: 36, color: 'primary.main', transition: 'color 0.2s' }} />
                        </Box>
                    </Box>
                    <AddWatchlistDialog
                        open={dialogOpen}
                        onClose={() => { setDialogOpen(false); setEditingWatchlist(null); }}
                        onSaved={handleSaved}
                        defaultCoordinate={dialogCoordinate}
                        defaultPage={currentPage}
                        editingWatchlist={editingWatchlist}
                        industries={industries}
                    />
                </OptionalAuthWrapper>
            </Box>
        );
    }

    return (
        <Box sx={{ py: 2 }}>
            {renderTitle()}

            <OptionalAuthWrapper requireAuth={true} requiredFeatures={BASIC_AND_ABOVE}>
                {/* Page selector — draggable tabs */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5, flexWrap: 'wrap' }}>
                    <DndContext
                        sensors={pageSensors}
                        collisionDetection={rectIntersection}
                        onDragEnd={handlePageDragEnd}
                    >
                        <SortableContext items={pageSortableIds} strategy={horizontalListSortingStrategy}>
                            {pages.map((p: number) => (
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
                    {(() => {
                        const canAddPage = watchlists.some(w => (w.page ?? 1) === currentPage);
                        return (
                            <Box
                                onClick={() => { if (!canAddPage) return; const next = Math.max(...pages) + 1; setCurrentPage(next); }}
                                sx={{
                                    px: 1.25, py: 0.35,
                                    borderRadius: `${borderRadius.sm}px`,
                                    cursor: canAddPage ? 'pointer' : 'not-allowed',
                                    fontSize: getResponsiveFontSize('xs'),
                                    color: canAddPage ? 'text.disabled' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'),
                                    border: `1px dashed ${canAddPage ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)') : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')}`,
                                    transition: 'all 0.15s',
                                    userSelect: 'none',
                                    opacity: canAddPage ? 1 : 0.6,
                                    ...(canAddPage && { '&:hover': { color: 'text.secondary', borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' } }),
                                }}
                            >
                                + Trang mới
                            </Box>
                        );
                    })()}
                </Box>

                {isMobile ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {mobileWatchlists.map(wl => (
                            <WatchlistColumn
                                key={wl.id || wl._id}
                                watchlist={wl}
                                stockDataMap={stockDataMap}
                                allTickers={allTickers}
                                onDelete={() => handleDeleteClick(wl.id || wl._id!)}
                                onRenameSubmit={(newName) => handleRenameSubmit(wl, newName)}
                                onSortChange={(sort) => handleSortChange(wl, sort)}
                                onCollapseChange={(c) => handleCollapseChange(wl, c)}
                                onReorderStocks={(newSymbols) => handleUpdateStocks(wl, newSymbols)}
                                onAddStock={(ticker) => handleUpdateStocks(wl, [...wl.stock_symbols, ticker])}
                                onRemoveStock={(ticker) => handleUpdateStocks(wl, wl.stock_symbols.filter(s => s !== ticker))}
                                onMoveToPage={(targetPage) => handleMoveToPage(wl, targetPage)}
                                availablePages={pages}
                            />
                        ))}
                        <Box
                            onClick={() => openCreate(nextCoordinate)}
                            sx={{
                                minHeight: 64,
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
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={rectIntersection}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                    >
                        <Box
                            sx={{
                                overflowX: 'auto',
                                transform: 'rotateX(180deg)',
                                '&::-webkit-scrollbar': { height: 5 },
                                '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                                '&::-webkit-scrollbar-thumb': {
                                    bgcolor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                                    borderRadius: 3,
                                },
                            }}
                        >
                            <Box
                                sx={{
                                    display: 'flex',
                                    gap: 1.5,
                                    alignItems: 'flex-start',
                                    transform: 'rotateX(180deg)',
                                    mb: 2,
                                }}
                            >
                                {visualColumns.map((colItems, colIdx) => (
                                    <SortableContext
                                        key={colIdx}
                                        items={columnSortableIds[colIdx] || []}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <DroppableColumn colIdx={colIdx} isDark={isDark} isActive={!!activeId} isMobile={false}>
                                            {colItems.map((item) =>
                                                item.type === 'wl' ? (
                                                    <SortableWatchlistCard key={item.wl.id || item.wl._id} id={item.wl.id || item.wl._id!} disabled={isReordering}>
                                                        {(dragHandleProps) => (
                                                            <WatchlistColumn
                                                                watchlist={item.wl}
                                                                stockDataMap={stockDataMap}
                                                                allTickers={allTickers}
                                                                onDelete={() => handleDeleteClick(item.wl.id || item.wl._id!)}
                                                                onRenameSubmit={(newName) => handleRenameSubmit(item.wl, newName)}
                                                                onSortChange={(sort) => handleSortChange(item.wl, sort)}
                                                                onCollapseChange={(c) => handleCollapseChange(item.wl, c)}
                                                                onReorderStocks={(newSymbols) => handleUpdateStocks(item.wl, newSymbols)}
                                                                onAddStock={(ticker) =>
                                                                    handleUpdateStocks(item.wl, [...item.wl.stock_symbols, ticker])
                                                                }
                                                                onRemoveStock={(ticker) =>
                                                                    handleUpdateStocks(item.wl, item.wl.stock_symbols.filter(s => s !== ticker))
                                                                }
                                                                onMoveToPage={(targetPage) => handleMoveToPage(item.wl, targetPage)}
                                                                availablePages={pages}
                                                                dragHandleProps={dragHandleProps}
                                                            />
                                                        )}
                                                    </SortableWatchlistCard>
                                                ) : (
                                                    <Box
                                                        key={`add-${item.coordinate[0]}-${item.coordinate[1]}`}
                                                        onClick={() => openCreate(item.coordinate)}
                                                        sx={{
                                                            minHeight: 80,
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
                                                ),
                                            )}
                                        </DroppableColumn>
                                    </SortableContext>
                                ))}
                            </Box>
                        </Box>

                        {typeof document !== 'undefined' && createPortal(
                            <DragOverlay dropAnimation={null}>
                                {activeWatchlist ? (
                                    <Box sx={{ boxShadow: 6, borderRadius: `${borderRadius.md}px`, overflow: 'hidden' }}>
                                        <WatchlistColumn
                                            watchlist={activeWatchlist}
                                            stockDataMap={stockDataMap}
                                            allTickers={allTickers}
                                            onDelete={() => { }}
                                            onRenameSubmit={() => { }}
                                            onSortChange={() => { }}
                                            onCollapseChange={() => { }}
                                            onReorderStocks={() => { }}
                                            onAddStock={() => { }}
                                            onRemoveStock={() => { }}
                                            forceCollapsed
                                        />
                                    </Box>
                                ) : null}
                            </DragOverlay>,
                            document.body,
                        )}
                    </DndContext>
                )}

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

                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={4000}
                    onClose={() => setSnackbar(s => ({ ...s, open: false }))}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert severity="error" onClose={() => setSnackbar(s => ({ ...s, open: false }))} sx={{ width: '100%' }}>
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </OptionalAuthWrapper>
        </Box>
    );
}
