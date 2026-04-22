// finext-nextjs/app/admin/licenses/page.tsx
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
    VerifiedUser as LicenseIcon,
    Add as AddIcon,
    EditSquare as EditIcon,
    UnfoldMore as ExpandIcon,
    UnfoldLess as CollapseIcon,
    AddCircle as ActivateIcon,
    DoDisturbOn as DeactivateIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { getResponsiveFontSize, borderRadiusTop } from 'theme/tokens';
import SortableTableHead from '../components/SortableTableHead';
import {
    SortConfig,
    ColumnConfig,
    sortData,
    getNextSortDirection,
    getResponsiveDisplayStyle
} from '../components/TableSortUtils';
import LicenseSearch from './components/LicenseSearch';
import CreateLicenseModal from './components/CreateLicenseModal';
import EditLicenseModal from './components/EditLicenseModal';

interface LicensePublic {
    id: string;
    key: string;
    name: string;
    price: number;
    duration_days: number;
    feature_keys: string[];
    is_active: boolean;
    color?: string;
    created_at?: string;
    updated_at?: string;
}

interface PaginatedLicensesResponse {
    items: LicensePublic[];
    total: number;
}


export default function LicensesPage() {
    const theme = useTheme();


    const [licenses, setLicenses] = useState<LicensePublic[]>([]);
    const [filteredLicenses, setFilteredLicenses] = useState<LicensePublic[]>([]);
    const [isFiltering, setIsFiltering] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    // View and sorting state
    const [expandedView, setExpandedView] = useState(false);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

    // Modal state
    const [openCreateModal, setOpenCreateModal] = useState(false);
    const [openEditModal, setOpenEditModal] = useState(false);
    const [selectedLicense, setSelectedLicense] = useState<LicensePublic | null>(null);

    // Action dialogs state
    const [actionLicense, setActionLicense] = useState<LicensePublic | null>(null);
    const [openActivateDialog, setOpenActivateDialog] = useState(false);
    const [openDeactivateDialog, setOpenDeactivateDialog] = useState(false);    // Helper function to format duration days (simple format)
    const formatDurationDays = (days: number): string => {
        return `${days} ngày`;
    };

    // Column configuration for sortable table
    const columnConfigs: ColumnConfig[] = useMemo(() => [
        {
            id: 'key',
            label: 'License Key',
            sortable: true,
            sortType: 'string',
            accessor: (license: LicensePublic) => license.key,
            minWidth: expandedView ? 'auto' : 130,
        },
        {
            id: 'name',
            label: 'Tên gói',
            sortable: true,
            sortType: 'string',
            accessor: (license: LicensePublic) => license.name,
            minWidth: expandedView ? 'auto' : 200,
            responsive: { xs: 'none', sm: 'none', md: 'none' }
        },
        {
            id: 'price',
            label: 'Giá tiền',
            sortable: true,
            sortType: 'number',
            accessor: (license: LicensePublic) => license.price,
            minWidth: expandedView ? 'auto' : 120,
            responsive: { xs: 'none' },
            format: (value: number) => `${value.toLocaleString('vi-VN')} VNĐ`
        },
        {
            id: 'duration_days',
            label: 'Thời hạn',
            sortable: true,
            sortType: 'number',
            accessor: (license: LicensePublic) => license.duration_days,
            minWidth: expandedView ? 'auto' : 120,
            format: (value: number) => formatDurationDays(value)
        },
        {
            id: 'is_active',
            label: 'Trạng thái',
            sortable: true,
            sortType: 'boolean',
            accessor: (license: LicensePublic) => license.is_active,
            minWidth: expandedView ? 'auto' : 100,
            responsive: { xs: 'none', sm: 'none' },
        },
        {
            id: 'feature_keys',
            label: 'Tính năng',
            sortable: true,
            sortType: 'number',
            accessor: (license: LicensePublic) => license.feature_keys.length,
            minWidth: expandedView ? 'auto' : 100,
            responsive: { xs: 'none', sm: 'none', md: 'none' },
            format: (value: number) => `${value} tính năng`
        },
        {
            id: 'created_at',
            label: 'Ngày tạo',
            sortable: true,
            sortType: 'date',
            accessor: (license: LicensePublic) => license.created_at || '',
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
            accessor: (license: LicensePublic) => license.updated_at || '',
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
            minWidth: expandedView ? 'auto' : 60,
            align: 'center' as const
        }
    ], [expandedView]); const fetchLicenses = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const queryParams: Record<string, any> = {
                skip: page * rowsPerPage,
                limit: rowsPerPage,
                include_inactive: true, // Thêm tham số để lấy cả license không hoạt động
                show_all: true, // Thêm tham số backup để đảm bảo lấy tất cả
            };

            // Add sort parameters if sortConfig is defined
            if (sortConfig && sortConfig.key && sortConfig.direction) {
                queryParams.sort_by = sortConfig.key;
                queryParams.sort_order = sortConfig.direction;
            }

            const response = await apiClient<PaginatedLicensesResponse | LicensePublic[]>({
                url: `/api/v1/licenses/`,
                method: 'GET',
                queryParams,
            }); if (response.status === 200 && response.data) {
                if ('items' in response.data && Array.isArray(response.data.items) && typeof response.data.total === 'number') {
                    // Debug: Log để kiểm tra dữ liệu từ API
                    console.log('License data from API:', response.data.items[0]);
                    setLicenses(response.data.items);
                    setTotalCount(response.data.total);
                } else if (Array.isArray(response.data)) {
                    console.warn("Backend for licenses did not return total count. Pagination might be inaccurate.");
                    // Debug: Log để kiểm tra dữ liệu từ API
                    console.log('License data from API (array):', response.data[0]);
                    setLicenses(response.data as LicensePublic[]);
                    const currentDataLength = (response.data as LicensePublic[]).length;
                    if (page === 0) {
                        setTotalCount(currentDataLength < rowsPerPage ? currentDataLength : currentDataLength + (currentDataLength === rowsPerPage ? rowsPerPage : 0));
                    } else if (currentDataLength < rowsPerPage) {
                        setTotalCount(page * rowsPerPage + currentDataLength);
                    } else {
                        setTotalCount(page * rowsPerPage + currentDataLength + rowsPerPage);
                    }
                } else {
                    throw new Error("Unexpected data structure from API for licenses.");
                }
            } else {
                setError(response.message || 'Failed to load licenses.');
                setLicenses([]);
                setTotalCount(0);
            }
        } catch (err: any) {
            setError(err.message || 'Connection error or unauthorized access.');
            setLicenses([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, sortConfig]);

    useEffect(() => {
        fetchLicenses();
    }, [fetchLicenses]);

    // Update filtered licenses when licenses change and not actively filtering
    useEffect(() => {
        if (!isFiltering) {
            setFilteredLicenses(licenses);
        }
    }, [licenses, isFiltering]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleFilteredLicenses = (filtered: LicensePublic[], isActivelyFiltering: boolean) => {
        setFilteredLicenses(filtered);
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
    const sortedLicenses = useMemo(() => {
        const dataToSort = isFiltering ? filteredLicenses : licenses;

        if (!sortConfig || !sortConfig.direction) {
            return dataToSort;
        }

        const column = columnConfigs.find(col => col.id === sortConfig.key);
        if (!column) return dataToSort;

        return sortData(dataToSort, sortConfig, column);
    }, [licenses, filteredLicenses, isFiltering, sortConfig, columnConfigs]);

    // Calculate paginated licenses - use client-side pagination when sorting/filtering, server-side pagination otherwise
    const paginatedLicenses = useMemo(() => {
        if (isFiltering || sortConfig) {
            // Client-side pagination for filtered/sorted results
            if (rowsPerPage === 99999) {
                // Show all results
                return sortedLicenses;
            }
            const startIndex = page * rowsPerPage;
            const endIndex = startIndex + rowsPerPage;
            return sortedLicenses.slice(startIndex, endIndex);
        } else {
            // Server-side pagination - use licenses directly as they are already paginated
            return licenses;
        }
    }, [licenses, sortedLicenses, isFiltering, sortConfig, page, rowsPerPage]);

    // Calculate total count for pagination
    const displayTotalCount = (isFiltering || sortConfig) ? sortedLicenses.length : totalCount;
    // Activate/Deactivate handlers
    const handleOpenActivateDialog = (license: LicensePublic) => {
        setActionLicense(license);
        setOpenActivateDialog(true);
    };

    const handleCloseActivateDialog = () => {
        setActionLicense(null);
        setOpenActivateDialog(false);
    }; const handleActivateLicense = async () => {
        if (!actionLicense) return;
        try {
            const response = await apiClient<LicensePublic>({
                url: `/api/v1/licenses/${actionLicense.id}/activate`,
                method: 'PUT',
            });

            if (response.status === 200) {
                // Cập nhật state local trước khi fetch lại để tránh flicker
                setLicenses(prevLicenses =>
                    prevLicenses.map(license =>
                        license.id === actionLicense.id
                            ? { ...license, is_active: true }
                            : license
                    )
                );
                // Sau đó fetch lại để đảm bảo dữ liệu consistency
                await fetchLicenses();
                handleCloseActivateDialog();
            } else {
                setError(response.message || "Failed to activate license.");
                handleCloseActivateDialog();
            }
        } catch (err: any) {
            setError(err.message || "Failed to activate license.");
            handleCloseActivateDialog();
        }
    };

    const handleOpenDeactivateDialog = (license: LicensePublic) => {
        setActionLicense(license);
        setOpenDeactivateDialog(true);
    };

    const handleCloseDeactivateDialog = () => {
        setActionLicense(null);
        setOpenDeactivateDialog(false);
    }; const handleDeactivateLicense = async () => {
        if (!actionLicense) return;
        try {
            const response = await apiClient({
                url: `/api/v1/licenses/${actionLicense.id}/deactivate`,
                method: 'PUT',
            });

            if (response.status === 200) {
                // Cập nhật state local trước khi fetch lại để tránh flicker
                setLicenses(prevLicenses =>
                    prevLicenses.map(license =>
                        license.id === actionLicense.id
                            ? { ...license, is_active: false }
                            : license
                    )
                );
                // Sau đó fetch lại để đảm bảo dữ liệu consistency
                await fetchLicenses();
                handleCloseDeactivateDialog();
            } else {
                setError(response.message || "Failed to deactivate license.");
                handleCloseDeactivateDialog();
            }
        } catch (err: any) {
            setError(err.message || "Failed to deactivate license.");
            handleCloseDeactivateDialog();
        }
    };

    // Delete handlers
    const handleAddLicense = () => {
        setOpenCreateModal(true);
    };

    const handleLicenseCreated = () => {
        setOpenCreateModal(false);
        fetchLicenses(); // Refresh the licenses list
    };

    const handleEditLicense = (licenseId: string) => {
        const license = licenses.find(l => l.id === licenseId);
        if (license) {
            setSelectedLicense(license);
            setOpenEditModal(true);
        }
    };

    const handleLicenseUpdated = () => {
        setOpenEditModal(false);
        setSelectedLicense(null);
        fetchLicenses(); // Refresh the licenses list
    };
    return (
        <Box sx={{
            maxWidth: '100%',
            overflow: 'hidden'
        }}>
            {/* Breadcrumb */}
            <AdminBreadcrumb />

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <LicenseIcon sx={{ mr: 1, fontSize: 24 }} />
                    <Typography variant="h3" component="h1">
                        Quản lý Licenses
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
                        onClick={handleAddLicense}
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
                            Tạo License
                        </Box>
                    </Button>
                </Box>
            </Box>

            {/* Search/Filter Component */}
            <LicenseSearch
                licenses={licenses}
                onFilteredLicenses={handleFilteredLicenses}
                loading={loading}
            />

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                {loading && licenses.length === 0 ? (
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
                                    {Array.isArray(paginatedLicenses) && paginatedLicenses.map((license) => (
                                        <TableRow
                                            hover
                                            key={license.id}
                                            sx={{
                                                '&:hover': {
                                                    backgroundColor: theme.palette.component.tableRow.hover
                                                }
                                            }}
                                        >
                                            {/* License Key */}
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[0], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[0].minWidth,
                                                width: expandedView ? 'auto' : columnConfigs[0].minWidth
                                            }}>
                                                <Chip
                                                    label={license.key}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{
                                                        fontWeight: 'medium',
                                                        ...(license.color && {
                                                            backgroundColor: license.color,
                                                            color: 'white',
                                                            borderColor: license.color,
                                                            '&:hover': {
                                                                backgroundColor: license.color,
                                                                opacity: 0.8
                                                            }
                                                        })
                                                    }}
                                                />
                                            </TableCell>

                                            {/* Name */}
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[1], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[1].minWidth
                                            }}>
                                                <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                                                    {license.name}
                                                </Typography>
                                            </TableCell>

                                            {/* Price */}
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[2], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[2].minWidth
                                            }}>
                                                <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                                                    {columnConfigs[2].format?.(license.price)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[3], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[3].minWidth
                                            }}>
                                                <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                                                    {columnConfigs[3].format?.(license.duration_days)}
                                                </Typography>
                                            </TableCell>

                                            {/* Active Status */}
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[4], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[4].minWidth
                                            }}>
                                                <Chip
                                                    label={license.is_active ? 'Hoạt động' : 'Không hoạt động'}
                                                    color={license.is_active ? 'success' : 'default'}
                                                    size="small"
                                                    variant={license.is_active ? "filled" : "outlined"}
                                                    sx={{
                                                        fontWeight: 'medium',
                                                        minWidth: '70px'
                                                    }}
                                                />
                                            </TableCell>
                                            {/* Feature Keys */}
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[5], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[5].minWidth
                                            }}>
                                                <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                                                    {columnConfigs[5].format?.(license.feature_keys.length)}
                                                </Typography>
                                            </TableCell>

                                            {/* Created At */}
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[6], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[6].minWidth
                                            }}>
                                                <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                                                    {columnConfigs[6].format?.(license.created_at || '')}
                                                </Typography>
                                            </TableCell>

                                            {/* Updated At */}
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[7], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[7].minWidth
                                            }}>
                                                <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                                                    {columnConfigs[7].format?.(license.updated_at || '')}
                                                </Typography>
                                            </TableCell>
                                            {/* Actions */}
                                            <TableCell
                                                sx={{
                                                    ...getResponsiveDisplayStyle(columnConfigs[8], expandedView),
                                                    position: 'sticky',
                                                    right: -1,
                                                    backgroundColor: 'background.paper',
                                                    zIndex: 1,
                                                    minWidth: columnConfigs[8].minWidth,
                                                    width: columnConfigs[8].minWidth,
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
                                                    {license.is_active ? (
                                                        <Tooltip title="Hủy kích hoạt license">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleOpenDeactivateDialog(license)}
                                                                color="error"
                                                                sx={{
                                                                    minWidth: { xs: 32, sm: 'auto' },
                                                                    width: { xs: 32, sm: 'auto' },
                                                                    height: { xs: 32, sm: 'auto' }
                                                                }}
                                                            >
                                                                <DeactivateIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    ) : (
                                                        <Tooltip title="Kích hoạt license">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleOpenActivateDialog(license)}
                                                                color="success"
                                                                sx={{
                                                                    minWidth: { xs: 32, sm: 'auto' },
                                                                    width: { xs: 32, sm: 'auto' },
                                                                    height: { xs: 32, sm: 'auto' }
                                                                }}
                                                            >
                                                                <ActivateIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}

                                                    <Tooltip title="Chỉnh sửa license">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleEditLicense(license.id)}
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
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {Array.isArray(paginatedLicenses) && paginatedLicenses.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={columnConfigs.length} align="center">
                                                <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                                                    {isFiltering
                                                        ? "Không tìm thấy license nào phù hợp với tiêu chí tìm kiếm."
                                                        : "Chưa có license nào."
                                                    }
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination
                            rowsPerPageOptions={[5, 10, 25, 50, { label: 'ALL', value: 99999 }]}
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
                        />                    </>
                )}
            </Paper>

            {/* Deactivate Confirmation Dialog */}
            <Dialog
                open={openDeactivateDialog}
                onClose={handleCloseDeactivateDialog}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 2 }
                }}
            >
                <DialogTitle>
                    <Typography variant="h6" component="div" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
                        <DeactivateIcon />
                        Xác nhận hủy kích hoạt license
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        Bạn có chắc chắn muốn hủy kích hoạt license này không?
                    </DialogContentText>

                    {actionLicense && (
                        <Box sx={{
                            p: 2,
                            bgcolor: theme.palette.component.modal.noteBackground,
                            borderRadius: 1,
                            border: `1px solid ${theme.palette.component.modal.noteBorder}`,
                            mb: 2
                        }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Typography variant="body2">
                                    • <strong>License Key:</strong> {actionLicense.key}
                                </Typography>
                                <Typography variant="body2">
                                    • <strong>Tên gói:</strong> {actionLicense.name}
                                </Typography>
                                <Typography variant="body2">
                                    • <strong>Giá tiền:</strong> {actionLicense.price.toLocaleString('vi-VN')} VNĐ
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    <Box sx={{
                        p: 2,
                        bgcolor: theme.palette.component.modal.noteBackground,
                        borderRadius: 1,
                        border: `1px solid ${theme.palette.component.modal.noteBorder}`,
                        mb: 2,
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '3px',
                            bgcolor: 'warning.main',
                            borderRadius: borderRadiusTop('sm')
                        },
                        position: 'relative'
                    }}>
                        <Typography variant="body2" fontWeight="bold" sx={{ mb: 1, color: 'warning.main' }}>
                            ⚠️ Lưu ý quan trọng:
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                            • License sẽ được đánh dấu là không hoạt động
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                            • Người dùng sẽ không thể mua license này nữa
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                            • Thao tác này có thể được hoàn tác bằng cách kích hoạt lại
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 1 }}>
                    <Button
                        onClick={handleCloseDeactivateDialog}
                        variant="outlined"
                        sx={{ minWidth: 100 }}
                    >
                        Hủy
                    </Button>
                    <Button
                        onClick={handleDeactivateLicense}
                        color="error"
                        variant="contained"
                        sx={{ minWidth: 140 }}
                    >
                        Xác nhận hủy kích hoạt
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Activate Confirmation Dialog */}
            <Dialog
                open={openActivateDialog}
                onClose={handleCloseActivateDialog}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 2 }
                }}
            >
                <DialogTitle>
                    <Typography variant="h6" component="div" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'success.main' }}>
                        <ActivateIcon />
                        Xác nhận kích hoạt license
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        Bạn có chắc chắn muốn kích hoạt license này không?
                    </DialogContentText>

                    {actionLicense && (
                        <Box sx={{
                            p: 2,
                            bgcolor: theme.palette.component.modal.noteBackground,
                            borderRadius: 1,
                            border: `1px solid ${theme.palette.component.modal.noteBorder}`,
                            mb: 2
                        }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Typography variant="body2">
                                    • <strong>License Key:</strong> {actionLicense.key}
                                </Typography>
                                <Typography variant="body2">
                                    • <strong>Tên gói:</strong> {actionLicense.name}
                                </Typography>
                                <Typography variant="body2">
                                    • <strong>Giá tiền:</strong> {actionLicense.price.toLocaleString('vi-VN')} VNĐ
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    <Box sx={{
                        p: 2,
                        bgcolor: theme.palette.component.modal.noteBackground,
                        borderRadius: 1,
                        border: `1px solid ${theme.palette.component.modal.noteBorder}`,
                        mb: 2,
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '3px',
                            bgcolor: 'info.main',
                            borderRadius: borderRadiusTop('sm')
                        },
                        position: 'relative'
                    }}>
                        <Typography variant="body2" fontWeight="bold" sx={{ mb: 1, color: 'info.main' }}>
                            💡 Lưu ý quan trọng:
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                            • License sẽ được đánh dấu là đang hoạt động
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                            • Người dùng sẽ có thể mua license này
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                            • License sẽ xuất hiện trong danh sách có sẵn
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 1 }}>
                    <Button
                        onClick={handleCloseActivateDialog}
                        variant="outlined"
                        sx={{ minWidth: 100 }}
                    >
                        Hủy
                    </Button>
                    <Button
                        onClick={handleActivateLicense}
                        color="success"
                        variant="contained"
                        sx={{ minWidth: 140 }}
                    >
                        Xác nhận kích hoạt
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Create License Modal */}
            <CreateLicenseModal
                open={openCreateModal}
                onClose={() => setOpenCreateModal(false)}
                onLicenseCreated={handleLicenseCreated}
            />

            {/* Edit License Modal */}
            {selectedLicense && (
                <EditLicenseModal
                    open={openEditModal}
                    onClose={() => setOpenEditModal(false)}
                    license={selectedLicense}
                    onLicenseUpdated={handleLicenseUpdated}
                />
            )}
        </Box>
    );
}