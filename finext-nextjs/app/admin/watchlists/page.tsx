// finext-nextjs/app/admin/watchlists/page.tsx
'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiClient } from 'services/apiClient';
import AdminBreadcrumb from '../components/AdminBreadcrumb';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Button, Chip, IconButton, Alert, CircularProgress,
    TablePagination, Tooltip, useTheme, Dialog, DialogTitle,
    DialogContent, DialogContentText, DialogActions
} from '@mui/material';
import {
    ListAlt as WatchlistIcon,
    UnfoldMore as ExpandIcon,
    UnfoldLess as CollapseIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import { format as formatDate, parseISO } from 'date-fns';
import { colorTokens, responsiveTypographyTokens } from 'theme/tokens';
import SortableTableHead from '../components/SortableTableHead';
import {
    SortConfig,
    ColumnConfig,
    sortData,
    getNextSortDirection, getResponsiveDisplayStyle
} from '../components/TableSortUtils';
import WatchlistSearch from './components/WatchlistSearch';

// Interface matching WatchlistPublic from backend schemas/watchlists.py
export interface WatchlistPublicAdmin {
    id: string;
    user_id: string;
    name: string;
    stock_symbols: string[];
    created_at: string;
    updated_at: string;
    user_email?: string;
}

interface PaginatedWatchlistsResponse {
    items: WatchlistPublicAdmin[];
    total: number;
}

const WatchlistsPage: React.FC = () => {
    const theme = useTheme();
    const componentColors = theme.palette.mode === 'light'
        ? colorTokens.lightComponentColors
        : colorTokens.darkComponentColors; const [watchlists, setWatchlists] = useState<WatchlistPublicAdmin[]>([]);
    const [filteredWatchlists, setFilteredWatchlists] = useState<WatchlistPublicAdmin[]>([]);
    const [isFiltering, setIsFiltering] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    // Delete confirmation dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [watchlistToDelete, setWatchlistToDelete] = useState<WatchlistPublicAdmin | null>(null);
    const [deleting, setDeleting] = useState(false);// View and sorting state
    const [expandedView, setExpandedView] = useState(false);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

    // Column configuration for sortable table
    const columnConfigs: ColumnConfig[] = useMemo(() => [
        {
            id: 'name',
            label: 'Tên Watchlist',
            sortable: true,
            sortType: 'string',
            accessor: (watchlist: WatchlistPublicAdmin) => watchlist.name,
            minWidth: expandedView ? 200 : 180,
        },
        {
            id: 'user_email',
            label: 'Người dùng',
            sortable: true,
            sortType: 'string',
            accessor: (watchlist: WatchlistPublicAdmin) => watchlist.user_email || watchlist.user_id,
            minWidth: expandedView ? 250 : 200,
            responsive: expandedView ? undefined : { xs: 'none', sm: 'none' }
        },
        {
            id: 'stock_symbols',
            label: 'Số mã CK',
            sortable: true,
            sortType: 'number',
            accessor: (watchlist: WatchlistPublicAdmin) => watchlist.stock_symbols.length,
            minWidth: expandedView ? 120 : 100,
            align: 'center' as const
        },
        {
            id: 'created_at',
            label: 'Ngày tạo',
            sortable: true,
            sortType: 'date',
            accessor: (watchlist: WatchlistPublicAdmin) => watchlist.created_at || '',
            minWidth: expandedView ? 160 : 140,
            responsive: expandedView ? undefined : { xs: 'none', sm: 'none', md: 'none' },
            format: (value: string) => {
                if (!value) return 'N/A';
                try {
                    const utcDate = parseISO(value);
                    const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
                    return formatDate(gmt7Date, 'dd/MM/yyyy HH:mm');
                } catch (error) {
                    return 'Invalid date';
                }
            },
        },
        {
            id: 'updated_at',
            label: 'Ngày cập nhật',
            sortable: true,
            sortType: 'date',
            accessor: (watchlist: WatchlistPublicAdmin) => watchlist.updated_at || '',
            minWidth: expandedView ? 160 : 140,
            responsive: expandedView ? undefined : { xs: 'none', sm: 'none', md: 'none', lg: 'none' }, format: (value: string) => {
                if (!value) return 'N/A';
                try {
                    const utcDate = parseISO(value);
                    const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
                    return formatDate(gmt7Date, 'dd/MM/yyyy HH:mm');
                } catch (error) {
                    return 'Invalid date';
                }
            },
        },
        {
            id: 'actions',
            label: '',
            sortable: false,
            sortType: 'string',
            accessor: () => '',
            minWidth: expandedView ? 100 : 60,
            align: 'center' as const
        }
    ], [expandedView]); const fetchWatchlists = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let url = `/api/v1/watchlists/admin/all?skip=${page * rowsPerPage}&limit=${rowsPerPage}`;

            if (sortConfig && sortConfig.key && sortConfig.direction) {
                url += `&sort_by=${sortConfig.key}&sort_order=${sortConfig.direction}`;
            }

            const response = await apiClient<PaginatedWatchlistsResponse | WatchlistPublicAdmin[]>({
                url: url,
                method: 'GET',
            });

            if (response.status === 200 && response.data) {
                if ('items' in response.data && Array.isArray(response.data.items) && typeof response.data.total === 'number') {
                    console.log('Watchlists data:', response.data.items);
                    setWatchlists(response.data.items);
                    setTotalCount(response.data.total);
                } else if (Array.isArray(response.data)) {
                    console.log('Watchlists data (array):', response.data);
                    console.warn("Backend for watchlists did not return total count. Pagination might be inaccurate.");
                    setWatchlists(response.data as WatchlistPublicAdmin[]);
                    const currentDataLength = (response.data as WatchlistPublicAdmin[]).length;
                    if (page === 0) {
                        setTotalCount(currentDataLength < rowsPerPage ? currentDataLength : currentDataLength + (currentDataLength === rowsPerPage ? rowsPerPage : 0));
                    } else if (currentDataLength < rowsPerPage) {
                        setTotalCount(page * rowsPerPage + currentDataLength);
                    } else {
                        setTotalCount(page * rowsPerPage + currentDataLength + rowsPerPage);
                    }
                } else {
                    throw new Error("Unexpected data structure from API for watchlists.");
                }
            } else {
                setError(response.message || 'Failed to load watchlists. Ensure the admin endpoint exists and you have access.');
                setWatchlists([]);
                setTotalCount(0);
            }
        } catch (err: any) {
            setError(err.message || 'Connection error or unauthorized access.');
            setWatchlists([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, sortConfig]);

    useEffect(() => {
        fetchWatchlists();
    }, [fetchWatchlists]);

    // Update filtered watchlists when watchlists change and not actively filtering
    useEffect(() => {
        if (!isFiltering) {
            setFilteredWatchlists(watchlists);
        }
    }, [watchlists, isFiltering]); const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleFilteredWatchlists = (filtered: WatchlistPublicAdmin[], isActivelyFiltering: boolean) => {
        setFilteredWatchlists(filtered);
        setIsFiltering(isActivelyFiltering);
        if (isActivelyFiltering !== isFiltering) {
            setPage(0);
        }
    };

    // Handle sorting
    const handleSort = (columnKey: string) => {
        const column = columnConfigs.find(col => col.id === columnKey);
        if (!column || !column.sortable) return;

        const newDirection = sortConfig?.key === columnKey
            ? getNextSortDirection(sortConfig.direction)
            : 'asc';

        setSortConfig(newDirection ? { key: columnKey, direction: newDirection } : null);
        setPage(0);
    };

    // Delete handlers
    const handleDeleteWatchlist = (watchlist: WatchlistPublicAdmin) => {
        setWatchlistToDelete(watchlist);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!watchlistToDelete) return;

        setDeleting(true);
        try {
            const response = await apiClient({
                url: `/api/v1/watchlists/admin/${watchlistToDelete.id}`,
                method: 'DELETE',
            });

            if (response.status === 200) {
                // Remove the deleted watchlist from the list
                setWatchlists(prev => prev.filter(w => w.id !== watchlistToDelete.id));
                setFilteredWatchlists(prev => prev.filter(w => w.id !== watchlistToDelete.id));
                setTotalCount(prev => prev - 1);
                setError(null);
            } else {
                setError(response.message || 'Không thể xóa watchlist');
            }
        } catch (err: any) {
            setError(err.message || 'Lỗi khi xóa watchlist');
        } finally {
            setDeleting(false);
            setDeleteDialogOpen(false);
            setWatchlistToDelete(null);
        }
    };

    const handleCancelDelete = () => {
        setDeleteDialogOpen(false);
        setWatchlistToDelete(null);
    };

    // Compute sorted data
    const sortedWatchlists = useMemo(() => {
        const dataToSort = isFiltering ? filteredWatchlists : watchlists;

        if (!sortConfig || !sortConfig.direction) {
            return dataToSort;
        }

        const column = columnConfigs.find(col => col.id === sortConfig.key);
        if (!column) return dataToSort;

        return sortData(dataToSort, sortConfig, column);
    }, [watchlists, filteredWatchlists, isFiltering, sortConfig, columnConfigs]);

    // Calculate paginated watchlists
    const paginatedWatchlists = useMemo(() => {
        if (isFiltering || sortConfig) {
            if (rowsPerPage === 99999) {
                return sortedWatchlists;
            }
            const startIndex = page * rowsPerPage;
            const endIndex = startIndex + rowsPerPage;
            return sortedWatchlists.slice(startIndex, endIndex);
        } else {
            return watchlists;
        }
    }, [watchlists, sortedWatchlists, isFiltering, sortConfig, page, rowsPerPage]);    // Calculate total count for pagination
    const displayTotalCount = (isFiltering || sortConfig) ? sortedWatchlists.length : totalCount;

    return (
        <Box sx={{ maxWidth: '100%', overflow: 'hidden' }}>
            {/* Breadcrumb */}
            <AdminBreadcrumb />

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <WatchlistIcon sx={{ mr: 1 }} />
                    <Typography variant="h3" component="h1">
                        Quản lý Watchlists
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        startIcon={expandedView ? <CollapseIcon /> : <ExpandIcon />}
                        onClick={() => setExpandedView(!expandedView)}
                        sx={{
                            minWidth: { xs: 'auto', sm: 'auto', md: 'auto' },
                            '& .MuiButton-startIcon': {
                                margin: { xs: 0, sm: 0, md: '0 8px 0 -4px' }
                            },
                            px: { xs: 1, sm: 2 },
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                    >
                        <Box
                            component="span"
                            sx={{
                                display: { xs: 'none', sm: 'none', md: 'inline' }
                            }}
                        >
                            {expandedView ? 'Chế độ thu gọn' : 'Chế độ chi tiết'}
                        </Box>
                    </Button>
                </Box>
            </Box>
            {/* Search/Filter Component */}
            <WatchlistSearch
                watchlists={watchlists}
                onFilteredWatchlists={handleFilteredWatchlists}
                loading={loading}
            />

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                {loading && watchlists.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3, minHeight: 300 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <TableContainer sx={{ overflowX: 'auto' }}>
                            <Table sx={{
                                tableLayout: 'auto',
                                width: '100%'
                            }}>
                                <SortableTableHead
                                    columns={columnConfigs}
                                    sortConfig={sortConfig}
                                    onSort={handleSort}
                                    expandedView={expandedView}
                                />
                                <TableBody>
                                    {Array.isArray(paginatedWatchlists) && paginatedWatchlists.map((watchlist) => (
                                        <TableRow
                                            hover
                                            key={watchlist.id}
                                            sx={{
                                                '&:hover': {
                                                    backgroundColor: componentColors.tableRow.hover
                                                }
                                            }}
                                        >
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[0], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[0].minWidth,
                                            }}>
                                                <Typography sx={{
                                                    ...responsiveTypographyTokens.tableCell,
                                                    fontWeight: 'medium',
                                                    fontFamily: 'monospace'
                                                }}>
                                                    {watchlist.name}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[1], expandedView),
                                                whiteSpace: expandedView ? 'normal' : 'nowrap',
                                                minWidth: columnConfigs[1].minWidth
                                            }}>
                                                <Tooltip title={watchlist.user_email || watchlist.user_id}>
                                                    <Typography sx={{
                                                        ...responsiveTypographyTokens.tableCell,
                                                        maxWidth: expandedView ? 'none' : 200,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: expandedView ? 'normal' : 'nowrap'
                                                    }}>
                                                        {watchlist.user_email || watchlist.user_id}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[2], expandedView),
                                                whiteSpace: 'nowrap',
                                                minWidth: columnConfigs[2].minWidth
                                            }} align="center">
                                                <Tooltip
                                                    title={
                                                        <Box sx={{ p: 1 }}>
                                                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                                                                Danh sách mã chứng khoán ({watchlist.stock_symbols.length})
                                                            </Typography>
                                                            <Box sx={{
                                                                display: 'flex',
                                                                flexWrap: 'wrap',
                                                                gap: 0.5,
                                                                maxWidth: 300,
                                                                maxHeight: 200,
                                                                overflowY: 'auto'
                                                            }}>
                                                                {watchlist.stock_symbols.length > 0 ? (
                                                                    watchlist.stock_symbols.map((symbol, index) => (
                                                                        <Chip
                                                                            key={index}
                                                                            label={symbol}
                                                                            size="small"
                                                                            variant="outlined"
                                                                            sx={{
                                                                                height: 20,
                                                                                backgroundColor: 'primary.main',
                                                                                color: 'primary.contrastText',
                                                                                border: 'none',
                                                                                '& .MuiChip-label': {
                                                                                    px: 0.75
                                                                                }
                                                                            }}
                                                                        />
                                                                    ))
                                                                ) : (
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        Không có mã nào
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </Box>
                                                    }
                                                    arrow
                                                    placement="top"
                                                    enterDelay={300}
                                                    leaveDelay={200}
                                                    PopperProps={{
                                                        sx: {
                                                            '& .MuiTooltip-tooltip': {
                                                                backgroundColor: 'background.paper',
                                                                color: 'text.primary',
                                                                border: '1px solid',
                                                                borderColor: 'divider',
                                                                borderRadius: 2,
                                                                boxShadow: 3,
                                                                maxWidth: 'none'
                                                            },
                                                            '& .MuiTooltip-arrow': {
                                                                color: 'background.paper',
                                                                '&::before': {
                                                                    border: '1px solid',
                                                                    borderColor: 'divider',
                                                                    backgroundColor: 'background.paper'
                                                                }
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <Chip
                                                        label={watchlist.stock_symbols.length}
                                                        size="small"
                                                        variant="filled"
                                                        sx={{
                                                            backgroundColor: componentColors.chip.defaultBackground,
                                                            color: componentColors.chip.defaultColor,
                                                            height: 24,
                                                            cursor: 'pointer',
                                                            '&:hover': {
                                                                backgroundColor: 'primary.main',
                                                                color: 'primary.contrastText',
                                                                transform: 'scale(1.05)',
                                                            },
                                                            transition: 'all 0.2s ease-in-out'
                                                        }}
                                                    />
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[3], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[3].minWidth
                                            }}>
                                                <Typography sx={responsiveTypographyTokens.tableCell}>
                                                    {columnConfigs[3].format?.(watchlist.created_at || '')}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[4], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[4].minWidth
                                            }}>
                                                <Typography sx={responsiveTypographyTokens.tableCell}>
                                                    {columnConfigs[4].format?.(watchlist.updated_at || '')}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[5], expandedView),
                                                position: 'sticky',
                                                right: -1,
                                                backgroundColor: 'background.paper',
                                                zIndex: 1,
                                                minWidth: columnConfigs[5].minWidth,
                                                width: columnConfigs[5].minWidth,
                                                whiteSpace: 'nowrap',
                                                paddingLeft: 1,
                                                paddingRight: 2,
                                                // Ensure border visibility during scroll
                                                '&::before': {
                                                    content: '""',
                                                    position: 'absolute',
                                                    left: 0,
                                                    top: 0,
                                                    bottom: 0,
                                                    width: '1px',
                                                    backgroundColor: 'divider',
                                                    zIndex: 1
                                                },
                                                // Apply hover effect when parent row is hovered - synchronized with table row hover color
                                                'tr:hover &': {
                                                    backgroundColor: componentColors.tableRow.hover
                                                }
                                            }} align="center">
                                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                                    <Tooltip title="Xóa watchlist">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleDeleteWatchlist(watchlist)}
                                                            color="error"
                                                            sx={{
                                                                minWidth: { xs: 32, sm: 'auto' },
                                                                width: { xs: 32, sm: 'auto' },
                                                                height: { xs: 32, sm: 'auto' }
                                                            }}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {Array.isArray(paginatedWatchlists) && paginatedWatchlists.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={columnConfigs.length} align="center">
                                                <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                                                    {isFiltering
                                                        ? "Không tìm thấy watchlist nào phù hợp với tiêu chí tìm kiếm."
                                                        : "Chưa có watchlist nào."
                                                    }
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination
                            rowsPerPageOptions={[5, 10, 25, 50, { label: 'Tất cả', value: 99999 }]}
                            component="div"
                            count={displayTotalCount}
                            rowsPerPage={rowsPerPage}
                            page={page}
                            onPageChange={handleChangePage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                            labelRowsPerPage={
                                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                                    Dòng mỗi trang:
                                </Box>
                            }
                            sx={{
                                '& .MuiTablePagination-toolbar': {
                                    minHeight: { xs: 48, sm: 52 },
                                    px: { xs: 1, sm: 2 }
                                },
                                '& .MuiTablePagination-selectLabel': {
                                    ...responsiveTypographyTokens.tableCellSmall,
                                    display: { xs: 'none', sm: 'block' }
                                },
                                '& .MuiTablePagination-displayedRows': {
                                    ...responsiveTypographyTokens.tableCellSmall,
                                    margin: 0
                                }
                            }}
                        />
                    </>
                )}
            </Paper>
            {/* Delete confirmation dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={handleCancelDelete}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Xác nhận xóa Watchlist
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Bạn có chắc chắn muốn xóa watchlist "{watchlistToDelete?.name}"?
                        <br /><br />
                        <strong>Cảnh báo:</strong> Hành động này không thể hoàn tác và sẽ xóa vĩnh viễn
                        watchlist này khỏi hệ thống.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ p: 3, gap: 1 }}>
                    <Button
                        onClick={handleCancelDelete}
                        variant="outlined"
                        disabled={deleting}
                    >
                        Hủy
                    </Button>
                    <Button
                        onClick={handleConfirmDelete}
                        variant="contained"
                        color="error"
                        disabled={deleting}
                        startIcon={deleting ? <CircularProgress size={16} /> : undefined}
                    >
                        {deleting ? 'Đang xóa...' : 'Xóa Watchlist'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default WatchlistsPage;