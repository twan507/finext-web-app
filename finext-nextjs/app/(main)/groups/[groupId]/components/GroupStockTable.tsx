'use client';

import { useMemo, useCallback, useState } from 'react';
import { Box, Typography, Skeleton, useTheme, useMediaQuery, Tooltip, alpha } from '@mui/material';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useRouter } from 'next/navigation';
import {
    getResponsiveFontSize,
    fontWeight,
    borderRadius,
    transitions,
    durations,
} from 'theme/tokens';
import { getPriceColor, getFlowColor, getVsiColor } from 'theme/colorHelpers';

// ========== TYPES ==========
export interface GroupStockRowData {
    ticker: string;
    close: number;
    diff?: number;
    pct_change?: number;
    industry_name?: string;
    category_name?: string;
    marketcap_name?: string;
    t0_score?: number;
    t5_score?: number;
    vsi?: number;
    exchange?: string;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
    key: keyof GroupStockRowData | null;
    direction: SortDirection;
}

// ========== COLUMN DEFINITION ==========
interface ColumnDef {
    key: keyof GroupStockRowData;
    label: string;
    align: 'left' | 'center' | 'right';
    minWidth: number;
    sortable: boolean;
    hideOnMobile?: boolean;
    hideOnTablet?: boolean;
}

// ========== FORMAT HELPERS ==========
const formatPrice = (val: number | null | undefined): string => {
    if (val == null) return '—';
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDiff = (val: number | null | undefined): string => {
    if (val == null) return '—';
    const prefix = val > 0 ? '+' : '';
    return `${prefix}${val.toFixed(2)}`;
};

const formatPct = (val: number | null | undefined): string => {
    if (val == null) return '—';
    const pct = val * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
};

const formatScore = (val: number | null | undefined): string => {
    if (val == null) return '—';
    return `${val > 0 ? '+' : ''}${val.toFixed(1)}`;
};

const formatVsi = (val: number | null | undefined): string => {
    if (val == null) return '—';
    return `${(val * 100).toFixed(2)}%`;
};

// ========== COLUMN DEFINITIONS ==========
const getColumns = (): ColumnDef[] => [
    {
        key: 'ticker',
        label: 'Mã CP',
        align: 'left',
        minWidth: 80,
        sortable: true,
    },
    {
        key: 'industry_name',
        label: 'Ngành nghề',
        align: 'left',
        minWidth: 140,
        sortable: true,
        hideOnMobile: true,
        hideOnTablet: true,
    },
    {
        key: 'category_name',
        label: 'Nhóm',
        align: 'left',
        minWidth: 100,
        sortable: true,
        hideOnMobile: true,
        hideOnTablet: true,
    },
    {
        key: 'marketcap_name',
        label: 'Vốn hoá',
        align: 'left',
        minWidth: 120,
        sortable: true,
        hideOnMobile: true,
        hideOnTablet: true,
    },
    {
        key: 'close',
        label: 'Giá hiện tại',
        align: 'right',
        minWidth: 90,
        sortable: true,
    },
    {
        key: 'diff',
        label: 'Thay đổi (+/-)',
        align: 'right',
        minWidth: 70,
        sortable: true,
    },
    {
        key: 'pct_change',
        label: 'Thay đổi (%)',
        align: 'right',
        minWidth: 95,
        sortable: true,
    },
    {
        key: 't0_score',
        label: 'Dòng tiền phiên',
        align: 'right',
        minWidth: 115,
        sortable: true,
        hideOnMobile: true,
    },
    {
        key: 't5_score',
        label: 'Dòng tiền tuần',
        align: 'right',
        minWidth: 115,
        sortable: true,
        hideOnMobile: true,
    },
    {
        key: 'vsi',
        label: 'Thanh khoản',
        align: 'right',
        minWidth: 100,
        sortable: true,
    },
];

// ========== SORT ICON COMPONENT ==========
function SortIcon({ direction }: { direction: SortDirection }) {
    const theme = useTheme();

    if (direction === 'asc') {
        return <KeyboardArrowUpIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />;
    }
    if (direction === 'desc') {
        return <KeyboardArrowDownIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />;
    }
    return <UnfoldMoreIcon sx={{ fontSize: 14, color: theme.palette.text.disabled, opacity: 0.7 }} />;
}

// ========== HEADER CELL ==========
function HeaderCell({
    column,
    sortConfig,
    onSort,
}: {
    column: ColumnDef;
    sortConfig: SortConfig;
    onSort: (key: keyof GroupStockRowData) => void;
}) {
    const theme = useTheme();
    const isSorted = sortConfig.key === column.key;
    const isDark = theme.palette.mode === 'dark';

    return (
        <Box
            component="th"
            onClick={column.sortable ? () => onSort(column.key) : undefined}
            sx={{
                textAlign: column.align,
                px: 1.5,
                py: 1.25,
                cursor: column.sortable ? 'pointer' : 'default',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                transition: transitions.colors,
                '&:hover': column.sortable ? {
                    bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                } : {},
                minWidth: column.minWidth,
            }}
        >
            <Box sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.25,
                justifyContent: column.align === 'right' ? 'flex-end' : column.align === 'center' ? 'center' : 'flex-start',
                width: '100%',
            }}>
                <Typography
                    sx={{
                        fontSize: getResponsiveFontSize('xs'),
                        fontWeight: isSorted ? fontWeight.semibold : fontWeight.medium,
                        color: isSorted ? theme.palette.text.primary : theme.palette.text.secondary,
                        letterSpacing: '0.01em',
                    }}
                >
                    {column.label}
                </Typography>
                {column.sortable && (
                    <SortIcon direction={isSorted ? sortConfig.direction : null} />
                )}
            </Box>
        </Box>
    );
}

