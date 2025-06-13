// finext-nextjs/app/admin/permissions/page.tsx
'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiClient } from 'services/apiClient';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Alert, CircularProgress, TablePagination, Tooltip
} from '@mui/material';
import { Gavel as PermissionIcon } from '@mui/icons-material';
import { format as formatDate, parseISO } from 'date-fns';
import { responsiveTypographyTokens } from 'theme/tokens';
import SortableTableHead from '../components/SortableTableHead';
import {
    SortConfig,
    ColumnConfig,
    sortData,
    getNextSortDirection,
    getResponsiveDisplayStyle
} from '../components/TableSortUtils';
import PermissionSearch from './components/PermissionSearch';

// Interface matching PermissionInDB from backend
export interface PermissionSystemPublic {
    id: string;
    name: string;
    description?: string | null;
    created_at: string;
    updated_at: string;
}

interface PaginatedPermissionsResponse {
    items: PermissionSystemPublic[];
    total: number;
}

const PermissionsPage: React.FC = () => {
    const [permissions, setPermissions] = useState<PermissionSystemPublic[]>([]);
    const [filteredPermissions, setFilteredPermissions] = useState<PermissionSystemPublic[]>([]);
    const [isFiltering, setIsFiltering] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    // Sorting state
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

    // Column configuration for sortable table
    const columnConfigs: ColumnConfig[] = useMemo(() => [
        {
            id: 'name',
            label: 'Tên Permission',
            sortable: true,
            sortType: 'string',
            accessor: (permission: PermissionSystemPublic) => permission.name,
            minWidth: 200,
        },
        {
            id: 'description',
            label: 'Mô tả',
            sortable: true,
            sortType: 'string',
            accessor: (permission: PermissionSystemPublic) => permission.description || '',
            minWidth: 300,
            responsive: { xs: 'none', sm: 'none' }
        },
        {
            id: 'created_at',
            label: 'Ngày tạo',
            sortable: true,
            sortType: 'date',
            accessor: (permission: PermissionSystemPublic) => permission.created_at || '',
            minWidth: 140,
            responsive: { xs: 'none', sm: 'none', md: 'none' },
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
    ], []); const fetchPermissions = useCallback(async () => {
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
    const displayTotalCount = (isFiltering || sortConfig) ? sortedPermissions.length : totalCount;

    // Permissions are usually system-defined, UI for Add/Edit/Delete might not be common
    // unless you allow dynamic permission creation through admin panel.
    const handleAddPermission = () => console.log("Add permission (not implemented - usually system defined)");


    return (
        <Box sx={{ maxWidth: '100%', overflow: 'hidden' }}>            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PermissionIcon sx={{ mr: 1, fontSize: '24px' }} />
                <Typography variant="h3" component="h1">
                    Quản lý Permissions
                </Typography>
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
                    </Box>
                ) : (
                    <>                        <TableContainer sx={{ overflowX: 'auto' }}>
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
                                {Array.isArray(paginatedPermissions) && paginatedPermissions.map((permission) => (
                                    <TableRow hover key={permission.id || permission.name}>
                                        <TableCell sx={{
                                            ...getResponsiveDisplayStyle(columnConfigs[0]),
                                            minWidth: columnConfigs[0].minWidth,
                                        }}>
                                            <Typography sx={{
                                                ...responsiveTypographyTokens.tableCell,
                                                fontWeight: 'medium'
                                            }}>
                                                {permission.name}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{
                                            ...getResponsiveDisplayStyle(columnConfigs[1]),
                                            minWidth: columnConfigs[1].minWidth
                                        }}>
                                            <Tooltip title={permission.description || ''}>
                                                <Typography sx={{
                                                    ...responsiveTypographyTokens.tableCell,
                                                    maxWidth: 300,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {permission.description || 'N/A'}
                                                </Typography>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell sx={{
                                            ...getResponsiveDisplayStyle(columnConfigs[2]),
                                            minWidth: columnConfigs[2].minWidth
                                        }}>
                                            <Typography sx={responsiveTypographyTokens.tableCell}>
                                                {columnConfigs[2].format?.(permission.created_at || '')}
                                            </Typography>
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
                    </>
                )}
            </Paper>
        </Box>
    );
};

export default PermissionsPage;