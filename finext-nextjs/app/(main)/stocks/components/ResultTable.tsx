'use client';

import { useMemo, useRef, useState } from 'react';
import { Box, Typography, useTheme, alpha, Skeleton } from '@mui/material';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';
import { getResponsiveFontSize, fontWeight, borderRadius, durations, easings } from 'theme/tokens';
import { COLUMN_MAP, formatCellValue, type ColumnDef } from '../screenerConfig';

interface ResultTableProps {
    data: Record<string, any>[];
    columns: string[];
    sortField: string;
    sortOrder: 'asc' | 'desc';
    onToggleSort: (field: string) => void;
    onReorderColumns: (fromIndex: number, toIndex: number) => void;
    isLoading: boolean;
}

function getCellColor(value: any, format: string | undefined, theme: any): string | undefined {
    if (format === 'pct' || format === 'price') {
        if (typeof value === 'number') {
            if (value > 0) return theme.palette.trend?.up ?? theme.palette.success.main;
            if (value < 0) return theme.palette.trend?.down ?? theme.palette.error.main;
            return theme.palette.trend?.ref ?? theme.palette.text.secondary;
        }
    }
    if (format === 'score') {
        if (typeof value === 'number') {
            if (value >= 70) return theme.palette.trend?.up ?? theme.palette.success.main;
            if (value <= 30) return theme.palette.trend?.down ?? theme.palette.error.main;
        }
    }
    if (format === 'rank') {
        if (typeof value === 'number') {
            const pct = value * 100;
            if (pct >= 70) return theme.palette.trend?.up ?? theme.palette.success.main;
            if (pct <= 30) return theme.palette.trend?.down ?? theme.palette.error.main;
        }
    }
    return undefined;
}

