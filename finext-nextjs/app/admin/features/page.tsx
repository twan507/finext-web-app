// finext-nextjs/app/admin/features/page.tsx
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
    Category as FeatureIcon,
    Add as AddIcon,
    EditSquare as EditIcon,
    Delete as DeleteIcon,
    UnfoldMore as ExpandIcon,
    UnfoldLess as CollapseIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { colorTokens, responsiveTypographyTokens } from 'theme/tokens';
import SortableTableHead from '../components/SortableTableHead';
import {
    SortConfig,
    ColumnConfig,
    sortData,
    getNextSortDirection,
    getResponsiveDisplayStyle
} from '../components/TableSortUtils';
import FeatureSearch from './components/FeatureSearch';
import CreateFeatureModal from './components/CreateFeatureModal';
import EditFeatureModal from './components/EditFeatureModal';
import { isSystemFeature, isBasicFeature } from 'utils/systemProtection';

// Interface matching FeaturePublic from backend schemas/features.py
interface FeaturePublic {
    id: string;
    key: string;
    name: string;
    description?: string | null;
    // created_at and updated_at might be part of FeatureInDB but exposed via an admin endpoint
    created_at?: string;
    updated_at?: string;
}

interface PaginatedFeaturesResponse {
    items: FeaturePublic[];
    total: number;
}