// ========== TABLE ROW ==========
function IndexRow({
    row,
    columns,
    isLast,
    isMobile,
    isTablet,
}: {
    row: GroupStockRowData;
    columns: ColumnDef[];
    isLast: boolean;
    isMobile: boolean;
    isTablet: boolean;
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const router = useRouter();

    const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const hoverBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';

    const renderCellContent = (column: ColumnDef): React.ReactNode => {
        switch (column.key) {
            case 'ticker':
                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography
                            onClick={() => router.push(`/stocks/${row.ticker.toLowerCase()}`)}
                            sx={{
                                cursor: 'pointer',
                                fontSize: getResponsiveFontSize('sm'),
                                fontWeight: fontWeight.bold,
                                color: 'text.primary',
                                transition: `color ${durations.fast}`,
                                '&:hover': { color: theme.palette.primary.main },
                            }}
                        >
                            {row.ticker}
                        </Typography>

                        <Tooltip
                            title="Mở chart"
                            placement="right"
                            arrow={false}
                            componentsProps={{
                                tooltip: {
                                    sx: {
                                        bgcolor: isDark ? alpha('#1e1e1e', 0.92) : alpha('#fff', 0.92),
                                        color: theme.palette.text.primary,
                                        border: 'none',
                                        borderRadius: `${borderRadius.sm}px`,
                                        fontSize: getResponsiveFontSize('xs'),
                                        fontWeight: fontWeight.medium,
                                        backdropFilter: 'blur(8px)',
                                        boxShadow: isDark
                                            ? '0 4px 16px rgba(0,0,0,0.5)'
                                            : '0 4px 12px rgba(0,0,0,0.15)',
                                        px: 1,
                                        py: 0.5,
                                    },
                                },
                            }}
                        >
                            <Box
                                component="span"
                                onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    router.push(`/charts/${row.ticker}`);
                                }}
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: alpha(theme.palette.text.secondary, 0.4),
                                    flexShrink: 0,
                                    transition: `color ${durations.fast}`,
                                    '&:hover': {
                                        color: theme.palette.primary.main,
                                    },
                                }}
                            >
                                <TrendingUpIcon sx={{ fontSize: 15 }} />
                            </Box>
                        </Tooltip>
                    </Box>
                );

            case 'close':
                return (
                    <Typography sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        fontWeight: fontWeight.semibold,
                        color: 'text.primary',
                    }}>
                        {formatPrice(row.close)}
                    </Typography>
                );

            case 'diff':
                return (
                    <Typography sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        fontWeight: fontWeight.medium,
                        color: row.pct_change != null ? getPriceColor(row.pct_change, row.exchange, theme) : 'text.secondary',
                    }}>
                        {formatDiff(row.diff)}
                    </Typography>
                );

            case 'pct_change':
                return (
                    <Typography sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        fontWeight: fontWeight.medium,
                        color: row.pct_change != null ? getPriceColor(row.pct_change, row.exchange, theme) : 'text.secondary',
                    }}>
                        {formatPct(row.pct_change)}
                    </Typography>
                );

            case 'industry_name':
            case 'category_name':
            case 'marketcap_name': {
                const textValue = row[column.key];
                const displayStr = (textValue !== null && textValue !== undefined && textValue !== '')
                    ? String(textValue)
                    : '—';
                return (
                    <Typography
                        title={displayStr !== '—' ? displayStr : ''}
                        sx={{
                            fontSize: getResponsiveFontSize('sm'),
                            color: 'text.primary',
                            maxWidth: 160,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        {displayStr}
                    </Typography>
                );
            }

            case 't0_score':
            case 't5_score': {
                const score = row[column.key] as number | undefined;
                return (
                    <Typography sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        fontWeight: fontWeight.medium,
                        color: score != null ? getFlowColor(score, theme) : 'text.secondary',
                    }}>
                        {formatScore(score)}
                    </Typography>
                );
            }

            case 'vsi':
                return (
                    <Typography sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        fontWeight: fontWeight.medium,
                        color: row.vsi != null ? getVsiColor(row.vsi, theme) : 'text.secondary',
                    }}>
                        {formatVsi(row.vsi)}
                    </Typography>
                );

            default:
                return (
                    <Typography sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        color: 'text.primary',
                    }}>
                        {row[column.key] != null ? String(row[column.key]) : '—'}
                    </Typography>
                );
        }
    };

    return (
        <Box
            component="tr"
            sx={{
                transition: transitions.colors,
                '&:hover': {
                    bgcolor: hoverBg,
                },
            }}
        >
            {columns.map((col) => {
                if (isMobile && col.hideOnMobile) return null;
                if (isTablet && col.hideOnTablet) return null;

                return (
                    <Box
                        component="td"
                        key={col.key}
                        sx={{
                            textAlign: col.align,
                            px: 1.5,
                            py: 1.25,
                            borderBottom: isLast ? 'none' : `1px solid ${dividerColor}`,
                            verticalAlign: 'middle',
                        }}
                    >
                        {renderCellContent(col)}
                    </Box>
                );
            })}
        </Box>
    );
}

