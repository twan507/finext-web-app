// finext-nextjs/app/admin/promotions/page.tsx
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
    Campaign as PromotionIcon,
    Add as AddIcon,
    EditSquare as EditIcon,
    Delete as DeleteIcon,
    UnfoldMore as ExpandIcon,
    UnfoldLess as CollapseIcon, AddCircle as ActivateIcon,
    DoDisturbOn as DeactivateIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { getResponsiveFontSize, borderRadiusTop } from 'theme/tokens';
import { formatUTCToGMT7 } from 'utils/dateUtils';
import SortableTableHead from '../components/SortableTableHead';
import TablePaginationStyled from '../components/TablePaginationStyled';
import {
    SortConfig,
    ColumnConfig,
    sortData,
    getNextSortDirection,
    getResponsiveDisplayStyle
} from '../components/TableSortUtils';
import PromotionSearch from './components/PromotionSearch';
import CreatePromotionModal from './components/CreatePromotionModal';
import EditPromotionModal from './components/EditPromotionModal';

enum DiscountTypeEnumFE {
    PERCENTAGE = "percentage",
    FIXED_AMOUNT = "fixed_amount",
}

interface PromotionPublic {
    id: string;
    promotion_code: string;
    description?: string | null;
    discount_type: DiscountTypeEnumFE;
    discount_value: number;
    is_active: boolean;
    start_date?: string | null; // ISO string
    end_date?: string | null;   // ISO string
    usage_limit?: number | null;
    usage_count: number;
    applicable_license_keys?: string[] | null;
    created_at: string; // ISO string
    updated_at: string; // ISO string
}

interface PaginatedPromotionsResponse {
    items: PromotionPublic[];
    total: number;
}

