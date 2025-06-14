// finext-nextjs/app/admin/sessions/page.tsx
'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiClient } from 'services/apiClient';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Button, Chip, IconButton, Alert, CircularProgress,
    TablePagination, Tooltip, useTheme, Dialog, DialogTitle,
    DialogContent, DialogContentText, DialogActions
} from '@mui/material';
import {
    AccountTree as SessionIcon,
    UnfoldMore as ExpandIcon,
    UnfoldLess as CollapseIcon,
    Delete as DeleteIcon,
    Devices as DeviceIcon,
    Timer as TimerIcon
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
import SessionSearch, { SessionPublicAdmin } from './components/SessionSearch';

// Interface also defined in SessionSearch component
// export interface SessionPublicAdmin - using the one from SessionSearch

interface PaginatedSessionsResponse {
    items: SessionPublicAdmin[];
    total: number;
}

const SessionsPage: React.FC = () => {
    const theme = useTheme();
    const componentColors = theme.palette.mode === 'light'
        ? colorTokens.lightComponentColors
        : colorTokens.darkComponentColors;

    const [sessions, setSessions] = useState<SessionPublicAdmin[]>([]);
    const [filteredSessions, setFilteredSessions] = useState<SessionPublicAdmin[]>([]);
    const [isFiltering, setIsFiltering] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    // Delete confirmation dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [sessionToDelete, setSessionToDelete] = useState<SessionPublicAdmin | null>(null);
    const [deleting, setDeleting] = useState(false);

    // View and sorting state
    const [expandedView, setExpandedView] = useState(false);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

    // Column configuration for sortable table
    const columnConfigs: ColumnConfig[] = useMemo(() => [
        {
            id: 'user_email',
            label: 'Người dùng',
            sortable: true,
            sortType: 'string',
            accessor: (session: SessionPublicAdmin) => session.user_email || session.user_id,
            minWidth: expandedView ? 250 : 200,
        },
        {
            id: 'jti',
            label: 'JWT ID',
            sortable: true,
            sortType: 'string',
            accessor: (session: SessionPublicAdmin) => session.jti,
            minWidth: expandedView ? 200 : 150,
            responsive: expandedView ? undefined : { xs: 'none', sm: 'none' }
        },
        {
            id: 'device_info',
            label: 'Thiết bị',
            sortable: true,
            sortType: 'string',
            accessor: (session: SessionPublicAdmin) => session.device_info || '',
            minWidth: expandedView ? 300 : 200,
            responsive: expandedView ? undefined : { xs: 'none', sm: 'none', md: 'none' }
        },
        {
            id: 'created_at',
            label: 'Ngày tạo',
            sortable: true,
            sortType: 'date',
            accessor: (session: SessionPublicAdmin) => session.created_at || '',
            minWidth: expandedView ? 160 : 140,
            responsive: expandedView ? undefined : { xs: 'none', sm: 'none' },
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
            id: 'last_active_at',
            label: 'Hoạt động cuối',
            sortable: true,
            sortType: 'date',
            accessor: (session: SessionPublicAdmin) => session.last_active_at || '',
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
            id: 'actions',
            label: '',
            sortable: false,
            sortType: 'string',
            accessor: () => '',
            minWidth: expandedView ? 100 : 60,
            align: 'center' as const
        }
    ], [expandedView]);

    const fetchSessions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let url = `/api/v1/sessions/all?skip=${page * rowsPerPage}&limit=${rowsPerPage}`;

            if (sortConfig && sortConfig.key && sortConfig.direction) {
                url += `&sort_by=${sortConfig.key}&sort_order=${sortConfig.direction}`;
            }

            const response = await apiClient<PaginatedSessionsResponse | SessionPublicAdmin[]>({
                url: url,
                method: 'GET',
            });

            if (response.status === 200 && response.data) {
                if ('items' in response.data && Array.isArray(response.data.items) && typeof response.data.total === 'number') {
                    console.log('Sessions data:', response.data.items);
                    setSessions(response.data.items);
                    setTotalCount(response.data.total);
                } else if (Array.isArray(response.data)) {
                    console.log('Sessions data (array):', response.data);
                    console.warn("Backend for sessions did not return total count. Pagination might be inaccurate.");
                    setSessions(response.data as SessionPublicAdmin[]);
                    const currentDataLength = (response.data as SessionPublicAdmin[]).length;
                    if (page === 0) {
                        setTotalCount(currentDataLength < rowsPerPage ? currentDataLength : currentDataLength + (currentDataLength === rowsPerPage ? rowsPerPage : 0));
                    } else if (currentDataLength < rowsPerPage) {
                        setTotalCount(page * rowsPerPage + currentDataLength);
                    } else {
                        setTotalCount(page * rowsPerPage + currentDataLength + rowsPerPage);
                    }
                } else {
                    throw new Error("Unexpected data structure from API for sessions.");
                }
            } else {
                setError(response.message || 'Failed to load sessions. Ensure the admin endpoint exists and you have access.');
                setSessions([]);
                setTotalCount(0);
            }
        } catch (err: any) {
            setError(err.message || 'Connection error or unauthorized access.');
            setSessions([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, sortConfig]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    // Update filtered sessions when sessions change and not actively filtering
    useEffect(() => {
        if (!isFiltering) {
            setFilteredSessions(sessions);
        }
    }, [sessions, isFiltering]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleFilteredSessions = (filtered: SessionPublicAdmin[], isActivelyFiltering: boolean) => {
        setFilteredSessions(filtered);
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
    const handleDeleteSession = (session: SessionPublicAdmin) => {
        setSessionToDelete(session);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!sessionToDelete) return;

        setDeleting(true);
        try {
            const response = await apiClient({
                url: `/api/v1/sessions/${sessionToDelete.id}`,
                method: 'DELETE',
            });

            if (response.status === 200) {
                // Remove the deleted session from the list
                setSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));
                setFilteredSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));
                setTotalCount(prev => prev - 1);
                setError(null);
            } else {
                setError(response.message || 'Không thể xóa session');
            }
        } catch (err: any) {
            setError(err.message || 'Lỗi khi xóa session');
        } finally {
            setDeleting(false);
            setDeleteDialogOpen(false);
            setSessionToDelete(null);
        }
    };

    const handleCancelDelete = () => {
        setDeleteDialogOpen(false);
        setSessionToDelete(null);
    };

    // Compute sorted data
    const sortedSessions = useMemo(() => {
        const dataToSort = isFiltering ? filteredSessions : sessions;

        if (!sortConfig || !sortConfig.direction) {
            return dataToSort;
        }

        const column = columnConfigs.find(col => col.id === sortConfig.key);
        if (!column) return dataToSort;

        return sortData(dataToSort, sortConfig, column);
    }, [sessions, filteredSessions, isFiltering, sortConfig, columnConfigs]);

    // Calculate paginated sessions
    const paginatedSessions = useMemo(() => {
        if (isFiltering || sortConfig) {
            if (rowsPerPage === 99999) {
                return sortedSessions;
            }
            const startIndex = page * rowsPerPage;
            const endIndex = startIndex + rowsPerPage;
            return sortedSessions.slice(startIndex, endIndex);
        } else {
            return sessions;
        }
    }, [sessions, sortedSessions, isFiltering, sortConfig, page, rowsPerPage]);

    // Calculate total count for pagination
    const displayTotalCount = (isFiltering || sortConfig) ? sortedSessions.length : totalCount;

    // Helper function to get device icon
    const getDeviceIcon = (deviceInfo?: string) => {
        if (!deviceInfo) return <DeviceIcon fontSize="small" />;

        const deviceLower = deviceInfo.toLowerCase();
        if (deviceLower.includes('mobile') || deviceLower.includes('android') || deviceLower.includes('iphone')) {
            return <DeviceIcon fontSize="small" />;
        }
        return <DeviceIcon fontSize="small" />;
    };

    // Helper function to format device info
    const formatDeviceInfo = (deviceInfo?: string) => {
        if (!deviceInfo) return 'Không xác định';

        // Try to extract browser and OS info
        const parts = deviceInfo.split(' ');
        if (parts.length > 10) {
            return deviceInfo.substring(0, 50) + '...';
        }
        return deviceInfo;
    };

    // Helper function to get time difference
    const getTimeDifference = (dateString: string) => {
        try {
            const date = parseISO(dateString);
            const now = new Date();
            const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

            if (diffInMinutes < 1) return 'Vừa xong';
            if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
            if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} giờ trước`;
            return `${Math.floor(diffInMinutes / 1440)} ngày trước`;
        } catch {
            return 'N/A';
        }
    };

    return (
        <Box sx={{ maxWidth: '100%', overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <SessionIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h3" component="h1">
                        Quản lý Sessions
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
            <SessionSearch
                sessions={sessions}
                onFilteredSessions={handleFilteredSessions}
                loading={loading}
            />

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                {loading && sessions.length === 0 ? (
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
                                    {Array.isArray(paginatedSessions) && paginatedSessions.map((session) => (
                                        <TableRow hover key={session.id}>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[0], expandedView),
                                                whiteSpace: expandedView ? 'normal' : 'nowrap',
                                                minWidth: columnConfigs[0].minWidth,
                                            }}>
                                                <Tooltip title={session.user_email || session.user_id}>
                                                    <Typography sx={{
                                                        ...responsiveTypographyTokens.tableCell,
                                                        fontWeight: 'medium',
                                                        maxWidth: expandedView ? 'none' : 200,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: expandedView ? 'normal' : 'nowrap'
                                                    }}>
                                                        {session.user_email || session.user_id}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[1], expandedView),
                                                whiteSpace: 'nowrap',
                                                minWidth: columnConfigs[1].minWidth
                                            }}>
                                                <Tooltip title={session.jti}>
                                                    <Typography sx={{
                                                        ...responsiveTypographyTokens.tableCell,
                                                        fontFamily: 'monospace',
                                                        fontSize: '0.75rem',
                                                        maxWidth: expandedView ? 'none' : 120,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}>
                                                        {session.jti}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[2], expandedView),
                                                whiteSpace: expandedView ? 'normal' : 'nowrap',
                                                minWidth: columnConfigs[2].minWidth
                                            }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    {getDeviceIcon(session.device_info)}
                                                    <Tooltip title={session.device_info || 'Không có thông tin thiết bị'}>
                                                        <Typography sx={{
                                                            ...responsiveTypographyTokens.tableCell,
                                                            maxWidth: expandedView ? 'none' : 180,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: expandedView ? 'normal' : 'nowrap'
                                                        }}>
                                                            {formatDeviceInfo(session.device_info)}
                                                        </Typography>
                                                    </Tooltip>
                                                </Box>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[3], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[3].minWidth
                                            }}>
                                                <Typography sx={responsiveTypographyTokens.tableCell}>
                                                    {columnConfigs[3].format?.(session.created_at || '')}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[4], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[4].minWidth
                                            }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <TimerIcon fontSize="small" color="action" />
                                                    <Box>
                                                        <Typography sx={responsiveTypographyTokens.tableCell}>
                                                            {columnConfigs[4].format?.(session.last_active_at || '')}
                                                        </Typography>
                                                        <Typography sx={{
                                                            fontSize: '0.7rem',
                                                            color: 'text.secondary',
                                                            fontStyle: 'italic'
                                                        }}>
                                                            {getTimeDifference(session.last_active_at)}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[5], expandedView),
                                                position: 'sticky',
                                                right: 0,
                                                backgroundColor: theme.palette.background.paper,
                                                zIndex: 2,
                                                borderLeft: '1px solid',
                                                borderColor: 'divider',
                                                minWidth: columnConfigs[5].minWidth,
                                                width: columnConfigs[5].minWidth,
                                                whiteSpace: 'nowrap',
                                                paddingLeft: 1,
                                                paddingRight: 2
                                            }} align="center">
                                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                                    <Tooltip title="Xóa session (đăng xuất)">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleDeleteSession(session)}
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
                                    {Array.isArray(paginatedSessions) && paginatedSessions.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={columnConfigs.length} align="center">
                                                <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                                                    {isFiltering
                                                        ? "Không tìm thấy session nào phù hợp với tiêu chí tìm kiếm."
                                                        : "Chưa có session nào."
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
                    Xác nhận xóa Session
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Bạn có chắc chắn muốn xóa session của người dùng "{sessionToDelete?.user_email || sessionToDelete?.user_id}"?
                        <br /><br />
                        <strong>Cảnh báo:</strong> Hành động này sẽ đăng xuất ngay lập tức người dùng khỏi
                        thiết bị/trình duyệt tương ứng và không thể hoàn tác.
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
                        {deleting ? 'Đang xóa...' : 'Xóa Session'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default SessionsPage;