// ========== SKELETON ROW ==========
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
                    <Box
                        component="td"
                        key={col.key}
                        sx={{
                            px: 1.5,
                            py: 1.5,
                            borderBottom: `1px solid ${dividerColor}`,
                        }}
                    >
                        <Skeleton
                            variant="text"
                            width={col.key === 'ticker' ? '80%' : '60%'}
                            height={20}
                            sx={{
                                mx: col.align === 'center' ? 'auto' : undefined,
                                ml: col.align === 'right' ? 'auto' : undefined,
                            }}
                        />
                    </Box>
                );
            })}
        </Box>
    );
}

// ========== MAIN COMPONENT ==========
interface GroupStockTableProps {
    data: GroupStockRowData[];
    isLoading?: boolean;
    skeletonRows?: number;
}

export default function GroupStockTable({
    data,
    isLoading = false,
    skeletonRows = 10,
}: GroupStockTableProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));

    const columns = useMemo(() => getColumns(), []);

    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });

    const handleSort = useCallback((key: keyof GroupStockRowData) => {
        setSortConfig((prev) => {
            if (prev.key !== key) {
                return { key, direction: 'desc' };
            }
            if (prev.direction === 'desc') {
                return { key, direction: 'asc' };
            }
            return { key: null, direction: null };
        });
    }, []);

    const sortedData = useMemo(() => {
        if (!sortConfig.key || !sortConfig.direction) return data;

        return [...data].sort((a, b) => {
            const aVal = a[sortConfig.key!];
            const bVal = b[sortConfig.key!];

            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            let comparison = 0;
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                comparison = aVal.localeCompare(bVal, 'vi');
            } else if (typeof aVal === 'number' && typeof bVal === 'number') {
                comparison = aVal - bVal;
            }

            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }, [data, sortConfig]);

    const visibleColumns = useMemo(() => {
        return columns.filter((col) => {
            if (isMobile && col.hideOnMobile) return false;
            if (isTablet && col.hideOnTablet) return false;
            return true;
        });
    }, [columns, isMobile, isTablet]);

    return (
        <Box
            sx={{
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            <Box
                sx={{
                    overflowX: 'auto',
                    '&::-webkit-scrollbar': {
                        height: 6,
                    },
                    '&::-webkit-scrollbar-track': {
                        background: 'transparent',
                    },
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
                        minWidth: isMobile ? 400 : isTablet ? 700 : undefined,
                    }}
                >
                    {/* Header */}
                    <Box
                        component="thead"
                        sx={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 2,
                            bgcolor: isDark
                                ? 'rgba(30, 30, 30, 0.95)'
                                : 'rgba(250, 251, 252, 0.95)',
                            backdropFilter: 'blur(8px)',
                            borderRadius: `${borderRadius.md}px`,
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                            '& th:first-of-type': {
                                borderTopLeftRadius: `${borderRadius.md}px`,
                                borderBottomLeftRadius: `${borderRadius.md}px`,
                            },
                            '& th:last-of-type': {
                                borderTopRightRadius: `${borderRadius.md}px`,
                                borderBottomRightRadius: `${borderRadius.md}px`,
                            },
                        }}
                    >
                        <Box component="tr">
                            {visibleColumns.map((col) => (
                                <HeaderCell
                                    key={col.key}
                                    column={col}
                                    sortConfig={sortConfig}
                                    onSort={handleSort}
                                />
                            ))}
                        </Box>
                    </Box>

                    {/* Body */}
                    <Box component="tbody">
                        {isLoading
                            ? Array.from({ length: skeletonRows }).map((_, idx) => (
                                <SkeletonRow
                                    key={`skeleton-${idx}`}
                                    columns={visibleColumns}
                                    isMobile={isMobile}
                                    isTablet={isTablet}
                                />
                            ))
                            : sortedData.map((row, index) => (
                                <IndexRow
                                    key={row.ticker}
                                    row={row}
                                    columns={columns}
                                    isLast={index === sortedData.length - 1}
                                    isMobile={isMobile}
                                    isTablet={isTablet}
                                />
                            ))
                        }
                    </Box>
                </Box>
            </Box>

            {/* Empty state */}
            {!isLoading && data.length === 0 && (
                <Box sx={{
                    py: 6,
                    textAlign: 'center',
                }}>
                    <Typography sx={{
                        fontSize: getResponsiveFontSize('md'),
                        color: 'text.secondary',
                    }}>
                        Không có dữ liệu
                    </Typography>
                </Box>
            )}
        </Box>
    );
}