export default function PromotionsPage() {
    const theme = useTheme();


    const [promotions, setPromotions] = useState<PromotionPublic[]>([]);
    const [filteredPromotions, setFilteredPromotions] = useState<PromotionPublic[]>([]);
    const [isFiltering, setIsFiltering] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    // View and sorting state
    const [expandedView, setExpandedView] = useState(false);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);    // Modal state
    const [openCreateModal, setOpenCreateModal] = useState(false);
    const [openEditModal, setOpenEditModal] = useState(false);
    const [selectedPromotion, setSelectedPromotion] = useState<PromotionPublic | null>(null);    // Delete Dialog state
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [promotionToDelete, setPromotionToDelete] = useState<PromotionPublic | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Action dialogs state
    const [actionPromotion, setActionPromotion] = useState<PromotionPublic | null>(null);
    const [openActivateDialog, setOpenActivateDialog] = useState(false);
    const [openDeactivateDialog, setOpenDeactivateDialog] = useState(false);

    // Column configuration for sortable table
    const columnConfigs: ColumnConfig[] = useMemo(() => [
        {
            id: 'promotion_code',
            label: 'Mã khuyến mãi',
            sortable: true,
            sortType: 'string',
            accessor: (promo: PromotionPublic) => promo.promotion_code,
            minWidth: expandedView ? 'auto' : 150,
        },
        {
            id: 'description',
            label: 'Mô tả',
            sortable: true,
            sortType: 'string',
            accessor: (promo: PromotionPublic) => promo.description || '',
            minWidth: expandedView ? 'auto' : 200,
            responsive: { xs: 'none' }
        },
        {
            id: 'discount_value',
            label: 'Giảm giá',
            sortable: true,
            sortType: 'number',
            accessor: (promo: PromotionPublic) => promo.discount_value,
            minWidth: expandedView ? 'auto' : 120,
        },
        {
            id: 'usage',
            label: 'Sử dụng',
            sortable: true,
            sortType: 'number',
            accessor: (promo: PromotionPublic) => promo.usage_count,
            minWidth: expandedView ? 'auto' : 100,
            responsive: { xs: 'none', sm: 'none' }
        },
        {
            id: 'is_active',
            label: 'Trạng thái',
            sortable: true,
            sortType: 'boolean',
            accessor: (promo: PromotionPublic) => promo.is_active,
            minWidth: expandedView ? 'auto' : 100,
        }, {
            id: 'start_date',
            label: 'Ngày bắt đầu',
            sortable: true,
            sortType: 'date',
            accessor: (promo: PromotionPublic) => promo.start_date,
            minWidth: expandedView ? 'auto' : 140,
            responsive: { xs: 'none', sm: 'none', md: 'none' },
            format: (value: string | null) => {
                if (!value) return 'N/A';
                try {
                    return formatUTCToGMT7(value, true);
                } catch (error) {
                    return 'Invalid date';
                }
            },
        }, {
            id: 'end_date',
            label: 'Ngày kết thúc',
            sortable: true,
            sortType: 'date',
            accessor: (promo: PromotionPublic) => promo.end_date,
            minWidth: expandedView ? 'auto' : 140,
            responsive: { xs: 'none', sm: 'none', md: 'none' },
            format: (value: string | null) => {
                if (!value) return 'N/A';
                try {
                    return formatUTCToGMT7(value, true);
                } catch (error) {
                    return 'Invalid date';
                }
            },
        },
        {
            id: 'created_at',
            label: 'Ngày tạo',
            sortable: true,
            sortType: 'date',
            accessor: (promo: PromotionPublic) => promo.created_at,
            minWidth: expandedView ? 'auto' : 140,
            responsive: { xs: 'none', sm: 'none', md: 'none', lg: 'none' },
            format: (value: string) => {
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
    ], [expandedView]);

    const fetchPromotions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const queryParams: Record<string, any> = {
                skip: page * rowsPerPage,
                limit: rowsPerPage,
            };

            const response = await apiClient<PaginatedPromotionsResponse | PromotionPublic[]>({
                url: `/api/v1/promotions/`,
                method: 'GET',
                queryParams,
            });

            if (response.status === 200 && response.data) {
                if ('items' in response.data && Array.isArray(response.data.items) && typeof response.data.total === 'number') {
                    setPromotions(response.data.items);
                    setTotalCount(response.data.total);
                } else if (Array.isArray(response.data)) {
                    console.warn("Backend for promotions did not return total count. Pagination might be inaccurate.");
                    setPromotions(response.data as PromotionPublic[]);
                    const currentDataLength = (response.data as PromotionPublic[]).length;
                    if (page === 0) {
                        setTotalCount(currentDataLength < rowsPerPage ? currentDataLength : currentDataLength + (currentDataLength === rowsPerPage ? rowsPerPage : 0));
                    } else if (currentDataLength < rowsPerPage) {
                        setTotalCount(page * rowsPerPage + currentDataLength);
                    } else {
                        setTotalCount(page * rowsPerPage + currentDataLength + rowsPerPage);
                    }
                } else {
                    throw new Error("Unexpected data structure from API for promotions.");
                }
            } else {
                setError(response.message || 'Failed to load promotions.');
                setPromotions([]);
                setTotalCount(0);
            }
        } catch (err: any) {
            setError(err.message || 'Connection error or unauthorized access.');
            setPromotions([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage]);

    useEffect(() => {
        fetchPromotions();
    }, [fetchPromotions]);

    const handleFilteredPromotions = (filtered: PromotionPublic[], isActivelyFiltering: boolean) => {
        setFilteredPromotions(filtered);
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
        setPage(0); // Reset to first page when sorting
    };

    // Compute sorted data
    const sortedPromotions = useMemo(() => {
        const dataToSort = isFiltering ? filteredPromotions : promotions;

        if (!sortConfig || !sortConfig.direction) {
            return dataToSort;
        }

        const column = columnConfigs.find(col => col.id === sortConfig.key);
        if (!column) return dataToSort;

        return sortData(dataToSort, sortConfig, column);
    }, [promotions, filteredPromotions, isFiltering, sortConfig, columnConfigs]);

    // Calculate paginated promotions - use client-side pagination when sorting/filtering, server-side pagination otherwise
    const paginatedPromotions = useMemo(() => {
        if (isFiltering || sortConfig) {
            // Client-side pagination for filtered/sorted results
            if (rowsPerPage === 99999) {
                // Show all results
                return sortedPromotions;
            }
            const startIndex = page * rowsPerPage;
            const endIndex = startIndex + rowsPerPage;
            return sortedPromotions.slice(startIndex, endIndex);
        } else {
            // Server-side pagination - use promotions directly as they are already paginated
            return promotions;
        }
    }, [promotions, sortedPromotions, isFiltering, sortConfig, page, rowsPerPage]);

    // Calculate total count for pagination
    const displayTotalCount = (isFiltering || sortConfig) ? sortedPromotions.length : totalCount;

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    }; const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleAddPromotion = () => {
        setOpenCreateModal(true);
    };

    const handlePromotionCreated = () => {
        setOpenCreateModal(false);
        fetchPromotions(); // Refresh the promotions list
    };

    const handleEditPromotion = (promoId: string) => {
        const promotion = promotions.find(p => p.id === promoId);
        if (promotion) {
            setSelectedPromotion(promotion);
            setOpenEditModal(true);
        }
    }; const handlePromotionUpdated = () => {
        setOpenEditModal(false);
        setSelectedPromotion(null);
        fetchPromotions(); // Refresh the promotions list
    };

    // Activate/Deactivate handlers
    const handleOpenActivateDialog = (promo: PromotionPublic) => {
        setActionPromotion(promo);
        setOpenActivateDialog(true);
    };

    const handleCloseActivateDialog = () => {
        setActionPromotion(null);
        setOpenActivateDialog(false);
    };

    const handleActivatePromotion = async () => {
        if (!actionPromotion) return;
        try {
            await apiClient<PromotionPublic>({
                url: `/api/v1/promotions/${actionPromotion.id}`,
                method: 'PUT',
                body: { is_active: true }
            });
            fetchPromotions();
            handleCloseActivateDialog();
        } catch (err: any) {
            setError(err.message || "Failed to activate promotion.");
            handleCloseActivateDialog();
        }
    };

    const handleOpenDeactivateDialog = (promo: PromotionPublic) => {
        setActionPromotion(promo);
        setOpenDeactivateDialog(true);
    };

    const handleCloseDeactivateDialog = () => {
        setActionPromotion(null);
        setOpenDeactivateDialog(false);
    };

    const handleDeactivatePromotion = async () => {
        if (!actionPromotion) return;
        try {
            await apiClient<PromotionPublic>({
                url: `/api/v1/promotions/${actionPromotion.id}/deactivate`,
                method: 'PUT',
            });
            fetchPromotions();
            handleCloseDeactivateDialog();
        } catch (err: any) {
            setError(err.message || "Failed to deactivate promotion.");
            handleCloseDeactivateDialog();
        }
    };

    // Delete handlers
    const handleOpenDeleteDialog = (promo: PromotionPublic) => {
        setPromotionToDelete(promo);
        setOpenDeleteDialog(true);
    };

    const handleCloseDeleteDialog = () => {
        setPromotionToDelete(null);
        setOpenDeleteDialog(false);
        setDeleteLoading(false);
    };

    const handleDeletePromotion = async () => {
        if (!promotionToDelete) return;

        setDeleteLoading(true);
        setError(null);

        try {
            const response = await apiClient({
                url: `/api/v1/promotions/${promotionToDelete.id}`,
                method: 'DELETE',
            });

            if (response.status === 200) {
                fetchPromotions(); // Refresh list
                handleCloseDeleteDialog();
            } else {
                setError(response.message || 'Không thể xóa mã khuyến mãi.');
            }
        } catch (delError: any) {
            setError(delError.message || 'Lỗi khi xóa mã khuyến mãi. Mã khuyến mãi có thể đang hoạt động.');
            handleCloseDeleteDialog();
        } finally {
            setDeleteLoading(false);
        }
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
                    <PromotionIcon sx={{ mr: 1 }} />
                    <Typography variant="h3" component="h1">
                        Quản lý Khuyến mãi
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
                        onClick={handleAddPromotion}
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
                            Tạo khuyến mãi
                        </Box>
                    </Button>
                </Box>
            </Box>

            {/* Search/Filter Component */}
            <PromotionSearch
                promotions={promotions}
                onFilteredPromotions={handleFilteredPromotions}
                loading={loading}
            />

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                {loading && promotions.length === 0 ? (
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
                                    {Array.isArray(paginatedPromotions) && paginatedPromotions.map((promo) => (
                                        <TableRow
                                            hover
                                            key={promo.id}
                                            sx={{
                                                '&:hover': {
                                                    backgroundColor: theme.palette.component.tableRow.hover
                                                }
                                            }}
                                        >
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[0], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[0].minWidth,
                                                width: expandedView ? 'auto' : columnConfigs[0].minWidth
                                            }}>
                                                <Chip
                                                    label={promo.promotion_code}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ fontWeight: 'medium' }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[1], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[1].minWidth
                                            }}>
                                                <Tooltip title={promo.description || ''}>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            maxWidth: expandedView ? 'none' : 200,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            fontSize: getResponsiveFontSize('sm')
                                                        }}
                                                    >
                                                        {promo.description || 'N/A'}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[2], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[2].minWidth
                                            }}>
                                                <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                                                    {promo.discount_type === DiscountTypeEnumFE.PERCENTAGE
                                                        ? `${promo.discount_value}%`
                                                        : `${promo.discount_value.toLocaleString('vi-VN')} VND`}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[3], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[3].minWidth
                                            }}>
                                                <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                                                    {promo.usage_count} / {promo.usage_limit || '∞'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[4], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[4].minWidth
                                            }}>
                                                <Chip
                                                    label={promo.is_active ? 'Hoạt động' : 'Không hoạt động'}
                                                    color={promo.is_active ? 'success' : 'default'}
                                                    size="small"
                                                    variant={promo.is_active ? "filled" : "outlined"}
                                                    sx={{
                                                        fontWeight: 'medium',
                                                        minWidth: '70px'
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[5], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[5].minWidth
                                            }}>
                                                <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                                                    {columnConfigs[5].format ? columnConfigs[5].format!(promo.start_date) : (promo.start_date || 'N/A')}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[6], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[6].minWidth
                                            }}>
                                                <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                                                    {columnConfigs[6].format ? columnConfigs[6].format!(promo.end_date) : (promo.end_date || 'N/A')}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[7], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[7].minWidth
                                            }}>
                                                <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>
                                                    {columnConfigs[7].format ? columnConfigs[7].format!(promo.created_at) : promo.created_at}
                                                </Typography>
                                            </TableCell>
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
                                                    {promo.is_active ? (
                                                        <Tooltip title="Hủy kích hoạt khuyến mãi">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleOpenDeactivateDialog(promo)}
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
                                                        <Tooltip title="Kích hoạt khuyến mãi">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleOpenActivateDialog(promo)}
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
                                                    <Tooltip title="Chỉnh sửa khuyến mãi">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleEditPromotion(promo.id)}
                                                            color="primary"
                                                        >
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title={promo.is_active ? "Không thể xóa mã khuyến mãi đang hoạt động. Vô hiệu hóa trước." : "Xóa mã khuyến mãi"}>
                                                        <span>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleOpenDeleteDialog(promo)}
                                                                color="error"
                                                                disabled={promo.is_active}
                                                                sx={{
                                                                    opacity: promo.is_active ? 0.5 : 1
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
                                    {Array.isArray(paginatedPromotions) && paginatedPromotions.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={columnConfigs.length} align="center">
                                                <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                                                    {isFiltering
                                                        ? "Không tìm thấy khuyến mãi nào phù hợp với tiêu chí tìm kiếm."
                                                        : "Chưa có khuyến mãi nào."
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
            </Paper>            {/* Delete Confirmation Dialog */}
            <Dialog
                open={openDeleteDialog}
                onClose={!deleteLoading ? handleCloseDeleteDialog : undefined}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ color: 'error.main' }}>
                    ⚠️ Xác nhận xóa mã khuyến mãi
                </DialogTitle>
                <DialogContent>
                    {promotionToDelete && (
                        <>
                            <Box sx={{
                                p: 1.5,
                                bgcolor: theme.palette.component.modal.noteBackground,
                                borderRadius: 1,
                                mb: 2,
                            }}>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    Mã: {promotionToDelete.promotion_code}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    Mô tả: {promotionToDelete.description || 'Không có'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    Giá trị giảm: {promotionToDelete.discount_value}{promotionToDelete.discount_type === DiscountTypeEnumFE.PERCENTAGE ? '%' : ' VND'}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Lượt sử dụng:
                                    </Typography>
                                    <Chip
                                        label={`${promotionToDelete.usage_count} / ${promotionToDelete.usage_limit || '∞'}`}
                                        size="small"
                                        color={promotionToDelete.usage_count > 0 ? "warning" : "default"}
                                    />
                                </Box>
                            </Box>

                            <Box sx={{
                                mb: 3,
                                p: 2,
                                bgcolor: theme.palette.component.modal.noteBackground,
                                borderRadius: 1,
                                border: `1px solid ${theme.palette.component.modal.noteBorder}`,
                                '&::before': {
                                    content: '""',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: '3px',
                                    bgcolor: 'error.main',
                                    borderRadius: borderRadiusTop('sm')
                                },
                                position: 'relative'
                            }}>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        color: 'error.main',
                                        mb: 2
                                    }}
                                >
                                    ⚠️ Cảnh báo quan trọng:
                                </Typography>

                                <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                                    • Hành động này không thể hoàn tác
                                </Typography>
                                <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                                    • Chỉ có thể xóa mã khuyến mãi đã được vô hiệu hóa
                                </Typography>
                                <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                                    • Dữ liệu mã khuyến mãi sẽ bị mất vĩnh viễn
                                </Typography>
                                <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                                    • Việc xóa có thể ảnh hưởng đến báo cáo và thống kê hệ thống
                                </Typography>
                            </Box>
                        </>
                    )}
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
                        onClick={handleDeletePromotion}
                        color="error"
                        variant="contained"
                        disabled={deleteLoading}
                        startIcon={deleteLoading ? <CircularProgress size={20} /> : null}
                    >
                        {deleteLoading ? 'Đang xóa...' : 'Xóa mã khuyến mãi'}
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
                    <Typography variant="h6" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'success.main' }}>
                        <ActivateIcon />
                        Xác nhận kích hoạt khuyến mãi
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        Bạn có chắc chắn muốn kích hoạt khuyến mãi này không?
                    </DialogContentText>

                    {actionPromotion && (
                        <Box sx={{
                            p: 2,
                            bgcolor: theme.palette.component.modal.noteBackground,
                            borderRadius: 1,
                            border: `1px solid ${theme.palette.component.modal.noteBorder}`,
                            mb: 2
                        }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Typography variant="body2">
                                    • <strong>Mã:</strong> {actionPromotion.promotion_code}
                                </Typography>
                                <Typography variant="body2">
                                    • <strong>Mô tả:</strong> {actionPromotion.description || 'Không có'}
                                </Typography>
                                <Typography variant="body2">
                                    • <strong>Giảm giá:</strong> {actionPromotion.discount_value}{actionPromotion.discount_type === DiscountTypeEnumFE.PERCENTAGE ? '%' : ' VNĐ'}
                                </Typography>
                                <Typography variant="body2">
                                    • <strong>Lượt sử dụng:</strong> {actionPromotion.usage_count} / {actionPromotion.usage_limit || '∞'}
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
                            • Khuyến mãi sẽ được kích hoạt và có thể được sử dụng trong hệ thống
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                            • Người dùng có thể áp dụng mã khuyến mãi này cho các giao dịch mới
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                            • Thao tác này có thể được hoàn tác bằng cách hủy kích hoạt
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
                        onClick={handleActivatePromotion}
                        color="success"
                        variant="contained"
                        sx={{ minWidth: 140 }}
                    >
                        Xác nhận kích hoạt
                    </Button>
                </DialogActions>
            </Dialog>

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
                        Xác nhận hủy kích hoạt khuyến mãi
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        Bạn có chắc chắn muốn hủy kích hoạt khuyến mãi này không?
                    </DialogContentText>

                    {actionPromotion && (
                        <Box sx={{
                            p: 2,
                            bgcolor: theme.palette.component.modal.noteBackground,
                            borderRadius: 1,
                            border: `1px solid ${theme.palette.component.modal.noteBorder}`,
                            mb: 2
                        }}>

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Typography variant="body2">
                                    • <strong>Mã:</strong> {actionPromotion.promotion_code}
                                </Typography>
                                <Typography variant="body2">
                                    • <strong>Mô tả:</strong> {actionPromotion.description || 'Không có'}
                                </Typography>
                                <Typography variant="body2">
                                    • <strong>Giảm giá:</strong> {actionPromotion.discount_value}{actionPromotion.discount_type === DiscountTypeEnumFE.PERCENTAGE ? '%' : ' VNĐ'}
                                </Typography>
                                <Typography variant="body2">
                                    • <strong>Lượt sử dụng:</strong> {actionPromotion.usage_count} / {actionPromotion.usage_limit || '∞'}
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
                            • Khuyến mãi sẽ được hủy kích hoạt và không thể sử dụng trong hệ thống
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                            • Người dùng sẽ không thể áp dụng mã khuyến mãi này cho các giao dịch mới
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
                        onClick={handleDeactivatePromotion}
                        color="error"
                        variant="contained"
                        sx={{ minWidth: 140 }}
                    >
                        Xác nhận hủy kích hoạt
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Create Promotion Modal */}
            <CreatePromotionModal
                open={openCreateModal}
                onClose={() => setOpenCreateModal(false)}
                onPromotionCreated={handlePromotionCreated}
            />

            {/* Edit Promotion Modal */}
            <EditPromotionModal
                open={openEditModal}
                onClose={() => {
                    setOpenEditModal(false);
                    setSelectedPromotion(null);
                }}
                promotion={selectedPromotion}
                onPromotionUpdated={handlePromotionUpdated}
            />
        </Box>
    );
}
