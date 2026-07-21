// finext-nextjs/app/admin/sessions/page.tsx
'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiClient } from 'services/apiClient';
import AdminBreadcrumb from '../components/AdminBreadcrumb';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Button, Chip, IconButton, Alert, CircularProgress,
    Tooltip, useTheme, Dialog, DialogTitle,
    DialogContent, DialogContentText, DialogActions
} from '@mui/material';
import {
    UnfoldMore as ExpandIcon,
    UnfoldLess as CollapseIcon,
    Delete as DeleteIcon,
    Devices as DeviceIcon,
    Timer as TimerIcon,
    Devices
} from '@mui/icons-material';
import { format as formatDate, parseISO } from 'date-fns';
import { getResponsiveFontSize, borderRadiusTop } from 'theme/tokens';
import SortableTableHead from '../components/SortableTableHead';
import TablePaginationStyled from '../components/TablePaginationStyled';
import {
    SortConfig,
    ColumnConfig,
    sortData,
    getNextSortDirection, getResponsiveDisplayStyle
} from '../components/TableSortUtils';
import { computeClientTable, ALL_ROWS_VALUE } from '../components/TableClientPagination';
import SessionSearch, { SessionPublicAdmin } from './components/SessionSearch';

// Interface also defined in SessionSearch component
// export interface SessionPublicAdmin - using the one from SessionSearch

interface PaginatedSessionsResponse {
    items: SessionPublicAdmin[];
    total: number;
}

