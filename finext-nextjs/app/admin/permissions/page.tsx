// finext-nextjs/app/admin/permissions/page.tsx
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
    Gavel as PermissionIcon,
    Add as AddIcon,
    EditSquare as EditIcon,
    Delete as DeleteIcon,
    UnfoldMore as ExpandIcon,
    UnfoldLess as CollapseIcon
} from '@mui/icons-material';
import { format as formatDate, parseISO } from 'date-fns';
import { colorTokens, responsiveTypographyTokens } from 'theme/tokens';
import SortableTableHead from '../components/SortableTableHead';
import {
    SortConfig,
    ColumnConfig,
    sortData,
    getNextSortDirection,
    getResponsiveDisplayStyle
} from '../components/TableSortUtils';
import PermissionSearch from './components/PermissionSearch';
import CreatePermissionModal from './components/CreatePermissionModal';
import EditPermissionModal from './components/EditPermissionModal';

// Interface matching PermissionPublic from backend
export interface PermissionSystemPublic {
    id: string;
    name: string;
    description?: string | null;
    roles: string[];
    category: string;
    created_at: string;
    updated_at: string;
}

interface PaginatedPermissionsResponse {
    items: PermissionSystemPublic[];
    total: number;
}

const PermissionsPage: React.FC = () => {
    const theme = useTheme();
    const componentColors = theme.palette.mode === 'light'
        ? colorTokens.lightComponentColors
        : colorTokens.darkComponentColors;

    const [permissions, setPermissions] = useState<PermissionSystemPublic[]>([]);
    const [filteredPermissions, setFilteredPermissions] = useState<PermissionSystemPublic[]>([]);
    const [isFiltering, setIsFiltering] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);    // View and sorting state
    const [expandedView, setExpandedView] = useState(false);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

    // Modal states
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedPermission, setSelectedPermission] = useState<PermissionSystemPublic | null>(null);

    // Column configuration for sortable table
    const columnConfigs: ColumnConfig[] = useMemo(() => [
        {
            id: 'name',
            label: 'Tên Permission',
            sortable: true,
            sortType: 'string',
            accessor: (permission: PermissionSystemPublic) => permission.name,
            minWidth: expandedView ? 200 : 200,
        },
        {
            id: 'description',
            label: 'Mô tả',
            sortable: true,
            sortType: 'string',
            accessor: (permission: PermissionSystemPublic) => permission.description || '',
            minWidth: expandedView ? 300 : 250,
            responsive: expandedView ? undefined : { xs: 'none', sm: 'none' }
        },
        {
            id: 'category',
            label: 'Danh mục',
            sortable: true,
            sortType: 'string',
            accessor: (permission: PermissionSystemPublic) => permission.category,
            minWidth: expandedView ? 160 : 150,
            responsive: expandedView ? undefined : { xs: 'none', sm: 'none' }
        },
        {
            id: 'roles',
            label: 'Vai trò',
            sortable: true,
            sortType: 'string',
            accessor: (permission: PermissionSystemPublic) => permission.roles.join(', '),
            minWidth: expandedView ? 250 : 220,
            responsive: expandedView ? undefined : { xs: 'none', sm: 'none', md: 'none' }
        },
        {
            id: 'created_at',
            label: 'Ngày tạo',
            sortable: true,
            sortType: 'date',
            accessor: (permission: PermissionSystemPublic) => permission.created_at || '',
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
            id: 'updated_at',
            label: 'Ngày cập nhật',
            sortable: true,
            sortType: 'date',
            accessor: (permission: PermissionSystemPublic) => permission.updated_at || '',
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
    ], [expandedView]); const fetchPermissions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let url = `/api/v1/permissions/admin/definitions?skip=${page * rowsPerPage}&limit=${rowsPerPage}`;

            if (sortConfig && sortConfig.key && sortConfig.direction) {
                url += `&sort_by=${sortConfig.key}&sort_order=${sortConfig.direction}`;
            }

            const response = await apiClient<PaginatedPermissionsResponse | PermissionSystemPublic[]>({
                url: url,
                method: 'GET',
            }); if (response.status === 200 && response.data) {
                if ('items' in response.data && Array.isArray(response.data.items) && typeof response.data.total === 'number') {
                    console.log('Permissions data:', response.data.items); // Debug log
                    setPermissions(response.data.items);
                    setTotalCount(response.data.total);
                } else if (Array.isArray(response.data)) {
                    console.log('Permissions data (array):', response.data); // Debug log
                    console.warn("Backend for permissions did not return total count. Pagination might be inaccurate.");
                    setPermissions(response.data as PermissionSystemPublic[]);
                    const currentDataLength = (response.data as PermissionSystemPublic[]).length;
                    if (page === 0) {
                        setTotalCount(currentDataLength < rowsPerPage ? currentDataLength : currentDataLength + (currentDataLength === rowsPerPage ? rowsPerPage : 0));
                    } else if (currentDataLength < rowsPerPage) {
                        setTotalCount(page * rowsPerPage + currentDataLength);
                    } else {
                        setTotalCount(page * rowsPerPage + currentDataLength + rowsPerPage);
                    }
                } else {
                    throw new Error("Unexpected data structure from API for permissions.");
                }
            } else {
                setError(response.message || 'Failed to load permissions. Ensure the admin endpoint exists and you have access.');
                setPermissions([]);
                setTotalCount(0);
            }
        } catch (err: any) {
            setError(err.message || 'Connection error or unauthorized access.');
            setPermissions([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, sortConfig]); // Added sortConfig dependency

    useEffect(() => {
        fetchPermissions();
    }, [fetchPermissions]);    // Update filtered permissions when permissions change and not actively filtering
    useEffect(() => {
        if (!isFiltering) {
            setFilteredPermissions(permissions);
        }
    }, [permissions, isFiltering]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleFilteredPermissions = (filtered: PermissionSystemPublic[], isActivelyFiltering: boolean) => {
        setFilteredPermissions(filtered);
        setIsFiltering(isActivelyFiltering);
        if (isActivelyFiltering !== isFiltering) {
            setPage(0);
        }
    };

    // Handle sorting // Added section
    const handleSort = (columnKey: string) => {
        const column = columnConfigs.find(col => col.id === columnKey);
        if (!column || !column.sortable) return;

        const newDirection = sortConfig?.key === columnKey
            ? getNextSortDirection(sortConfig.direction)
            : 'asc';

        setSortConfig(newDirection ? { key: columnKey, direction: newDirection } : null);
        setPage(0);
    };

    // Compute sorted data // Added section
    const sortedPermissions = useMemo(() => {
        const dataToSort = isFiltering ? filteredPermissions : permissions;

        if (!sortConfig || !sortConfig.direction) {
            return dataToSort;
        }

        const column = columnConfigs.find(col => col.id === sortConfig.key);
        if (!column) return dataToSort;

        return sortData(dataToSort, sortConfig, column);
    }, [permissions, filteredPermissions, isFiltering, sortConfig, columnConfigs]);

    // Calculate paginated permissions // Added section
    const paginatedPermissions = useMemo(() => {
        if (isFiltering || sortConfig) {
            if (rowsPerPage === 99999) { // Option to show all
                return sortedPermissions;
            }
            const startIndex = page * rowsPerPage;
            const endIndex = startIndex + rowsPerPage;
            return sortedPermissions.slice(startIndex, endIndex);
        } else {
            return permissions; // Already paginated by server
        }
    }, [permissions, sortedPermissions, isFiltering, sortConfig, page, rowsPerPage]);

    // Calculate total count for pagination // Added
    const displayTotalCount = (isFiltering || sortConfig) ? sortedPermissions.length : totalCount;    // Action handlers
    const handleAddPermission = () => {
        setCreateModalOpen(true);
    };

    const handleEditPermission = (permissionId: string) => {
        const permission = permissions.find(p => p.id === permissionId);
        if (permission) {
            setSelectedPermission(permission);
            setEditModalOpen(true);
        }
    }; const handleDeletePermission = (permissionId: string) => {
        const permission = permissions.find(p => p.id === permissionId);
        if (permission) {
            if (!canDeletePermission(permission)) {
                return; // Không làm gì nếu không thể xóa
            }
            setSelectedPermission(permission);
            setDeleteDialogOpen(true);
        }
    };

    const handleConfirmDelete = async () => {
        if (!selectedPermission) return; try {
            const response = await apiClient({
                url: `/api/v1/permissions/${selectedPermission.id}`,
                method: 'DELETE'
            });

            if (response.status >= 200 && response.status < 300) {
                setDeleteDialogOpen(false);
                setSelectedPermission(null);
                fetchPermissions(); // Refresh the list
            } else {
                setError('Không thể xóa permission');
            }
        } catch (err) {
            console.error('Error deleting permission:', err);
            setError('Đã xảy ra lỗi khi xóa permission');
        }
    };

    const handlePermissionCreated = () => {
        fetchPermissions(); // Refresh the list
    }; const handlePermissionUpdated = () => {
        fetchPermissions(); // Refresh the list
    };    // Helper functions for permission management
    const canDeletePermission = (permission: PermissionSystemPublic): boolean => {
        // Không thể xóa permission nếu đang được sử dụng bởi roles
        if (permission.roles && permission.roles.length > 0) {
            return false;
        }
        // System permissions typically shouldn't be deleted
        return !permission.name.includes('admin_only') && !permission.name.includes('system');
    };

    const getDeleteTooltipMessage = (permission: PermissionSystemPublic): string => {
        if (permission.roles && permission.roles.length > 0) {
            return `Không thể xóa permission này vì đang được sử dụng bởi ${permission.roles.length} vai trò: ${permission.roles.join(', ')}`;
        }
        if (!canDeletePermission(permission)) {
            return "Không thể xóa permission hệ thống";
        }
        return "Xóa permission";
    };
    return (
        <Box sx={{ maxWidth: '100%', overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PermissionIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h3" component="h1">
                        Quản lý Permissions
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
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleAddPermission}
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
                            Thêm Permission
                        </Box>
                    </Button>
                </Box>
            </Box>

            {/* Search/Filter Component */}
            <PermissionSearch
                permissions={permissions}
                onFilteredPermissions={handleFilteredPermissions}
                loading={loading}
            />

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                {loading && permissions.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3, minHeight: 300 }}>
                        <CircularProgress />
                    </Box>) : (
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
                                />
                                <TableBody>
                                    {Array.isArray(paginatedPermissions) && paginatedPermissions.map((permission) => (<TableRow hover key={permission.id || permission.name}>
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
                                                {permission.name}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{
                                            ...getResponsiveDisplayStyle(columnConfigs[1], expandedView),
                                            whiteSpace: expandedView ? 'normal' : 'nowrap',
                                            minWidth: columnConfigs[1].minWidth
                                        }}>
                                            <Tooltip title={permission.description || 'Không có mô tả'}>
                                                <Typography sx={{
                                                    ...responsiveTypographyTokens.tableCell,
                                                    maxWidth: expandedView ? 'none' : 300,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: expandedView ? 'normal' : 'nowrap'
                                                }}>
                                                    {permission.description || 'N/A'}
                                                </Typography>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell sx={{
                                            ...getResponsiveDisplayStyle(columnConfigs[2], expandedView),
                                            whiteSpace: 'nowrap',
                                            minWidth: columnConfigs[2].minWidth
                                        }}>                                            <Chip
                                                label={permission.category}
                                                size="small"
                                                variant="filled"
                                                sx={{
                                                    backgroundColor: componentColors.chip.defaultBackground,
                                                    color: componentColors.chip.defaultColor,
                                                    fontSize: '0.75rem',
                                                    height: 24,
                                                    textTransform: 'capitalize',
                                                    fontWeight: 'medium'
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{
                                            ...getResponsiveDisplayStyle(columnConfigs[3], expandedView),
                                            whiteSpace: 'nowrap',
                                            minWidth: columnConfigs[3].minWidth
                                        }}>
                                            <Box sx={{
                                                display: 'flex',
                                                flexWrap: 'nowrap',
                                                gap: 0.5,
                                                overflowX: expandedView ? 'visible' : 'auto',
                                                maxWidth: expandedView ? 'none' : columnConfigs[3].minWidth,
                                                py: 0.5, // Add some vertical padding for scrollbar
                                                '&::-webkit-scrollbar': {
                                                    height: 4,
                                                },
                                                '&::-webkit-scrollbar-track': {
                                                    backgroundColor: 'transparent',
                                                },
                                                '&::-webkit-scrollbar-thumb': {
                                                    backgroundColor: theme.palette.mode === 'dark'
                                                        ? 'rgba(255,255,255,0.2)'
                                                        : 'rgba(0,0,0,0.2)',
                                                    borderRadius: 2,
                                                }
                                            }}>
                                                {permission.roles.map((role, index) => (
                                                    <Chip
                                                        key={index}
                                                        label={role}
                                                        size="small"
                                                        variant="filled"
                                                        sx={{
                                                            backgroundColor: componentColors.chip.successBackground,
                                                            color: componentColors.chip.successColor,
                                                            fontSize: '0.7rem',
                                                            height: 20,
                                                            textTransform: 'capitalize',
                                                            fontWeight: 'medium',
                                                            flexShrink: 0
                                                        }}
                                                    />
                                                ))}
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{
                                            ...getResponsiveDisplayStyle(columnConfigs[4], expandedView),
                                            whiteSpace: expandedView ? 'nowrap' : 'normal',
                                            minWidth: columnConfigs[4].minWidth
                                        }}>
                                            <Typography sx={responsiveTypographyTokens.tableCell}>
                                                {columnConfigs[4].format?.(permission.created_at || '')}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{
                                            ...getResponsiveDisplayStyle(columnConfigs[5], expandedView),
                                            whiteSpace: expandedView ? 'nowrap' : 'normal',
                                            minWidth: columnConfigs[5].minWidth
                                        }}>
                                            <Typography sx={responsiveTypographyTokens.tableCell}>
                                                {columnConfigs[5].format?.(permission.updated_at || '')}
                                            </Typography>
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[6], expandedView),
                                                position: 'sticky',
                                                right: -1,
                                                backgroundColor: 'background.paper',
                                                zIndex: 2,
                                                borderLeft: '1px solid',
                                                borderColor: 'divider',
                                                minWidth: columnConfigs[6].minWidth,
                                                width: columnConfigs[6].minWidth,
                                                whiteSpace: 'nowrap',
                                                paddingLeft: 1,
                                                paddingRight: 2
                                            }}
                                            align="center"
                                        >
                                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                                <Tooltip title="Chỉnh sửa permission">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleEditPermission(permission.id)}
                                                        color="primary"
                                                        sx={{
                                                            minWidth: { xs: 32, sm: 'auto' },
                                                            width: { xs: 32, sm: 'auto' },
                                                            height: { xs: 32, sm: 'auto' }
                                                        }}
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>

                                                <Tooltip title={getDeleteTooltipMessage(permission)}>
                                                    <span>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleDeletePermission(permission.id)}
                                                            color="error"
                                                            disabled={!canDeletePermission(permission)}
                                                            sx={{
                                                                minWidth: { xs: 32, sm: 'auto' },
                                                                width: { xs: 32, sm: 'auto' },
                                                                height: { xs: 32, sm: 'auto' },
                                                                opacity: canDeletePermission(permission) ? 1 : 0.5
                                                            }}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                    ))}
                                    {Array.isArray(paginatedPermissions) && paginatedPermissions.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={columnConfigs.length} align="center">
                                                <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                                                    {isFiltering
                                                        ? "Không tìm thấy permission nào phù hợp với tiêu chí tìm kiếm."
                                                        : "Chưa có permission nào."
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
                    </>)}
            </Paper>

            {/* Create Permission Modal */}
            <CreatePermissionModal
                open={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onPermissionCreated={handlePermissionCreated}
            />

            {/* Edit Permission Modal */}
            <EditPermissionModal
                open={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                onPermissionUpdated={handlePermissionUpdated}
                permission={selectedPermission}
            />

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Xác nhận xóa Permission
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Bạn có chắc chắn muốn xóa permission "{selectedPermission?.name}"?
                        <br /><br />
                        <strong>Cảnh báo:</strong> Hành động này không thể hoàn tác và có thể ảnh hưởng đến
                        các tính năng đang sử dụng permission này.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ p: 3, gap: 1 }}>
                    <Button
                        onClick={() => setDeleteDialogOpen(false)}
                        variant="outlined"
                    >
                        Hủy
                    </Button>
                    <Button
                        onClick={handleConfirmDelete}
                        variant="contained"
                        color="error"
                    >
                        Xóa Permission
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default PermissionsPage;