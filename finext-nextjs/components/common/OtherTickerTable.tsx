'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Box, Typography, Skeleton, useTheme, useMediaQuery, Theme } from '@mui/material';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useSseCache } from '@/services/sseClient';
import { getTrendColor } from 'theme/colorHelpers';
import { transitions, getResponsiveFontSize, fontWeight, borderRadius } from 'theme/tokens';

export interface OtherTickerData {
    ticker: string;
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    unit: string;
    ticker_name: string;
    pct_change: number | null;
    w_pct: number | null;
    m_pct: number | null;
    q_pct: number | null;
    y_pct: number | null;
    update_date: string;
    chart: string;
    name: string;
    group: string;
    category: string;
    cat_order: number;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
    key: keyof OtherTickerData | 'display_name' | null;
    direction: SortDirection;
}

interface ColumnDef {
    key: keyof OtherTickerData | 'display_name';
    label: string;
    align: 'left' | 'center' | 'right';
    minWidth: number;
    sortable: boolean;
    hideOnMobile?: boolean;
    hideOnTablet?: boolean;
}

const getColumns = (): ColumnDef[] => [
    { key: 'display_name', label: 'Chỉ số / Hàng hoá', align: 'left', minWidth: 160, sortable: true },
    { key: 'close', label: 'Giá trị', align: 'right', minWidth: 100, sortable: true },
    { key: 'pct_change', label: 'Ngày', align: 'right', minWidth: 85, sortable: true },
    { key: 'w_pct', label: 'Tuần', align: 'right', minWidth: 85, sortable: true, hideOnMobile: true },
    { key: 'm_pct', label: 'Tháng', align: 'right', minWidth: 85, sortable: true, hideOnMobile: true },
    { key: 'q_pct', label: 'Quý', align: 'right', minWidth: 85, sortable: true, hideOnMobile: true, hideOnTablet: true },
    { key: 'y_pct', label: 'Năm', align: 'right', minWidth: 85, sortable: true, hideOnMobile: true, hideOnTablet: true },
    { key: 'unit', label: 'Đơn vị', align: 'right', minWidth: 90, sortable: false, hideOnMobile: true, hideOnTablet: true },
    { key: 'update_date', label: 'Cập nhật', align: 'right', minWidth: 100, sortable: true, hideOnMobile: true, hideOnTablet: true },
];

function SortIcon({ direction }: { direction: SortDirection }) {
    const theme = useTheme();
    if (direction === 'asc') return <KeyboardArrowUpIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />;
    if (direction === 'desc') return <KeyboardArrowDownIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />;
    return <UnfoldMoreIcon sx={{ fontSize: 14, color: theme.palette.text.disabled, opacity: 0.7 }} />;
}

function HeaderCell({ column, sortConfig, onSort }: { column: ColumnDef; sortConfig: SortConfig; onSort: (key: string) => void }) {
    const theme = useTheme();
    const isSorted = sortConfig.key === column.key;
    const isDark = theme.palette.mode === 'dark';

    return (
        <Box
            component="th"
            onClick={column.sortable ? () => onSort(column.key as string) : undefined}
            sx={{
                textAlign: column.align,
                px: 1.5,
                py: 1.25,
                cursor: column.sortable ? 'pointer' : 'default',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                transition: transitions.colors,
                '&:hover': column.sortable ? { bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' } : {},
                minWidth: column.minWidth,
            }}
        >
            <Box sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.25,
                justifyContent: column.align === 'right' ? 'flex-end' : column.align === 'center' ? 'center' : 'flex-start',
                width: '100%',
            }}>
                <Typography sx={{
                    fontSize: getResponsiveFontSize('xs'),
                    fontWeight: isSorted ? fontWeight.semibold : fontWeight.medium,
                    color: isSorted ? theme.palette.text.primary : theme.palette.text.secondary,
                    letterSpacing: '0.01em',
                }}>
                    {column.label}
                </Typography>
                {column.sortable && <SortIcon direction={isSorted ? sortConfig.direction : null} />}
            </Box>
        </Box>
    );
}