const SessionsPage: React.FC = () => {
    const theme = useTheme();


    const [sessions, setSessions] = useState<SessionPublicAdmin[]>([]);
    const [filteredSessions, setFilteredSessions] = useState<SessionPublicAdmin[]>([]);
    const [isFiltering, setIsFiltering] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10); const [totalCount, setTotalCount] = useState(0);

    // Delete confirmation dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [sessionToDelete, setSessionToDelete] = useState<SessionPublicAdmin | null>(null);
    const [deleting, setDeleting] = useState(false);

    // View and sorting state
    const [expandedView, setExpandedView] = useState(false);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);    // Column configuration for sortable table
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
            id: 'device_info',
            label: 'Thiết bị',
            sortable: true,
            sortType: 'string',
            accessor: (session: SessionPublicAdmin) => session.device_info || '',
            minWidth: expandedView ? 220 : 180,
            responsive: expandedView ? undefined : { xs: 'none', sm: 'none', md: 'none' }
        },
        {
            id: 'ip_address',
            label: 'IP',
            sortable: true,
            sortType: 'string',
            accessor: (session: SessionPublicAdmin) => session.ip_address || '',
            minWidth: expandedView ? 140 : 120,
            responsive: expandedView ? undefined : { xs: 'none', sm: 'none', md: 'none' }
        },
        {
            id: 'location',
            label: 'Vị trí',
            sortable: true,
            sortType: 'string',
            accessor: (session: SessionPublicAdmin) => session.location || '',
            minWidth: expandedView ? 180 : 140,
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
            accessor: () => '', minWidth: expandedView ? 100 : 60,
            align: 'center' as const
        }], [expandedView]);

    const fetchSessions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Backend sessions chỉ hỗ trợ skip/limit (KHÔNG có search/sort
            // server-side). Nạp toàn bộ tập rồi lọc/sắp xếp/phân trang phía client.
            const url = `/api/v1/sessions/all?skip=0&limit=${ALL_ROWS_VALUE}`;

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
    }, []);
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

    // Toàn bộ dữ liệu đã nạp -> lọc (ở SessionSearch) -> sắp xếp -> phân trang
    // đều thực hiện phía client, nhất quán cho cả trường hợp có/không tìm kiếm.
    const { pageItems: paginatedSessions, displayTotalCount } = useMemo(
        () => computeClientTable<SessionPublicAdmin>({
            rows: isFiltering ? filteredSessions : sessions,
            sortConfig,
            columns: columnConfigs,
            page,
            rowsPerPage,
            sortFn: sortData,
        }),
        [sessions, filteredSessions, isFiltering, sortConfig, columnConfigs, page, rowsPerPage]
    );

    // Helper function to get device icon
    const getDeviceIcon = (deviceInfo?: string) => {
        if (!deviceInfo) return <DeviceIcon fontSize="small" />;

        const deviceLower = deviceInfo.toLowerCase();
        if (deviceLower.includes('mobile') || deviceLower.includes('android') || deviceLower.includes('iphone')) {
            return <DeviceIcon fontSize="small" />;
        }
        return <DeviceIcon fontSize="small" />;
    };

    // Extract browser + OS readable từ User-Agent. Raw UA của các trình duyệt
    // Chromium đều bắt đầu "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb..."
    // nên truncate sẽ thấy giống hệt nhau → cần parse thành "Chrome trên Windows 10/11".
    const formatDeviceInfo = (deviceInfo?: string) => {
        if (!deviceInfo) return 'Không xác định';
        const info = deviceInfo.toLowerCase();

        let browser = 'Trình duyệt khác';
        if (info.includes('edg/') || info.includes('edge/')) browser = 'Edge';
        else if (info.includes('opr/') || info.includes('opera')) browser = 'Opera';
        else if (info.includes('firefox')) browser = 'Firefox';
        else if (info.includes('safari') && !info.includes('chrome')) browser = 'Safari';
        else if (info.includes('chrome')) browser = 'Chrome';

        let os = 'OS khác';
        if (info.includes('windows nt 10.0')) os = 'Windows 10/11';
        else if (info.includes('windows nt 6.3')) os = 'Windows 8.1';
        else if (info.includes('windows nt 6.1')) os = 'Windows 7';
        else if (info.includes('windows')) os = 'Windows';
        else if (info.includes('android')) os = 'Android';
        else if (info.includes('iphone') || info.includes('ipad')) os = 'iOS';
        else if (info.includes('mac os x') || info.includes('macos')) os = 'macOS';
        else if (info.includes('linux')) os = 'Linux';

        return `${browser} trên ${os}`;
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
            {/* Breadcrumb */}
            <AdminBreadcrumb />

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Devices sx={{ mr: 1, fontSize: 24 }} />
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
                                        <TableRow
                                            hover
                                            key={session.id}
                                            sx={{
                                                '&:hover': {
                                                    backgroundColor: theme.palette.component.tableRow.hover
                                                }
                                            }}
                                        >
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[0], expandedView),
                                                whiteSpace: expandedView ? 'normal' : 'nowrap',
                                                minWidth: columnConfigs[0].minWidth,
                                            }}>                                                <Tooltip title={session.user_email || session.user_id}>
                                                    <Typography sx={{
                                                        fontSize: getResponsiveFontSize('sm'),
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
                                                whiteSpace: expandedView ? 'normal' : 'nowrap',
                                                minWidth: columnConfigs[1].minWidth
                                            }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    {getDeviceIcon(session.device_info)}
                                                    <Tooltip title={session.device_info || 'Không có thông tin thiết bị'}>
                                                        <Typography sx={{
                                                            fontSize: getResponsiveFontSize('sm'),
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
                                                ...getResponsiveDisplayStyle(columnConfigs[2], expandedView),
                                                whiteSpace: 'nowrap',
                                                minWidth: columnConfigs[2].minWidth
                                            }}>
                                                <Typography sx={{ fontSize: getResponsiveFontSize('sm'), fontFamily: 'monospace' }}>
                                                    {session.ip_address || '—'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[3], expandedView),
                                                whiteSpace: expandedView ? 'normal' : 'nowrap',
                                                minWidth: columnConfigs[3].minWidth
                                            }}>
                                                <Tooltip title={session.location || 'Chưa xác định'}>
                                                    <Typography sx={{
                                                        fontSize: getResponsiveFontSize('sm'),
                                                        maxWidth: expandedView ? 'none' : 140,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: expandedView ? 'normal' : 'nowrap',
                                                        color: session.location ? 'text.primary' : 'text.disabled'
                                                    }}>
                                                        {session.location || '—'}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[4], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[4].minWidth
                                            }}>
                                                <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                                                    {columnConfigs[4].format?.(session.created_at || '')}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[5], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[5].minWidth
                                            }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <TimerIcon fontSize="small" color="action" />
                                                    <Box>
                                                        <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                                                            {columnConfigs[5].format?.(session.last_active_at || '')}
                                                        </Typography>
                                                        <Typography sx={{
                                                            color: 'text.secondary',
                                                            fontStyle: 'italic'
                                                        }}>
                                                            {getTimeDifference(session.last_active_at)}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[6], expandedView),
                                                position: 'sticky',
                                                right: -1,
                                                backgroundColor: 'background.paper',
                                                zIndex: 1,
                                                minWidth: columnConfigs[6].minWidth,
                                                width: columnConfigs[6].minWidth,
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
                                                    backgroundColor: theme.palette.component.tableRow.hover
                                                }
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
                        <TablePaginationStyled
                            count={displayTotalCount}
                            rowsPerPage={rowsPerPage}
                            page={page}
                            onPageChange={handleChangePage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
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