export default function FeaturesPage() {
    const theme = useTheme();
    const componentColors = theme.palette.mode === 'light'
        ? colorTokens.lightComponentColors
        : colorTokens.darkComponentColors;

    const [features, setFeatures] = useState<FeaturePublic[]>([]);
    const [filteredFeatures, setFilteredFeatures] = useState<FeaturePublic[]>([]);
    const [isFiltering, setIsFiltering] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    // View and sorting state
    const [expandedView, setExpandedView] = useState(false);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);    // Delete Dialog state
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [featureToDelete, setFeatureToDelete] = useState<FeaturePublic | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Create/Edit Modal state
    const [openCreateModal, setOpenCreateModal] = useState(false);
    const [openEditModal, setOpenEditModal] = useState(false);
    const [featureToEdit, setFeatureToEdit] = useState<FeaturePublic | null>(null);

    // Column configuration for sortable table
    const columnConfigs: ColumnConfig[] = useMemo(() => [
        {
            id: 'key',
            label: 'Feature Key',
            sortable: true,
            sortType: 'string',
            accessor: (feature: FeaturePublic) => feature.key,
            minWidth: expandedView ? 'auto' : 130,
        },
        {
            id: 'name',
            label: 'Tên tính năng',
            sortable: true,
            sortType: 'string',
            accessor: (feature: FeaturePublic) => feature.name,
            minWidth: expandedView ? 'auto' : 200,
            responsive: { xs: 'none', sm: 'none' }
        },
        {
            id: 'description',
            label: 'Mô tả',
            sortable: true,
            sortType: 'string',
            accessor: (feature: FeaturePublic) => feature.description || '',
            minWidth: expandedView ? 'auto' : 250,
            responsive: { xs: 'none', sm: 'none', md: 'none' }
        },
        {
            id: 'created_at',
            label: 'Ngày tạo',
            sortable: true,
            sortType: 'date',
            accessor: (feature: FeaturePublic) => feature.created_at || '',
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
            accessor: (feature: FeaturePublic) => feature.updated_at || '',
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
    ], [expandedView]); const fetchFeatures = useCallback(async () => {
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

            const response = await apiClient<PaginatedFeaturesResponse | FeaturePublic[]>({
                url: `/api/v1/features?skip=${page * rowsPerPage}&limit=${rowsPerPage}`,
                method: 'GET',
            });

            if (response.status === 200 && response.data) {
                if ('items' in response.data && Array.isArray(response.data.items) && typeof response.data.total === 'number') {
                    setFeatures(response.data.items);
                    setTotalCount(response.data.total);
                } else if (Array.isArray(response.data)) {
                    console.warn("Backend for features did not return total count. Pagination might be inaccurate.");
                    setFeatures(response.data as FeaturePublic[]);
                    const currentDataLength = (response.data as FeaturePublic[]).length;
                    if (page === 0) {
                        setTotalCount(currentDataLength < rowsPerPage ? currentDataLength : currentDataLength + (currentDataLength === rowsPerPage ? rowsPerPage : 0));
                    } else if (currentDataLength < rowsPerPage) {
                        setTotalCount(page * rowsPerPage + currentDataLength);
                    } else {
                        setTotalCount(page * rowsPerPage + currentDataLength + rowsPerPage);
                    }
                } else {
                    throw new Error("Unexpected data structure from API for features.");
                }
            } else {
                setError(response.message || 'Failed to load features.');
                setFeatures([]);
                setTotalCount(0);
            }
        } catch (err: any) {
            setError(err.message || 'Connection error or unauthorized access. Ensure the API endpoint for features exists.');
            setFeatures([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage, sortConfig]);

    useEffect(() => {
        fetchFeatures();
    }, [fetchFeatures]);

    // Update filtered features when features change and not actively filtering
    useEffect(() => {
        if (!isFiltering) {
            setFilteredFeatures(features);
        }
    }, [features, isFiltering]); const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleFilteredFeatures = (filtered: FeaturePublic[], isActivelyFiltering: boolean) => {
        setFilteredFeatures(filtered);
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
    const sortedFeatures = useMemo(() => {
        const dataToSort = isFiltering ? filteredFeatures : features;

        if (!sortConfig || !sortConfig.direction) {
            return dataToSort;
        }

        const column = columnConfigs.find(col => col.id === sortConfig.key);
        if (!column) return dataToSort;

        return sortData(dataToSort, sortConfig, column);
    }, [features, filteredFeatures, isFiltering, sortConfig, columnConfigs]);

    // Calculate paginated features - use client-side pagination when sorting/filtering, server-side pagination otherwise
    const paginatedFeatures = useMemo(() => {
        if (isFiltering || sortConfig) {
            // Client-side pagination for filtered/sorted results
            if (rowsPerPage === 99999) {
                // Show all results
                return sortedFeatures;
            }
            const startIndex = page * rowsPerPage;
            const endIndex = startIndex + rowsPerPage;
            return sortedFeatures.slice(startIndex, endIndex);
        } else {
            // Server-side pagination - use features directly as they are already paginated
            return features;
        }
    }, [features, sortedFeatures, isFiltering, sortConfig, page, rowsPerPage]);    // Calculate total count for pagination
    const displayTotalCount = (isFiltering || sortConfig) ? sortedFeatures.length : totalCount;

    // Helper function to check if feature can be deleted
    const canDeleteFeature = (feature: FeaturePublic): boolean => {
        return !isSystemFeature(feature.key) && !isBasicFeature(feature.key);
    };

    // Helper function to get tooltip message for delete button
    const getDeleteTooltipMessage = (feature: FeaturePublic): string => {
        if (isSystemFeature(feature.key)) {
            return "Không thể xóa tính năng hệ thống";
        }
        if (isBasicFeature(feature.key)) {
            return "Không thể xóa tính năng cơ bản";
        }
        return "Xóa tính năng";
    };

    // Delete handlers
    const handleOpenDeleteDialog = (feature: FeaturePublic) => {
        setFeatureToDelete(feature);
        setOpenDeleteDialog(true);
    };

    const handleCloseDeleteDialog = () => {
        setFeatureToDelete(null);
        setOpenDeleteDialog(false);
        setDeleteLoading(false);
    };

    const handleDeleteFeature = async () => {
        if (!featureToDelete) return;

        setDeleteLoading(true);
        setError(null);

        try {
            const response = await apiClient({
                url: `/api/v1/features/${featureToDelete.id}`,
                method: 'DELETE',
            });

            if (response.status === 200) {
                fetchFeatures(); // Refresh list
                handleCloseDeleteDialog();
            } else {
                setError(response.message || 'Không thể xóa tính năng.');
            }
        } catch (delError: any) {
            setError(delError.message || 'Lỗi khi xóa tính năng. Tính năng có thể đang được sử dụng.');
            handleCloseDeleteDialog();
        } finally {
            setDeleteLoading(false);
        }
    }; const handleAddFeature = () => {
        setOpenCreateModal(true);
    };

    const handleEditFeature = (featureId: string) => {
        const feature = features.find(f => f.id === featureId);
        if (feature) {
            setFeatureToEdit(feature);
            setOpenEditModal(true);
        }
    };

    const handleCloseCreateModal = () => {
        setOpenCreateModal(false);
    };

    const handleCloseEditModal = () => {
        setOpenEditModal(false);
        setFeatureToEdit(null);
    };

    const handleFeatureCreated = () => {
        setOpenCreateModal(false);
        fetchFeatures(); // Refresh the features list
    };

    const handleFeatureUpdated = () => {
        setOpenEditModal(false);
        setFeatureToEdit(null);
        fetchFeatures(); // Refresh the features list
    }; return (
        <Box sx={{
            maxWidth: '100%',
            overflow: 'hidden'
        }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <FeatureIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h3" component="h1">
                        Quản lý Tính năng
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
                        onClick={handleAddFeature}
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
                            Tạo tính năng
                        </Box>
                    </Button>
                </Box>
            </Box>

            {/* Search/Filter Component */}
            <FeatureSearch
                features={features}
                onFilteredFeatures={handleFilteredFeatures}
                loading={loading}
            />

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                {loading && features.length === 0 ? (
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
                                    {Array.isArray(paginatedFeatures) && paginatedFeatures.map((feature) => (
                                        <TableRow hover key={feature.id}>
                                            {/* Feature Key */}
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[0], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[0].minWidth,
                                                width: expandedView ? 'auto' : columnConfigs[0].minWidth
                                            }}>
                                                <Chip
                                                    label={feature.key}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ fontWeight: 'medium' }}
                                                />
                                            </TableCell>

                                            {/* Name */}
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[1], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[1].minWidth
                                            }}>
                                                <Typography sx={responsiveTypographyTokens.tableCell}>
                                                    {feature.name}
                                                </Typography>
                                            </TableCell>

                                            {/* Description */}
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[2], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[2].minWidth
                                            }}>
                                                <Tooltip title={feature.description || ''}>
                                                    <Typography sx={{
                                                        ...responsiveTypographyTokens.tableCell,
                                                        maxWidth: 300,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {feature.description || 'N/A'}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>

                                            {/* Created At */}
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[3], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[3].minWidth
                                            }}>
                                                <Typography sx={responsiveTypographyTokens.tableCell}>
                                                    {columnConfigs[3].format?.(feature.created_at || '')}
                                                </Typography>
                                            </TableCell>

                                            {/* Updated At */}
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[4], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[4].minWidth
                                            }}>
                                                <Typography sx={responsiveTypographyTokens.tableCell}>
                                                    {columnConfigs[4].format?.(feature.updated_at || '')}
                                                </Typography>
                                            </TableCell>

                                            {/* Actions */}
                                            <TableCell
                                                sx={{
                                                    ...getResponsiveDisplayStyle(columnConfigs[5], expandedView),
                                                    position: 'sticky',
                                                    right: -1,
                                                    backgroundColor: 'background.paper',
                                                    zIndex: 2,
                                                    borderLeft: '1px solid',
                                                    borderColor: 'divider',
                                                    minWidth: columnConfigs[5].minWidth,
                                                    width: columnConfigs[5].minWidth,
                                                    whiteSpace: 'nowrap',
                                                    paddingLeft: 1,
                                                    paddingRight: 2
                                                }}
                                                align="center"
                                            >                                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                                    <Tooltip title="Chỉnh sửa tính năng">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleEditFeature(feature.id)}
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

                                                    <Tooltip title={getDeleteTooltipMessage(feature)}>
                                                        <span>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleOpenDeleteDialog(feature)}
                                                                color="error"
                                                                disabled={!canDeleteFeature(feature)}
                                                                sx={{
                                                                    minWidth: { xs: 32, sm: 'auto' },
                                                                    width: { xs: 32, sm: 'auto' },
                                                                    height: { xs: 32, sm: 'auto' },
                                                                    opacity: canDeleteFeature(feature) ? 1 : 0.5
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
                                    {Array.isArray(paginatedFeatures) && paginatedFeatures.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={columnConfigs.length} align="center">
                                                <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                                                    {isFiltering
                                                        ? "Không tìm thấy tính năng nào phù hợp với tiêu chí tìm kiếm."
                                                        : "Chưa có tính năng nào."
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

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={openDeleteDialog}
                onClose={handleCloseDeleteDialog}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 2 }
                }}
            >
                <DialogTitle>
                    <Typography variant="h6" component="div" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
                        <DeleteIcon />
                        Xác nhận xóa tính năng
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Bạn có chắc chắn muốn xóa tính năng <strong>{featureToDelete?.name}</strong> (Key: {featureToDelete?.key})?
                        <br />
                        <Typography component="span" color="error.main" fontWeight="medium">
                            Hành động này có thể ảnh hưởng đến các licenses đang sử dụng tính năng này.
                        </Typography>
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={handleCloseDeleteDialog} variant="outlined">
                        Hủy
                    </Button>
                    <Button
                        onClick={handleDeleteFeature}
                        color="error"
                        variant="contained"
                        disabled={deleteLoading}
                        startIcon={deleteLoading ? <CircularProgress size={16} /> : <DeleteIcon />}
                    >
                        {deleteLoading ? "Đang xóa..." : "Xóa"}
                    </Button>                </DialogActions>
            </Dialog>

            {/* Create Feature Modal */}
            <CreateFeatureModal
                open={openCreateModal}
                onClose={handleCloseCreateModal}
                onFeatureCreated={handleFeatureCreated}
            />

            {/* Edit Feature Modal */}
            <EditFeatureModal
                open={openEditModal}
                onClose={handleCloseEditModal}
                feature={featureToEdit}
                onFeatureUpdated={handleFeatureUpdated}
            />
        </Box>
    );
}