function IndexRow({ row, columns, isLast, isMobile, isTablet, isSelected, onSelect }: { row: OtherTickerData; columns: ColumnDef[]; isLast: boolean; isMobile: boolean; isTablet: boolean; isSelected?: boolean; onSelect?: (row: OtherTickerData) => void }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const hoverBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
    const selectedBg = isDark ? `${theme.palette.primary.main}18` : `${theme.palette.primary.main}12`;

    const renderPctCell = (rawVal: number | null): React.ReactNode => {
        const scaled = rawVal != null ? rawVal * 100 : null;
        const color = getTrendColor(scaled, theme);
        if (scaled == null) {
            return <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.medium, color: 'text.secondary' }}>—</Typography>;
        }
        const formatted = scaled.toFixed(2);
        const prefix = parseFloat(formatted) > 0 ? '+' : '';
        return (
            <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.medium, color: parseFloat(formatted) !== 0 ? color : 'text.secondary' }}>
                {`${prefix}${formatted}%`}
            </Typography>
        );
    };

    const renderCellContent = (column: ColumnDef): React.ReactNode => {
        switch (column.key) {
            case 'display_name': {
                const titleStr = row.name || row.ticker_name || row.ticker;
                return (
                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.medium, color: 'text.primary' }}>
                        {titleStr}
                    </Typography>
                );
            }
            case 'close': {
                const closeValue = row.close != null ? (row.unit === '%' ? row.close * 100 : row.close) : null;
                return (
                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontWeight: fontWeight.semibold, color: 'text.primary' }}>
                        {closeValue != null ? closeValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                    </Typography>
                );
            }
            case 'pct_change':
                return renderPctCell(row.pct_change);
            case 'w_pct':
                return renderPctCell(row.w_pct);
            case 'm_pct':
                return renderPctCell(row.m_pct);
            case 'q_pct':
                return renderPctCell(row.q_pct);
            case 'y_pct':
                return renderPctCell(row.y_pct);
            case 'unit':
                return (
                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary' }}>
                        {row.unit || '—'}
                    </Typography>
                );
            case 'update_date': {
                if (!row.update_date) return <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary' }}>—</Typography>;
                const d = new Date(row.update_date);
                const formatted = isNaN(d.getTime()) ? '—' : `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                return (
                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.secondary' }}>
                        {formatted}
                    </Typography>
                );
            }
            default:
                return (
                    <Typography sx={{ fontSize: getResponsiveFontSize('sm'), color: 'text.primary' }}>
                        {(row as any)[column.key] != null ? String((row as any)[column.key]) : '—'}
                    </Typography>
                );
        }
    };

    return (
        <Box
            component="tr"
            onClick={() => onSelect?.(row)}
            sx={{
                transition: transitions.colors,
                cursor: onSelect ? 'pointer' : 'default',
                bgcolor: isSelected ? selectedBg : 'transparent',
                '&:hover': { bgcolor: isSelected ? selectedBg : hoverBg },
            }}
        >
            {columns.map((col) => {
                if (isMobile && col.hideOnMobile) return null;
                if (isTablet && col.hideOnTablet) return null;
                return (
                    <Box component="td" key={col.key} sx={{
                        textAlign: col.align, px: 1.5, py: 1.25,
                        borderBottom: isLast ? 'none' : `1px solid ${dividerColor}`,
                        verticalAlign: 'middle',
                        borderLeft: col.key === 'display_name' && isSelected ? `3px solid ${theme.palette.primary.main}` : undefined,
                    }}>
                        {renderCellContent(col)}
                    </Box>
                );
            })}
        </Box>
    );
}

function SkeletonRow({ columns, isMobile, isTablet }: { columns: ColumnDef[]; isMobile: boolean; isTablet: boolean }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    return (
        <Box component="tr">
            {columns.map((col) => {
                if (isMobile && col.hideOnMobile) return null;
                if (isTablet && col.hideOnTablet) return null;
                return (
                    <Box component="td" key={col.key} sx={{ px: 1.5, py: 1.5, borderBottom: `1px solid ${dividerColor}` }}>
                        <Skeleton variant="text" width={col.key === 'display_name' ? '80%' : '60%'} height={20} sx={{ mx: col.align === 'center' ? 'auto' : undefined, ml: col.align === 'right' ? 'auto' : undefined }} />
                    </Box>
                );
            })}
        </Box>
    );
}

const ITEMS_PER_PAGE = 10;

interface OtherTickerTableProps {
    group?: string;
    category?: string;
    selectedName?: string | null;
    onTickerSelect?: (row: OtherTickerData) => void;
}

export default function OtherTickerTable({ group, category, selectedName, onTickerSelect }: OtherTickerTableProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'));
    const isTablet = useMediaQuery((theme: Theme) => theme.breakpoints.between('md', 'lg'));

    const columns = useMemo(() => getColumns(), []);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });

    const queryParams: any = {};
    if (group) queryParams.categories = group;

    const { data: rawData, isLoading } = useSseCache<OtherTickerData[]>({
        keyword: 'latest_other_ticker',
        queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
    });

    const handleSort = useCallback((key: string) => {
        const dataKey = key as keyof OtherTickerData | 'display_name';
        setSortConfig((prev) => {
            if (prev.key !== dataKey) return { key: dataKey, direction: 'desc' };
            if (prev.direction === 'desc') return { key: dataKey, direction: 'asc' };
            return { key: null, direction: null };
        });
    }, []);

    const dataToDisplay = useMemo(() => {
        let finalData = rawData || [];
        if (category && finalData.length > 0) {
            finalData = finalData.filter((t: OtherTickerData) => t.category === category);
        }
        // Default sort by cat_order within each category
        finalData = [...finalData].sort((a, b) => (a.cat_order ?? 999) - (b.cat_order ?? 999));
        return finalData;
    }, [rawData, category]);

    // Auto-select ticker đầu tiên khi chưa có ticker nào được chọn
    useEffect(() => {
        if (dataToDisplay.length > 0 && !selectedName && onTickerSelect) {
            onTickerSelect(dataToDisplay[0]);
        }
    }, [dataToDisplay, selectedName, onTickerSelect]);

    const sortedData = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction) return dataToDisplay;
        return [...dataToDisplay].sort((a, b) => {
            let aVal: any = a[sortConfig.key as keyof OtherTickerData];
            let bVal: any = b[sortConfig.key as keyof OtherTickerData];

            if (sortConfig.key === 'display_name') {
                aVal = a.name || a.ticker_name || a.ticker;
                bVal = b.name || b.ticker_name || b.ticker;
            }

            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            let comparison = 0;
            if (typeof aVal === 'string' && typeof bVal === 'string') comparison = aVal.localeCompare(bVal, 'vi');
            else if (typeof aVal === 'number' && typeof bVal === 'number') comparison = aVal - bVal;

            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }, [dataToDisplay, sortConfig]);

    const paginatedData = sortedData;

    const visibleColumns = useMemo(() => columns.filter((col) => {
        if (isMobile && col.hideOnMobile) return false;
        if (isTablet && col.hideOnTablet) return false;
        return true;
    }), [columns, isMobile, isTablet]);

    return (
        <Box sx={{ overflow: 'hidden', position: 'relative' }}>
            <Box
                sx={{
                    overflowX: 'auto',
                    '&::-webkit-scrollbar': { height: 6 },
                    '&::-webkit-scrollbar-track': { background: 'transparent' },
                    '&::-webkit-scrollbar-thumb': {
                        background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                        borderRadius: 3,
                    },
                    '&::-webkit-scrollbar-thumb:hover': {
                        background: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
                    },
                }}
            >
                <Box
                    component="table"
                    sx={{
                        width: '100%',
                        borderCollapse: 'separate',
                        borderSpacing: 0,
                        minWidth: isMobile ? 400 : 500,
                    }}
                >
                    <Box
                        component="thead"
                        sx={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 2,
                            bgcolor: isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(250, 251, 252, 0.95)',
                            backdropFilter: 'blur(8px)',
                            borderRadius: `${borderRadius.md}px`,
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                            '& th:first-of-type': { borderTopLeftRadius: `${borderRadius.md}px`, borderBottomLeftRadius: `${borderRadius.md}px` },
                            '& th:last-of-type': { borderTopRightRadius: `${borderRadius.md}px`, borderBottomRightRadius: `${borderRadius.md}px` },
                        }}
                    >
                        <Box component="tr">
                            {visibleColumns.map((col) => (
                                <HeaderCell key={col.key} column={col} sortConfig={sortConfig} onSort={handleSort} />
                            ))}
                        </Box>
                    </Box>

                    <Box component="tbody">
                        {isLoading
                            ? Array.from({ length: 5 }).map((_, idx) => (
                                <SkeletonRow key={`skeleton-${idx}`} columns={columns} isMobile={isMobile} isTablet={isTablet} />
                            ))
                            : paginatedData.map((row, index) => (
                                <IndexRow
                                    key={row.name}
                                    row={row}
                                    columns={columns}
                                    isLast={index === paginatedData.length - 1}
                                    isMobile={isMobile}
                                    isTablet={isTablet}
                                    isSelected={selectedName === row.name}
                                    onSelect={onTickerSelect}
                                />
                            ))
                        }
                    </Box>
                </Box>
            </Box>

            {!isLoading && dataToDisplay.length === 0 && (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: getResponsiveFontSize('md'), color: 'text.secondary' }}>Chưa có dữ liệu giao dịch</Typography>
                </Box>
            )}


        </Box>
    );
}