export default function ResultTable({ data, columns, sortField, sortOrder, onToggleSort, onReorderColumns, isLoading }: ResultTableProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const router = useRouter();

    // Drag state
    const dragIndexRef = useRef<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const colDefs = useMemo(() => {
        return columns.map(field => COLUMN_MAP.get(field)).filter(Boolean) as ColumnDef[];
    }, [columns]);

    // ── Drag handlers ──
    function handleDragStart(e: React.DragEvent, index: number) {
        dragIndexRef.current = index;
        e.dataTransfer.effectAllowed = 'move';
        // Make the drag ghost semi-transparent
        const el = e.currentTarget as HTMLElement;
        el.style.opacity = '0.4';
    }

    function handleDragEnd(e: React.DragEvent) {
        (e.currentTarget as HTMLElement).style.opacity = '1';
        dragIndexRef.current = null;
        setDragOverIndex(null);
    }

    function handleDragOver(e: React.DragEvent, index: number) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragIndexRef.current !== null && dragIndexRef.current !== index) {
            setDragOverIndex(index);
        }
    }

    function handleDragLeave() {
        setDragOverIndex(null);
    }

    function handleDrop(e: React.DragEvent, toIndex: number) {
        e.preventDefault();
        const fromIndex = dragIndexRef.current;
        setDragOverIndex(null);
        if (fromIndex !== null && fromIndex !== toIndex) {
            onReorderColumns(fromIndex, toIndex);
        }
        dragIndexRef.current = null;
    }

    if (isLoading) {
        return (
            <Box sx={{ p: 2 }}>
                {Array.from({ length: 15 }).map((_, i) => (
                    <Skeleton key={i} variant="rectangular" height={38} sx={{ mb: 0.5, borderRadius: `${borderRadius.xs}px` }} />
                ))}
            </Box>
        );
    }

    if (data.length === 0) {
        return (
            <Box sx={{ p: 5, textAlign: 'center' }}>
                <Icon icon="solar:filter-bold-duotone" width={40} color={theme.palette.text.disabled} />
                <Typography color="text.secondary" sx={{ fontSize: getResponsiveFontSize('md'), mt: 1.5 }}>
                    Không tìm thấy cổ phiếu phù hợp
                </Typography>
                <Typography color="text.disabled" sx={{ fontSize: getResponsiveFontSize('xs'), mt: 0.5 }}>
                    Thử điều chỉnh lại các tiêu chí lọc
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ overflowX: 'auto', width: '100%' }}>
            <Box
                component="table"
                sx={{
                    width: '100%',
                    borderCollapse: 'separate',
                    borderSpacing: 0,
                    minWidth: Math.max(colDefs.reduce((sum, c) => sum + (c.width ?? 90), 0), 600),
                }}
            >
                {/* Header */}
                <Box
                    component="thead"
                    sx={{ position: 'sticky', top: 0, zIndex: 2 }}
                >
                    <Box component="tr">
                        {colDefs.map((col, colIdx) => {
                            const isSorted = sortField === col.field;
                            const isDropTarget = dragOverIndex === colIdx;
                            const isDragging = dragIndexRef.current === colIdx;

                            return (
                                <Box
                                    key={col.field}
                                    component="th"
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, colIdx)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => handleDragOver(e, colIdx)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, colIdx)}
                                    onClick={() => col.sortable && onToggleSort(col.field)}
                                    sx={{
                                        px: 1.25,
                                        py: 1,
                                        fontSize: getResponsiveFontSize('xs'),
                                        fontWeight: fontWeight.bold,
                                        color: isSorted ? theme.palette.primary.main : 'text.secondary',
                                        textAlign: col.align ?? 'left',
                                        whiteSpace: 'nowrap',
                                        cursor: 'grab',
                                        userSelect: 'none',
                                        borderBottom: `2px solid ${isSorted
                                            ? theme.palette.primary.main
                                            : isDropTarget
                                                ? theme.palette.primary.main
                                                : alpha(theme.palette.divider, 0.25)
                                        }`,
                                        borderLeft: isDropTarget ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
                                        bgcolor: isDark ? alpha('#000', 0.45) : alpha('#fff', 0.92),
                                        backdropFilter: 'blur(8px)',
                                        transition: 'color 0.15s, border-color 0.15s, background 0.15s',
                                        '&:hover': {
                                            color: theme.palette.primary.main,
                                        },
                                        '&:active': {
                                            cursor: 'grabbing',
                                        },
                                        width: col.width,
                                        minWidth: col.width ? col.width * 0.7 : undefined,
                                    }}
                                >
                                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>
                                        {col.shortLabel ?? col.label}
                                        {col.sortable && (
                                            isSorted ? (
                                                <Icon
                                                    icon={sortOrder === 'asc'
                                                        ? 'solar:alt-arrow-up-bold'
                                                        : 'solar:alt-arrow-down-bold'
                                                    }
                                                    width={13}
                                                    color={theme.palette.primary.main}
                                                />
                                            ) : (
                                                <Icon
                                                    icon="solar:sort-vertical-linear"
                                                    width={11}
                                                    color={alpha(theme.palette.text.disabled, 0.4)}
                                                    style={{ opacity: 0.5 }}
                                                />
                                            )
                                        )}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>

                {/* Body */}
                <Box component="tbody">
                    {data.map((row, rowIdx) => (
                        <Box
                            key={row.ticker ?? rowIdx}
                            component="tr"
                            onClick={() => row.ticker && router.push(`/stocks/${row.ticker.toLowerCase()}`)}
                            sx={{
                                cursor: 'pointer',
                                transition: 'background 0.1s ease',
                                '&:hover': {
                                    bgcolor: isDark
                                        ? alpha(theme.palette.primary.main, 0.06)
                                        : alpha(theme.palette.primary.main, 0.04),
                                },
                                '&:nth-of-type(even)': {
                                    bgcolor: isDark ? alpha('#fff', 0.015) : alpha('#000', 0.015),
                                },
                            }}
                        >
                            {colDefs.map(col => {
                                const val = row[col.field];
                                const cellColor = getCellColor(val, col.format, theme);
                                const isTicker = col.field === 'ticker';
                                const isName = col.field === 'ticker_name';

                                return (
                                    <Box
                                        key={col.field}
                                        component="td"
                                        sx={{
                                            px: 1.25,
                                            py: 0.75,
                                            fontSize: getResponsiveFontSize('sm'),
                                            fontWeight: isTicker ? fontWeight.bold : fontWeight.medium,
                                            color: cellColor ?? 'text.primary',
                                            textAlign: col.align ?? 'left',
                                            whiteSpace: isTicker || isName ? undefined : 'nowrap',
                                            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                                            fontVariantNumeric: col.align === 'right' ? 'tabular-nums' : undefined,
                                            width: col.width,
                                            ...(isTicker ? { minWidth: 80 } : {}),
                                            ...(isName ? {
                                                maxWidth: col.width,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            } : {}),
                                        }}
                                    >
                                        {formatCellValue(val, col.format)}
                                    </Box>
                                );
                            })}
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    );
}
