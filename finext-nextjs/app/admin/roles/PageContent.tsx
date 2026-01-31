// finext-nextjs/app/admin/roles/page.tsx
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
    Security as RolesIcon,
    Add as AddIcon,
    EditSquare as EditIcon,
    Delete as DeleteIcon,
    UnfoldMore as ExpandIcon,
    UnfoldLess as CollapseIcon,
    AddCircle as ActivateIcon,
    DoDisturbOn as DeactivateIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { getResponsiveFontSize, borderRadiusTop, fontWeight } from 'theme/tokens';
import SortableTableHead from '../components/SortableTableHead';
import {
    SortConfig,
    ColumnConfig,
    sortData,
    getNextSortDirection,
    getResponsiveDisplayStyle
} from '../components/TableSortUtils';
import RoleSearch from './components/RoleSearch';
import CreateRoleModal from './components/CreateRoleModal';
import EditRoleModal from './components/EditRoleModal';

interface RolePublic {
    id: string;
    name: string;
    description?: string | null;
    permission_ids: string[];
    created_at: string;
    updated_at: string;
}

interface PaginatedRolesResponse {
    items: RolePublic[];
    total: number;
}

export default function RolesPage() {
    const theme = useTheme();


    const [roles, setRoles] = useState<RolePublic[]>([]);
    const [filteredRoles, setFilteredRoles] = useState<RolePublic[]>([]);
    const [isFiltering, setIsFiltering] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);    // View and sorting state
    const [expandedView, setExpandedView] = useState(false);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

    // Modal state
    const [openCreateModal, setOpenCreateModal] = useState(false);
    const [openEditModal, setOpenEditModal] = useState(false);
    const [selectedRole, setSelectedRole] = useState<RolePublic | null>(null);

    // Delete Dialog state
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [roleToDelete, setRoleToDelete] = useState<RolePublic | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Column configuration for sortable table
    const columnConfigs: ColumnConfig[] = useMemo(() => [
        {
            id: 'name',
            label: 'Tên vai trò',
            sortable: true,
            sortType: 'string',
            accessor: (role: RolePublic) => role.name,
            minWidth: expandedView ? 'auto' : 150,
        },
        {
            id: 'description',
            label: 'Mô tả',
            sortable: true,
            sortType: 'string',
            accessor: (role: RolePublic) => role.description || '',
            minWidth: expandedView ? 'auto' : 200,
            responsive: { xs: 'none', sm: 'none', md: 'none' }
        },
        {
            id: 'permission_ids',
            label: 'Số quyền',
            sortable: true,
            sortType: 'number',
            accessor: (role: RolePublic) => role.permission_ids.length,
            minWidth: expandedView ? 'auto' : 100,
            format: (value: number) => `${value} quyền`
        },
        {
            id: 'created_at',
            label: 'Ngày tạo',
            sortable: true,
            sortType: 'date',
            accessor: (role: RolePublic) => role.created_at || '',
            minWidth: expandedView ? 'auto' : 140,
            responsive: { xs: 'none', sm: 'none', md: 'none', lg: 'none' },
            format: (value: string) => {
                if (!value) return 'N/A';
                try {
                    const utcDate = parseISO(value);
                    const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
                    return format(gmt7Date, 'dd/MM/yyyy HH:mm');
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
            accessor: (role: RolePublic) => role.updated_at || '',
            minWidth: expandedView ? 'auto' : 140,
            responsive: { xs: 'none', sm: 'none', md: 'none', lg: 'none' },
            format: (value: string) => {
                if (!value) return 'N/A';
                try {
                    const utcDate = parseISO(value);
                    const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
                    return format(gmt7Date, 'dd/MM/yyyy HH:mm');
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
            minWidth: expandedView ? 'auto' : 120,
            align: 'center' as const
        }
    ], [expandedView]); const fetchRoles = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const queryParams: Record<string, any> = {
                skip: page * rowsPerPage,
                limit: rowsPerPage,
            };

            // Add sort parameters if sortConfig is defined
            if (sortConfig && sortConfig.key && sortConfig.direction) {
                queryParams.sort_by = sortConfig.key;
                queryParams.sort_order = sortConfig.direction;
            }

            const response = await apiClient<PaginatedRolesResponse | RolePublic[]>({
                url: `/api/v1/roles/`,
                method: 'GET',
                queryParams,
            });

            if (response.status === 200 && response.data) {
                if ('items' in response.data && Array.isArray(response.data.items) && typeof response.data.total === 'number') {
                    setRoles(response.data.items);
                    setTotalCount(response.data.total);
                } else if (Array.isArray(response.data)) {
                    console.warn("Backend for roles did not return total count. Pagination might be inaccurate.");
                    setRoles(response.data as RolePublic[]);
                    const currentDataLength = (response.data as RolePublic[]).length;
                    if (page === 0) {
                        setTotalCount(currentDataLength < rowsPerPage ? currentDataLength : currentDataLength + (currentDataLength === rowsPerPage ? rowsPerPage : 0));
                    } else if (currentDataLength < rowsPerPage) {
                        setTotalCount(page * rowsPerPage + currentDataLength);
                    } else {
                        setTotalCount(page * rowsPerPage + currentDataLength + rowsPerPage);
                    }
                } else {
                    throw new Error("Unexpected data structure from API for roles.");
                }
            } else {
                setError(response.message || 'Failed to load roles.');
                setRoles([]);
                setTotalCount(0);
            }
        } catch (err: any) {
            setError(err.message || 'Connection error or unauthorized access.');
            setRoles([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, sortConfig]);

    useEffect(() => {
        fetchRoles();
    }, [fetchRoles]);

    // Update filtered roles when roles change and not actively filtering
    useEffect(() => {
        if (!isFiltering) {
            setFilteredRoles(roles);
        }
    }, [roles, isFiltering]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    }; const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleFilteredRoles = (filtered: RolePublic[], isActivelyFiltering: boolean) => {
        setFilteredRoles(filtered);
        setIsFiltering(isActivelyFiltering);
        // Only reset page when actively switching between filtering states
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
        setPage(0); // Reset to first page when sorting
    };

    // Compute sorted data
    const sortedRoles = useMemo(() => {
        const dataToSort = isFiltering ? filteredRoles : roles;

        if (!sortConfig || !sortConfig.direction) {
            return dataToSort;
        }

        const column = columnConfigs.find(col => col.id === sortConfig.key);
        if (!column) return dataToSort;

        return sortData(dataToSort, sortConfig, column);
    }, [roles, filteredRoles, isFiltering, sortConfig, columnConfigs]);

    // Calculate paginated roles - use client-side pagination when sorting/filtering, server-side pagination otherwise
    const paginatedRoles = useMemo(() => {
        if (isFiltering || sortConfig) {
            // Client-side pagination for filtered/sorted results
            if (rowsPerPage === 99999) {
                // Show all results
                return sortedRoles;
            }
            const startIndex = page * rowsPerPage;
            const endIndex = startIndex + rowsPerPage;
            return sortedRoles.slice(startIndex, endIndex);
        } else {
            // Server-side pagination - use roles directly as they are already paginated
            return roles;
        }
    }, [roles, sortedRoles, isFiltering, sortConfig, page, rowsPerPage]);

    // Calculate total count for pagination
    const displayTotalCount = (isFiltering || sortConfig) ? sortedRoles.length : totalCount;    // Delete handlers
    const handleOpenDeleteDialog = (role: RolePublic) => {
        setRoleToDelete(role);
        setOpenDeleteDialog(true);
    };

    const handleCloseDeleteDialog = () => {
        setRoleToDelete(null);
        setOpenDeleteDialog(false);
        setDeleteLoading(false);
    };

    const handleDeleteRole = async () => {
        if (!roleToDelete) return;

        setDeleteLoading(true);
        setError(null);

        try {
            const response = await apiClient({
                url: `/api/v1/roles/${roleToDelete.id}`,
                method: 'DELETE',
            });

            if (response.status === 200) {
                fetchRoles(); // Refresh list
                handleCloseDeleteDialog();
            } else {
                setError(response.message || 'Không thể xóa vai trò.');
            }
        } catch (delError: any) {
            setError(delError.message || 'Lỗi khi xóa vai trò. Vai trò có thể đang được sử dụng.');
            handleCloseDeleteDialog();
        } finally {
            setDeleteLoading(false);
        }
    }; const handleAddRole = () => {
        setOpenCreateModal(true);
    };

    const handleRoleCreated = () => {
        setOpenCreateModal(false);
        fetchRoles(); // Refresh the roles list
    };

    const handleEditRole = (roleId: string) => {
        const role = roles.find(r => r.id === roleId);
        if (role) {
            setSelectedRole(role);
            setOpenEditModal(true);
        }
    };

    const handleRoleUpdated = () => {
        setOpenEditModal(false);
        setSelectedRole(null);
        fetchRoles(); // Refresh the roles list
    }; return (
        <Box sx={{
            maxWidth: '100%',
            overflow: 'hidden'
        }}>
            {/* Breadcrumb */}
            <AdminBreadcrumb />

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <RolesIcon sx={{ mr: 1, fontSize: 24 }} />
                    <Typography variant="h3" component="h1">
                        Quản lý Vai trò
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
                        onClick={handleAddRole}
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
                            Tạo Vai trò
                        </Box>
                    </Button>                </Box>
            </Box>

            {/* Search/Filter Component */}
            <RoleSearch
                roles={roles}
                onFilteredRoles={handleFilteredRoles}
                loading={loading}
            />

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                {loading && roles.length === 0 ? (
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
                                    {Array.isArray(paginatedRoles) && paginatedRoles.map((role) => (
                                        <TableRow
                                            hover
                                            key={role.id}
                                            sx={{
                                                '&:hover': {
                                                    backgroundColor: theme.palette.component.tableRow.hover
                                                }
                                            }}
                                        >
                                            {/* Role Name */}
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[0], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[0].minWidth,
                                                width: expandedView ? 'auto' : columnConfigs[0].minWidth
                                            }}>
                                                <Typography sx={{
                                                    fontSize: getResponsiveFontSize('sm'),
                                                    fontWeight: fontWeight.medium
                                                }}>
                                                    {role.name}
                                                </Typography>
                                            </TableCell>

                                            {/* Description */}
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[1], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[1].minWidth
                                            }}>
                                                <Tooltip title={role.description || 'Không có mô tả'}>
                                                    <Typography sx={{
                                                        fontSize: getResponsiveFontSize('sm'),
                                                        maxWidth: 300,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {role.description || 'N/A'}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>

                                            {/* Permissions Count */}
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[2], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[2].minWidth
                                            }}>
                                                <Chip
                                                    label={columnConfigs[2].format?.(role.permission_ids?.length || 0)}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ fontWeight: fontWeight.medium }}
                                                />
                                            </TableCell>

                                            {/* Created At */}
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[3], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[3].minWidth
                                            }}>
                                                <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                                                    {columnConfigs[3].format?.(role.created_at || '')}
                                                </Typography>
                                            </TableCell>

                                            {/* Updated At */}
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[4], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[4].minWidth
                                            }}>
                                                <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                                                    {columnConfigs[4].format?.(role.updated_at || '')}
                                                </Typography>
                                            </TableCell>

                                            {/* Actions */}
                                            <TableCell
                                                sx={{
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
                                                        backgroundColor: theme.palette.component.tableRow.hover
                                                    }
                                                }}
                                                align="center"
                                            >
                                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                                    <Tooltip title="Chỉnh sửa vai trò">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleEditRole(role.id)}
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

                                                    <Tooltip title="Xóa vai trò">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleOpenDeleteDialog(role)}
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
                                    {Array.isArray(paginatedRoles) && paginatedRoles.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={columnConfigs.length} align="center">
                                                <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                                                    {isFiltering
                                                        ? "Không tìm thấy vai trò nào phù hợp với tiêu chí tìm kiếm."
                                                        : "Chưa có vai trò nào."
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
                                    fontSize: getResponsiveFontSize('xxs'),
                                    display: { xs: 'none', sm: 'block' }
                                },
                                '& .MuiTablePagination-displayedRows': {
                                    fontSize: getResponsiveFontSize('xxs'),
                                    margin: 0
                                }
                            }}
                        />
                    </>
                )}
            </Paper>            {/* Delete Confirmation Dialog */}
            <Dialog
                open={openDeleteDialog}
                onClose={!deleteLoading ? handleCloseDeleteDialog : undefined}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 2 }
                }}
            >
                <DialogTitle sx={{ color: 'error.main', fontWeight: fontWeight.bold }}>
                    ⚠️ Xác nhận xóa vai trò
                </DialogTitle>
                <DialogContent>
                    {roleToDelete && (
                        <Box sx={{
                            p: 2,
                            bgcolor: theme.palette.component.modal.noteBackground,
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: theme.palette.component.modal.noteBorder,
                            mb: 2
                        }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                <Box>
                                    <Typography variant="body2" color="text.secondary" fontWeight="bold">
                                        Tên vai trò: {roleToDelete.name}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="body2" color="text.secondary">
                                        Mô tả: {roleToDelete.description || 'Không có mô tả'}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="body2" color="text.secondary">
                                        Số quyền: {roleToDelete.permission_ids?.length || 0}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>
                    )}

                    <Box sx={{
                        p: 2,
                        bgcolor: theme.palette.component.modal.noteBackground,
                        borderRadius: 1,
                        border: `1px solid ${theme.palette.component.modal.noteBorder}`,
                        mb: 2,
                        position: 'relative',
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '3px',
                            bgcolor: 'error.main',
                            borderRadius: borderRadiusTop('sm')
                        }
                    }}>
                        <Typography
                            variant="body2"
                            fontWeight="bold"
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                color: 'error.main',
                                mb: 1
                            }}
                        >
                            ⚠️ Cảnh báo quan trọng:
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText, mb: 1 }}>
                            • Hành động này không thể hoàn tác
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText, mb: 1 }}>
                            • Vai trò sẽ bị xóa vĩnh viễn khỏi hệ thống
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText, mb: 1 }}>
                            • Người dùng đang có vai trò này có thể bị ảnh hưởng
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                            • Vai trò được bảo vệ (admin, user, broker) không thể xóa
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 1 }}>
                    <Button
                        onClick={handleCloseDeleteDialog}
                        disabled={deleteLoading}
                        variant="outlined"
                    >
                        Hủy
                    </Button>
                    <Button
                        onClick={handleDeleteRole}
                        color="error"
                        variant="contained"
                        disabled={deleteLoading}
                        startIcon={deleteLoading ? <CircularProgress size={20} /> : null}
                    >
                        {deleteLoading ? 'Đang xóa...' : 'Xóa vai trò'}
                    </Button>                </DialogActions>
            </Dialog>

            {/* Create Role Modal */}
            <CreateRoleModal
                open={openCreateModal}
                onClose={() => setOpenCreateModal(false)}
                onRoleCreated={handleRoleCreated}
            />

            {/* Edit Role Modal */}
            {selectedRole && (
                <EditRoleModal
                    open={openEditModal}
                    onClose={() => setOpenEditModal(false)}
                    role={selectedRole}
                    onRoleUpdated={handleRoleUpdated}
                />
            )}
        </Box>
    );
}