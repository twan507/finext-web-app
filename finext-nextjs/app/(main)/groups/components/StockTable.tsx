'use client';

import { useMemo, useCallback, useState } from 'react';
import { Box, Typography, Skeleton, useTheme, useMediaQuery } from '@mui/material';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import Link from 'next/link';
import {
    getResponsiveFontSize,
    fontWeight,
    borderRadius,
    transitions,
} from 'theme/tokens';
import { getTrendColor, getFlowColor, getVsiColor } from 'theme/colorHelpers';

// ========== TYPES ==========
export interface IndexRowData {
    ticker: string;
    ticker_name?: string;
    close: number;
    diff?: number;
    pct_change: number;
    w_pct?: number;
    m_pct?: number;
    q_pct?: number;
    y_pct?: number;
    t0_score?: number;
    t5_score?: number;
    vsi?: number;
    type?: string;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
    key: keyof IndexRowData | null;
    direction: SortDirection;
}

// ========== COLUMN DEFINITION ==========
interface ColumnDef {
    key: keyof IndexRowData;
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

const formatPctDirect = (val: number | null | undefined): string => {
    if (val == null) return '—';
    return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
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
        label: 'Chỉ số',
        align: 'left',
        minWidth: 80,
        sortable: true,
    },
    {
        key: 'close',
        label: 'Giá trị',
        align: 'right',
        minWidth: 90,
        sortable: true,
    },
    {
        key: 'diff',
        label: '+/-',
        align: 'right',
        minWidth: 75,
        sortable: true,
    },
    {
        key: 'pct_change',
        label: '% Thay đổi',
        align: 'right',
        minWidth: 95,
        sortable: true,
    },
    {
        key: 'w_pct',
        label: '% Tuần',
        align: 'right',
        minWidth: 80,
        sortable: true,
        hideOnMobile: true,
        hideOnTablet: true,
    },
    {
        key: 'm_pct',
        label: '% Tháng',
        align: 'right',
        minWidth: 80,
        sortable: true,
        hideOnMobile: true,
        hideOnTablet: true,
    },
    {
        key: 'q_pct',
        label: '% Quý',
        align: 'right',
        minWidth: 80,
        sortable: true,
        hideOnMobile: true,
        hideOnTablet: true,
    },
    {
        key: 'y_pct',
        label: '% Năm',
        align: 'right',
        minWidth: 80,
        sortable: true,
        hideOnMobile: true,
        hideOnTablet: true,
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
    onSort: (key: keyof IndexRowData) => void;
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
    linkBase,
}: {
    row: IndexRowData;
    columns: ColumnDef[];
    isLast: boolean;
    isMobile: boolean;
    isTablet: boolean;
    linkBase: string;
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const hoverBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';

    // Clickable indicator columns - only ticker (Chỉ số) column is clickable
    const clickableKeys = ['ticker'] as const;
    const isClickable = (key: keyof IndexRowData) => clickableKeys.includes(key as typeof clickableKeys[number]);

    const handleCellClick = (key: keyof IndexRowData) => {
        if (isClickable(key)) {
            window.location.href = `${linkBase}/${row.ticker.toLowerCase()}`;
        }
    };

    const renderCellContent = (column: ColumnDef): React.ReactNode => {
        switch (column.key) {
            case 'ticker':
                return (
                    <Box>
                        <Typography
                            sx={{
                                fontSize: getResponsiveFontSize('sm'),
                                fontWeight: fontWeight.bold,
                                color: 'text.primary',
                                lineHeight: 1.3,
                            }}
                        >
                            {row.ticker}
                        </Typography>
                        {row.ticker_name && (
                            <Typography
                                sx={{
                                    fontSize: getResponsiveFontSize('xxs'),
                                    color: 'text.secondary',
                                    lineHeight: 1.3,
                                    maxWidth: 140,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                            >
                                {row.ticker_name}
                            </Typography>
                        )}
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
                        color: getTrendColor(row.pct_change != null ? row.pct_change * 100 : null, theme),
                    }}>
                        {formatDiff(row.diff)}
                    </Typography>
                );

            case 'pct_change':
                return (
                    <Typography sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        fontWeight: fontWeight.medium,
                        color: getTrendColor(row.pct_change != null ? row.pct_change * 100 : null, theme),
                    }}>
                        {formatPct(row.pct_change)}
                    </Typography>
                );

            case 'w_pct':
            case 'm_pct':
            case 'q_pct':
            case 'y_pct': {
                const val = row[column.key] as number | undefined;
                return (
                    <Typography sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        fontWeight: fontWeight.medium,
                        color: getTrendColor(val ?? null, theme),
                    }}>
                        {formatPctDirect(val)}
                    </Typography>
                );
            }

            case 't0_score':
            case 't5_score': {
                const score = row[column.key] as number | undefined;
                return (
                    <Typography
                        component="span"
                        sx={{
                            fontSize: getResponsiveFontSize('sm'),
                            fontWeight: fontWeight.medium,
                            color: score != null ? getFlowColor(score, theme) : 'text.secondary',
                        }}
                    >
                        {formatScore(score)}
                    </Typography>
                );
            }

            case 'vsi':
                return (
                    <Typography
                        component="span"
                        sx={{
                            fontSize: getResponsiveFontSize('sm'),
                            fontWeight: fontWeight.medium,
                            color: row.vsi != null ? getVsiColor(row.vsi, theme) : 'text.secondary',
                        }}
                    >
                        {formatVsi(row.vsi)}
                    </Typography>
                );

            default:
                return (
                    <Typography sx={{
                        fontSize: getResponsiveFontSize('sm'),
                        fontWeight: fontWeight.medium,
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

                const clickable = isClickable(col.key);

                return (
                    <Box
                        component="td"
                        key={col.key}
                        onClick={() => handleCellClick(col.key)}
                        sx={{
                            textAlign: col.align,
                            px: 1.5,
                            py: 1.25,
                            borderBottom: isLast ? 'none' : `1px solid ${dividerColor}`,
                            verticalAlign: 'middle',
                            cursor: clickable ? 'pointer' : 'default',
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
interface StockTableProps {
    data: IndexRowData[];
    isLoading?: boolean;
    skeletonRows?: number;
    linkBase?: string;
}

export default function StockTable({
    data,
    isLoading = false,
    skeletonRows = 8,
    linkBase = '/groups',
}: StockTableProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));

    const columns = useMemo(() => getColumns(), []);

    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });

    const handleSort = useCallback((key: keyof IndexRowData) => {
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
                                    columns={columns}
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
                                    linkBase={linkBase}
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
