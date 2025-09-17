// finext-nextjs/app/admin/otps/page.tsx
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
    VpnKey as OtpIcon,
    UnfoldMore as ExpandIcon,
    UnfoldLess as CollapseIcon,
    CheckCircle as VerifiedIcon,
    Schedule as PendingIcon,
    Error as ExpiredIcon,
    Block as InvalidIcon
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
import OtpSearch, { OtpPublicAdmin, OtpTypeEnumFE } from './components/OtpSearch';

interface PaginatedOtpsResponse {
    items: OtpPublicAdmin[];
    total: number;
}

const OtpsPage: React.FC = () => {
    const theme = useTheme();
    const componentColors = theme.palette.mode === 'light'
        ? colorTokens.lightComponentColors
        : colorTokens.darkComponentColors;

    const [otps, setOtps] = useState<OtpPublicAdmin[]>([]);
    const [filteredOtps, setFilteredOtps] = useState<OtpPublicAdmin[]>([]);
    const [isFiltering, setIsFiltering] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);    // Delete confirmation dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [otpToDelete, setOtpToDelete] = useState<OtpPublicAdmin | null>(null);
    const [deleting, setDeleting] = useState(false);

    // View and sorting state
    const [expandedView, setExpandedView] = useState(false);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
    const [userEmails, setUserEmails] = useState<Map<string, string>>(new Map());
    const [emailsLoading, setEmailsLoading] = useState(false);

    // Auto-refresh state for countdown
    const [refreshTick, setRefreshTick] = useState(0);

    // Column configuration for sortable table
    const columnConfigs: ColumnConfig[] = useMemo(() => [
        {
            id: 'user_email',
            label: 'Người dùng',
            sortable: true,
            sortType: 'string',
            accessor: (otp: OtpPublicAdmin) => userEmails.get(otp.user_id) || otp.user_email || otp.user_id,
            minWidth: expandedView ? 250 : 200,
        },
        {
            id: 'otp_type',
            label: 'Loại OTP',
            sortable: true,
            sortType: 'string',
            accessor: (otp: OtpPublicAdmin) => otp.otp_type,
            minWidth: expandedView ? 180 : 150,
            responsive: expandedView ? undefined : { xs: 'none', sm: 'none' }
        },
        {
            id: 'status',
            label: 'Trạng thái',
            sortable: true,
            sortType: 'string',
            accessor: (otp: OtpPublicAdmin) => {
                const now = new Date();
                const expiresAt = new Date(otp.expires_at);
                if (otp.verified_at) return 'verified';
                if (expiresAt < now) return 'expired';
                return 'pending';
            },
            minWidth: expandedView ? 140 : 120,
            align: 'center' as const
        },
        {
            id: 'attempts',
            label: 'Lần thử',
            sortable: true,
            sortType: 'number',
            accessor: (otp: OtpPublicAdmin) => otp.attempts || 0,
            minWidth: expandedView ? 100 : 80,
            align: 'center' as const,
            responsive: expandedView ? undefined : { xs: 'none', sm: 'none' }
        },
        {
            id: 'created_at',
            label: 'Ngày tạo',
            sortable: true,
            sortType: 'date',
            accessor: (otp: OtpPublicAdmin) => otp.created_at || '',
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
            id: 'expires_at',
            label: 'Hết hạn',
            sortable: true,
            sortType: 'date',
            accessor: (otp: OtpPublicAdmin) => otp.expires_at || '',
            minWidth: expandedView ? 160 : 140,
            responsive: expandedView ? undefined : { xs: 'none', sm: 'none', md: 'none', lg: 'none' },
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
    ], [expandedView, userEmails]);

    const fetchUserEmails = useCallback(async (userIds: string[]) => {
        if (userIds.length === 0) return;

        setEmailsLoading(true);
        const emailsMap = new Map<string, string>();

        try {
            // Fetch user details for each user_id to get their email
            const emailPromises = userIds.map(async (userId) => {
                try {
                    const response = await apiClient<{
                        id: string;
                        email: string;
                        full_name: string;
                    }>({
                        url: `/api/v1/users/${userId}`,
                        method: 'GET',
                    });

                    if (response.status === 200 && response.data) {
                        return { userId, email: response.data.email };
                    }
                } catch (err) {
                    console.warn(`Failed to load email for user ${userId}`);
                }
                return null;
            });

            const results = await Promise.all(emailPromises);

            results.forEach(result => {
                if (result) {
                    emailsMap.set(result.userId, result.email);
                }
            });

            setUserEmails(emailsMap);
        } catch (err: any) {
            console.error('Failed to load user emails:', err.message);
        } finally {
            setEmailsLoading(false);
        }
    }, []);

    const fetchOtps = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let url = `/api/v1/otps/admin/all?skip=${page * rowsPerPage}&limit=${rowsPerPage}`;

            if (sortConfig && sortConfig.key && sortConfig.direction) {
                url += `&sort_by=${sortConfig.key}&sort_order=${sortConfig.direction}`;
            }

            const response = await apiClient<PaginatedOtpsResponse | OtpPublicAdmin[]>({
                url: url,
                method: 'GET',
            }); if (response.status === 200 && response.data) {
                if ('items' in response.data && Array.isArray(response.data.items) && typeof response.data.total === 'number') {
                    setOtps(response.data.items);
                    setTotalCount(response.data.total);
                } else if (Array.isArray(response.data)) {
                    console.warn("Backend for OTPs did not return total count. Pagination might be inaccurate.");
                    setOtps(response.data as OtpPublicAdmin[]);
                    const currentDataLength = (response.data as OtpPublicAdmin[]).length;
                    if (page === 0) {
                        setTotalCount(currentDataLength < rowsPerPage ? currentDataLength : currentDataLength + (currentDataLength === rowsPerPage ? rowsPerPage : 0));
                    } else if (currentDataLength < rowsPerPage) {
                        setTotalCount(page * rowsPerPage + currentDataLength);
                    } else {
                        setTotalCount(page * rowsPerPage + currentDataLength + rowsPerPage);
                    }
                } else {
                    throw new Error("Unexpected data structure from API for OTPs.");
                }
            } else {
                setError(response.message || 'Failed to load OTP records. Ensure the admin endpoint exists and you have access.');
                setOtps([]);
                setTotalCount(0);
            }
        } catch (err: any) {
            setError(err.message || 'Connection error or unauthorized access.');
            setOtps([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, sortConfig]);

    useEffect(() => {
        fetchOtps();
    }, [fetchOtps]);

    // Fetch user emails when OTPs change
    useEffect(() => {
        const userIds = otps.map(otp => otp.user_id);
        if (userIds.length > 0) {
            fetchUserEmails(userIds);
        }
    }, [otps, fetchUserEmails]);

    // Update filtered OTPs when OTPs change and not actively filtering
    useEffect(() => {
        if (!isFiltering) {
            setFilteredOtps(otps);
        }
    }, [otps, isFiltering]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleFilteredOtps = (filtered: OtpPublicAdmin[], isActivelyFiltering: boolean) => {
        setFilteredOtps(filtered);
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
    const handleDeleteOtp = (otp: OtpPublicAdmin) => {
        setOtpToDelete(otp);
        setDeleteDialogOpen(true);
    }; const handleConfirmDelete = async () => {
        if (!otpToDelete) return;

        setDeleting(true);
        try {
            const response = await apiClient({
                url: `/api/v1/otps/admin/${otpToDelete.id}/invalidate`,
                method: 'PUT',
            });

            if (response.status === 200) {
                // Refresh the OTP list after invalidation
                await fetchOtps();
                setError(null);
            } else {
                setError(response.message || 'Không thể vô hiệu hóa OTP');
            }
        } catch (err: any) {
            setError(err.message || 'Lỗi khi vô hiệu hóa OTP');
        } finally {
            setDeleting(false);
            setDeleteDialogOpen(false);
            setOtpToDelete(null);
        }
    };

    const handleCancelDelete = () => {
        setDeleteDialogOpen(false);
        setOtpToDelete(null);
    };

    // Compute sorted data
    const sortedOtps = useMemo(() => {
        const dataToSort = isFiltering ? filteredOtps : otps;

        if (!sortConfig || !sortConfig.direction) {
            return dataToSort;
        }

        const column = columnConfigs.find(col => col.id === sortConfig.key);
        if (!column) return dataToSort;

        return sortData(dataToSort, sortConfig, column);
    }, [otps, filteredOtps, isFiltering, sortConfig, columnConfigs]);

    // Calculate paginated OTPs
    const paginatedOtps = useMemo(() => {
        if (isFiltering || sortConfig) {
            if (rowsPerPage === 99999) {
                return sortedOtps;
            }
            const startIndex = page * rowsPerPage;
            const endIndex = startIndex + rowsPerPage;
            return sortedOtps.slice(startIndex, endIndex);
        } else {
            return otps;
        }
    }, [otps, sortedOtps, isFiltering, sortConfig, page, rowsPerPage]);

    // Calculate total count for pagination
    const displayTotalCount = (isFiltering || sortConfig) ? sortedOtps.length : totalCount;

    // Helper function to get OTP type display
    const getOtpTypeDisplay = (type: OtpTypeEnumFE) => {
        switch (type) {
            case OtpTypeEnumFE.EMAIL_VERIFICATION:
                return 'Xác thực Email';
            case OtpTypeEnumFE.RESET_PASSWORD:
                return 'Đặt lại MK';
            case OtpTypeEnumFE.PWDLESS_LOGIN:
                return 'Đăng nhập';
            default:
                return type;
        }
    };    // Helper function to get status display
    const getStatusDisplay = (otp: OtpPublicAdmin) => {
        try {
            const now = new Date();

            // Backend gửi UTC time nhưng không có 'Z', cần thêm 'Z' để parseISO hiểu đúng
            const expiresAtString = otp.expires_at.endsWith('Z') ? otp.expires_at : otp.expires_at + 'Z';
            const expiresAt = parseISO(expiresAtString);

            if (expiresAt > now) {
                return {
                    label: 'Còn hạn',
                    color: 'success' as const,
                    icon: <VerifiedIcon fontSize="small" />
                };
            } else {
                return {
                    label: 'Hết hạn',
                    color: 'error' as const,
                    icon: <ExpiredIcon fontSize="small" />
                };
            }
        } catch (error) {
            return {
                label: 'Hết hạn',
                color: 'error' as const,
                icon: <ExpiredIcon fontSize="small" />
            };
        }
    };    // Helper function to get time remaining (with auto-refresh)
    const getTimeRemaining = useCallback((expiresAt: string) => {
        // refreshTick is used to trigger re-calculation every second
        refreshTick; // This line forces the function to re-run when refreshTick changes

        try {
            const now = new Date();

            // Backend gửi UTC time nhưng không có 'Z', cần thêm 'Z' để parseISO hiểu đúng
            const expiresAtString = expiresAt.endsWith('Z') ? expiresAt : expiresAt + 'Z';
            const expires = parseISO(expiresAtString);
            const diff = expires.getTime() - now.getTime();

            if (diff <= 0) return 'Đã hết hạn';

            const totalSeconds = Math.floor(diff / 1000);
            const days = Math.floor(totalSeconds / (24 * 60 * 60));
            const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
            const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
            const seconds = totalSeconds % 60;

            if (days > 0) {
                return `${days} ngày ${hours} giờ`;
            } else if (hours > 0) {
                return `${hours} giờ ${minutes} phút`;
            } else if (minutes > 0) {
                return `${minutes} phút ${seconds} giây`;
            } else {
                return `${seconds} giây`;
            }
        } catch (error) {
            return 'N/A';
        }
    }, [refreshTick]);

    // Effect to handle auto-refresh countdown
    useEffect(() => {
        const interval = setInterval(() => {
            setRefreshTick(tick => tick + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <Box sx={{ maxWidth: '100%', overflow: 'hidden' }}>
            {/* Breadcrumb */}
            <AdminBreadcrumb />

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <OtpIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h3" component="h1">
                        Quản lý OTP
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

            {/* Search Component */}
            <OtpSearch
                otps={otps}
                onFilteredOtps={handleFilteredOtps}
                loading={loading}
            />

            {/* Error Display */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {/* Table */}
            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                {loading && otps.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3, minHeight: 300 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <TableContainer sx={{ overflowX: 'auto' }}>
                            <Table sx={{
                                tableLayout: 'auto',
                                width: '100%'
                            }} stickyHeader aria-label="OTPs table">
                                <SortableTableHead
                                    columns={columnConfigs}
                                    sortConfig={sortConfig}
                                    onSort={handleSort}
                                    expandedView={expandedView}
                                />
                                <TableBody>
                                    {Array.isArray(paginatedOtps) && paginatedOtps.map((otp) => (
                                        <TableRow hover key={otp.id}>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[0], expandedView),
                                                whiteSpace: expandedView ? 'normal' : 'nowrap',
                                                minWidth: columnConfigs[0].minWidth,
                                            }}>
                                                <Tooltip title={userEmails.get(otp.user_id) || otp.user_email || otp.user_id}>
                                                    <Typography sx={{
                                                        ...responsiveTypographyTokens.tableCell,
                                                        maxWidth: expandedView ? 'none' : 200,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: expandedView ? 'normal' : 'nowrap'
                                                    }}>
                                                        {userEmails.get(otp.user_id) || otp.user_email || otp.user_id}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[1], expandedView),
                                                whiteSpace: expandedView ? 'normal' : 'nowrap',
                                                minWidth: columnConfigs[1].minWidth
                                            }}>
                                                <Chip
                                                    label={getOtpTypeDisplay(otp.otp_type)}
                                                    size="small"
                                                    variant="filled"
                                                    sx={{
                                                        backgroundColor: componentColors.chip.defaultBackground,
                                                        color: componentColors.chip.defaultColor,
                                                        height: 24,
                                                        fontWeight: 'medium'
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[2], expandedView),
                                                whiteSpace: 'nowrap',
                                                minWidth: columnConfigs[2].minWidth
                                            }} align="center">
                                                <Chip
                                                    label={getStatusDisplay(otp).label}
                                                    color={getStatusDisplay(otp).color}
                                                    size="small"
                                                    icon={getStatusDisplay(otp).icon}
                                                    sx={{
                                                        height: 24,
                                                        fontWeight: 'medium'
                                                    }} />
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[3], expandedView),
                                                whiteSpace: 'nowrap',
                                                minWidth: columnConfigs[3].minWidth
                                            }} align="center">
                                                <Typography sx={responsiveTypographyTokens.tableCell}>
                                                    {otp.attempts || 0}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[4], expandedView),
                                                whiteSpace: 'nowrap',
                                                minWidth: columnConfigs[4].minWidth
                                            }}>
                                                <Typography sx={responsiveTypographyTokens.tableCell}>
                                                    {columnConfigs[4].format?.(otp.created_at || '')}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[5], expandedView),
                                                whiteSpace: 'nowrap',
                                                minWidth: columnConfigs[5].minWidth
                                            }}>
                                                <Box>
                                                    <Typography sx={responsiveTypographyTokens.tableCell}>
                                                        {columnConfigs[5].format?.(otp.expires_at || '')}
                                                    </Typography>
                                                    <Typography sx={{
                                                        color: 'text.secondary',
                                                        fontStyle: 'italic'
                                                    }}>
                                                        {getTimeRemaining(otp.expires_at)}
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[6], expandedView),
                                                position: 'sticky',
                                                right: 0,
                                                backgroundColor: theme.palette.background.paper,
                                                zIndex: 2,
                                                borderLeft: '1px solid',
                                                borderColor: 'divider',
                                                minWidth: columnConfigs[6].minWidth,
                                                width: columnConfigs[6].minWidth,
                                                whiteSpace: 'nowrap',
                                                paddingLeft: 1,
                                                paddingRight: 2
                                            }} align="center">
                                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                                    <Tooltip title="Vô hiệu hóa OTP">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleDeleteOtp(otp)}
                                                            color="error"
                                                            sx={{
                                                                minWidth: { xs: 32, sm: 'auto' },
                                                                width: { xs: 32, sm: 'auto' },
                                                                height: { xs: 32, sm: 'auto' },
                                                                padding: { xs: 0.5, sm: 1 }
                                                            }}                                                        >
                                                            <InvalidIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </TableCell>
                                        </TableRow>))}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {/* Pagination */}
                        <TablePagination
                            rowsPerPageOptions={[5, 10, 25, 50, 100, { value: 99999, label: 'Tất cả' }]}
                            component="div"
                            count={displayTotalCount}
                            rowsPerPage={rowsPerPage}
                            page={page}
                            onPageChange={handleChangePage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                            labelRowsPerPage="Số dòng mỗi trang:"
                            labelDisplayedRows={({ from, to, count }) => `${from}-${to} của ${count !== -1 ? count : `hơn ${to}`}`}
                        />
                    </>
                )}
            </Paper>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={handleCancelDelete}
                aria-labelledby="delete-dialog-title"
                aria-describedby="delete-dialog-description"
            >                <DialogTitle id="delete-dialog-title">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <InvalidIcon color="warning" />
                        Vô hiệu hóa OTP
                    </Box>
                </DialogTitle>                <DialogContent>
                    <DialogContentText id="delete-dialog-description">
                        Bạn có chắc chắn muốn vô hiệu hóa OTP này không?
                    </DialogContentText>
                    {otpToDelete && (
                        <Box sx={{ mt: 2, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
                            <Typography variant="body2">
                                <strong>Người dùng:</strong> {userEmails.get(otpToDelete.user_id) || otpToDelete.user_email || otpToDelete.user_id}
                            </Typography>
                            <Typography variant="body2">
                                <strong>Loại:</strong> {getOtpTypeDisplay(otpToDelete.otp_type)}
                            </Typography>
                            <Typography variant="body2">
                                <strong>Trạng thái:</strong> {getStatusDisplay(otpToDelete).label}
                            </Typography>
                        </Box>
                    )}
                    <Typography variant="body2" sx={{ mt: 2, color: 'warning.main' }}>
                        Hành động này không thể hoàn tác.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelDelete} disabled={deleting}>
                        Hủy
                    </Button>
                    <Button
                        onClick={handleConfirmDelete}
                        color="error"
                        variant="contained"
                        disabled={deleting}
                        startIcon={deleting ? <CircularProgress size={16} /> : <InvalidIcon />}
                    >
                        {deleting ? 'Đang vô hiệu hóa...' : 'Vô hiệu hóa'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default OtpsPage;