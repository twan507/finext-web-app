// finext-nextjs/app/admin/brokers/page.tsx
'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiClient } from 'services/apiClient';
import AdminBreadcrumb from '../components/AdminBreadcrumb';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Button, Chip, IconButton, Alert, CircularProgress,
    Tooltip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    TextField, useTheme, InputAdornment
} from '@mui/material';
import {
    BusinessCenter as BrokerIcon,
    Add as AddIcon,
    BusinessCenter as GrantIcon,
    DoDisturbOn as RevokeIcon,
    UnfoldMore as ExpandIcon,
    UnfoldLess as CollapseIcon,
    EditSquare as EditIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { getResponsiveFontSize, borderRadiusTop } from 'theme/tokens';
import BrokerSearch from './components/BrokerSearch';
import SortableTableHead from '../components/SortableTableHead';
import TablePaginationStyled from '../components/TablePaginationStyled';
import AddBrokerModal from './components/AddBrokerModal';
import {
    SortConfig,
    ColumnConfig,
    sortData,
    getNextSortDirection,
    getResponsiveDisplayStyle
} from '../components/TableSortUtils';
import { isSystemUser } from 'utils/systemProtection';

interface BrokerPublic {
    id: string;
    user_id: string;
    broker_code: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    user_email?: string; // Optional field for future use when backend provides it
}

interface PaginatedBrokersResponse {
    items: BrokerPublic[];
    total: number;
}

interface UserPublic {
    id: string;
    full_name: string;
    email: string;
    phone_number?: string | null;
    is_active?: boolean;
    role_ids: string[];
    referral_code?: string | null;
}

export default function BrokersPage() {
    const theme = useTheme();


    const [brokers, setBrokers] = useState<BrokerPublic[]>([]);
    const [filteredBrokers, setFilteredBrokers] = useState<BrokerPublic[]>([]);
    const [isFiltering, setIsFiltering] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0); const [openActionDialog, setOpenActionDialog] = useState(false);
    const [brokerToAction, setBrokerToAction] = useState<BrokerPublic | null>(null);
    const [actionType, setActionType] = useState<'revoke' | 'grant' | ''>(''); // 'revoke' for deactivating, 'grant' for activating
    const [actionLoading, setActionLoading] = useState(false);
    const [confirmEmail, setConfirmEmail] = useState('');

    // Add Broker Modal
    const [openAddBrokerModal, setOpenAddBrokerModal] = useState(false);
    const [allUsers, setAllUsers] = useState<UserPublic[]>([]);

    // Edit Broker Code
    const [openEditCodeDialog, setOpenEditCodeDialog] = useState(false);
    const [brokerToEditCode, setBrokerToEditCode] = useState<BrokerPublic | null>(null);
    const [newBrokerCode, setNewBrokerCode] = useState('');
    const [editCodeLoading, setEditCodeLoading] = useState(false);
    const [editCodeError, setEditCodeError] = useState<string | null>(null);// View and sorting state
    const [expandedView, setExpandedView] = useState(false);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
    const [userEmails, setUserEmails] = useState<Map<string, string>>(new Map());
    const [emailsLoading, setEmailsLoading] = useState(false);

    // Column configuration for sortable table
    const columnConfigs: ColumnConfig[] = useMemo(() => [
        {
            id: 'broker_code',
            label: 'Mã môi giới',
            sortable: true,
            sortType: 'string',
            accessor: (broker: BrokerPublic) => broker.broker_code,
            minWidth: 'auto',
        }, {
            id: 'user_id',
            label: 'Email người dùng',
            sortable: true,
            sortType: 'string',
            accessor: (broker: BrokerPublic) => userEmails.get(broker.user_id) || broker.user_email || broker.user_id,
            minWidth: 'auto',
        },
        {
            id: 'is_active',
            label: 'Trạng thái',
            sortable: true,
            sortType: 'boolean',
            accessor: (broker: BrokerPublic) => broker.is_active,
            minWidth: 'auto',
            responsive: { xs: 'none', sm: 'none' }
        },
        {
            id: 'created_at',
            label: 'Ngày tạo',
            sortable: true,
            sortType: 'date',
            accessor: (broker: BrokerPublic) => broker.created_at,
            minWidth: 'auto',
            responsive: { xs: 'none', sm: 'none', md: 'none', lg: 'none' }, format: (value: string) => {
                try {
                    // Parse UTC date and convert to GMT+7
                    const utcDate = parseISO(value);
                    const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
                    return format(gmt7Date, 'dd/MM/yyyy HH:mm');
                } catch (error) {
                    return 'Invalid date';
                }
            },
        }, {
            id: 'updated_at',
            label: 'Ngày cập nhật',
            sortable: true,
            sortType: 'date',
            accessor: (broker: BrokerPublic) => broker.updated_at,
            minWidth: 'auto',
            responsive: { xs: 'none', sm: 'none', md: 'none', lg: 'none' },
            format: (value: string) => {
                try {
                    // Parse UTC date and convert to GMT+7
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
            minWidth: 'auto',
            align: 'center' as const
        }
    ], [expandedView, userEmails]); const fetchBrokers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient<PaginatedBrokersResponse>({
                url: `/api/v1/brokers/?skip=${page * rowsPerPage}&limit=${rowsPerPage}`,
                method: 'GET',
            });
            if (response.status === 200 && response.data &&
                Array.isArray(response.data.items) && typeof response.data.total === 'number') {
                setBrokers(response.data.items);
                setTotalCount(response.data.total);
            } else {
                setError(response.message || 'Failed to load brokers or unexpected data structure.');
                setBrokers([]);
                setTotalCount(0);
            }
        } catch (err: any) {
            setError(err.message || 'Connection error or unauthorized access.');
            setBrokers([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage]);

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
    }, []); useEffect(() => {
        fetchBrokers();
    }, [fetchBrokers]);

    // Fetch user emails when brokers change
    useEffect(() => {
        const userIds = brokers.map(broker => broker.user_id);
        if (userIds.length > 0) {
            fetchUserEmails(userIds);
        }
    }, [brokers, fetchUserEmails]);    // Update filtered brokers when brokers change and not actively filtering
    useEffect(() => {
        if (!isFiltering) {
            setFilteredBrokers(brokers);
        }
    }, [brokers, isFiltering]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    }; const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleFilteredBrokers = (filtered: BrokerPublic[], isActivelyFiltering: boolean) => {
        setFilteredBrokers(filtered);
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
    const sortedBrokers = useMemo(() => {
        const dataToSort = isFiltering ? filteredBrokers : brokers;

        if (!sortConfig || !sortConfig.direction) {
            return dataToSort;
        }

        const column = columnConfigs.find(col => col.id === sortConfig.key);
        if (!column) return dataToSort;

        return sortData(dataToSort, sortConfig, column);
    }, [brokers, filteredBrokers, isFiltering, sortConfig, columnConfigs]);

    const handleToggleBrokerStatus = async (broker: BrokerPublic) => {
        const newStatus = !broker.is_active;
        const originalStatus = broker.is_active;

        // Optimistic UI update
        setBrokers(prev => prev.map(b => b.id === broker.id ? { ...b, is_active: newStatus, updated_at: new Date().toISOString() } : b));

        try {
            await apiClient<BrokerPublic>({
                url: `/api/v1/brokers/${broker.id}`,
                method: 'PUT',
                body: { is_active: newStatus }
            });
            // fetchBrokers(); // Or rely on optimistic update
        } catch (err: any) {
            setError(err.message || `Failed to update broker ${broker.broker_code} status.`);
            setBrokers(prev => prev.map(b => b.id === broker.id ? { ...b, is_active: originalStatus, updated_at: broker.updated_at } : b));
        }
    }; const handleOpenActionDialog = (broker: BrokerPublic, action: 'revoke' | 'grant') => {
        const brokerEmail = userEmails.get(broker.user_id) || broker.user_email || '';

        // Check if broker is a system user
        if (isSystemUser(brokerEmail)) {
            setError(`Không thể ${action === 'revoke' ? 'thu hồi' : 'khôi phục'} quyền môi giới hệ thống.`);
            return;
        }

        setBrokerToAction(broker);
        setActionType(action);
        setOpenActionDialog(true);
    }; const handleCloseActionDialog = () => {
        if (!actionLoading) {
            setBrokerToAction(null);
            setOpenActionDialog(false);
            setActionType('');
            setConfirmEmail('');
        }
    }; const handleConfirmAction = async () => {
        if (!brokerToAction || !actionType) return;

        // For revoke action, validate email confirmation
        if (actionType === 'revoke') {
            const brokerEmail = userEmails.get(brokerToAction.user_id) || brokerToAction.user_email;
            if (!confirmEmail.trim()) {
                setError('Vui lòng nhập email để xác nhận.');
                return;
            }
            if (confirmEmail.trim().toLowerCase() !== brokerEmail?.toLowerCase()) {
                setError('Xác nhận email không khớp. Vui lòng nhập chính xác địa chỉ email của môi giới.');
                return;
            }
        }

        setActionLoading(true);
        setError(null);

        try {
            if (actionType === 'revoke') {
                // Use DELETE endpoint to deactivate and revoke privileges
                await apiClient({
                    url: `/api/v1/brokers/${brokerToAction.id}`,
                    method: 'DELETE',
                });
            } else if (actionType === 'grant') {
                // Use PUT endpoint to reactivate broker
                await apiClient<BrokerPublic>({
                    url: `/api/v1/brokers/${brokerToAction.id}`,
                    method: 'PUT',
                    body: { is_active: true }
                });
            } fetchBrokers(); // Refresh the brokers list
            handleCloseActionDialog();
        } catch (error: any) {
            const actionText = actionType === 'revoke' ? 'thu hồi quyền' : 'khôi phục quyền';
            setError(error.message || `Đã xảy ra lỗi khi ${actionText} broker.`);
            handleCloseActionDialog();
        } finally {
            setActionLoading(false);
        }
    }; const fetchAllUsers = useCallback(async () => {
        try {
            const response = await apiClient<{ items: UserPublic[]; total: number }>({
                url: '/api/v1/users/?skip=0&limit=1000', // Get a large number to include all users
                method: 'GET',
            });

            if (response.status === 200 && response.data && Array.isArray(response.data.items)) {
                setAllUsers(response.data.items);
            } else {
                console.error('Failed to load users:', response.message);
            }
        } catch (err: any) {
            console.error('Failed to load users:', err.message);
        }
    }, []);

    const handleAddBroker = () => {
        setOpenAddBrokerModal(true);
    };

    const handleCloseAddBrokerModal = () => {
        setOpenAddBrokerModal(false);
    }; const handleBrokerAdded = () => {
        setOpenAddBrokerModal(false);
        fetchBrokers(); // Refresh the brokers list
    };

    const handleOpenEditCodeDialog = (broker: BrokerPublic) => {
        setBrokerToEditCode(broker);
        setNewBrokerCode(broker.broker_code);
        setEditCodeError(null);
        setOpenEditCodeDialog(true);
    };

    const handleCloseEditCodeDialog = () => {
        if (!editCodeLoading) {
            setOpenEditCodeDialog(false);
            setBrokerToEditCode(null);
            setNewBrokerCode('');
            setEditCodeError(null);
        }
    };

    const handleConfirmEditCode = async () => {
        if (!brokerToEditCode || !newBrokerCode.trim()) return;
        setEditCodeLoading(true);
        setEditCodeError(null);
        try {
            const response = await apiClient<BrokerPublic>({
                url: `/api/v1/brokers/${brokerToEditCode.id}/code`,
                method: 'PATCH',
                body: { broker_code: newBrokerCode.trim().toUpperCase() },
            });
            if (response.status === 200) {
                fetchBrokers();
                handleCloseEditCodeDialog();
            } else {
                setEditCodeError(response.message || 'Cập nhật mã thất bại.');
            }
        } catch (err: any) {
            setEditCodeError(err.message || 'Đã xảy ra lỗi.');
        } finally {
            setEditCodeLoading(false);
        }
    };

    // Fetch all users for add broker modal
    useEffect(() => {
        fetchAllUsers();
    }, [fetchAllUsers]);

    // Calculate paginated brokers - use server pagination when not filtering/sorting, client pagination when filtering/sorting
    const paginatedBrokers = React.useMemo(() => {
        if (isFiltering || sortConfig) {
            // Client-side pagination for filtered/sorted results
            if (rowsPerPage === 99999) {
                // Show all results
                return sortedBrokers;
            }
            const startIndex = page * rowsPerPage;
            const endIndex = startIndex + rowsPerPage;
            return sortedBrokers.slice(startIndex, endIndex);
        } else {
            // Server-side pagination - use brokers directly as they are already paginated
            return brokers;
        }
    }, [brokers, sortedBrokers, isFiltering, sortConfig, page, rowsPerPage]);

    // Calculate total count for pagination
    const displayTotalCount = (isFiltering || sortConfig) ? sortedBrokers.length : totalCount;

    return (
        <Box sx={{
            maxWidth: '100%',
            overflow: 'hidden'
        }}>
            {/* Breadcrumb */}
            <AdminBreadcrumb />

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <BrokerIcon sx={{ mr: 1, fontSize: 24 }} />
                    <Typography
                        variant="h3"
                        component="h1"
                    >
                        Quản lý Brokers
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
                        onClick={handleAddBroker}
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
                            Tạo Broker
                        </Box>
                    </Button>
                </Box>
            </Box>

            {error && (
                <Alert
                    severity="error"
                    sx={{
                        mb: 2,
                        fontSize: getResponsiveFontSize('sm'),
                        '& .MuiAlert-message': {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }
                    }}
                >
                    {error}
                </Alert>
            )}            <BrokerSearch
                brokers={brokers}
                onFilteredBrokers={handleFilteredBrokers}
                loading={loading}
                userEmails={userEmails}
            />
            <Paper sx={{
                width: '100%',
                overflow: 'hidden',
                borderRadius: 2
            }}>
                {loading && brokers.length === 0 ? (
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
                                    {Array.isArray(paginatedBrokers) && paginatedBrokers.map((broker) => (
                                        <TableRow
                                            hover
                                            key={broker.id}
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
                                                    label={broker.broker_code}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ fontWeight: 'medium' }}
                                                />                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[1], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[1].minWidth,
                                                width: expandedView ? 'auto' : columnConfigs[1].minWidth
                                            }}>
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        fontSize: getResponsiveFontSize('sm'),
                                                        opacity: emailsLoading ? 0.7 : 1
                                                    }}
                                                >
                                                    {userEmails.get(broker.user_id) || broker.user_email || broker.user_id}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[2], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal',
                                                minWidth: columnConfigs[2].minWidth,
                                                width: expandedView ? 'auto' : columnConfigs[2].minWidth
                                            }}>                                                <Chip
                                                    label={broker.is_active ? 'Hoạt động' : 'Không hoạt động'}
                                                    size="small"
                                                    color={broker.is_active ? "success" : "default"}
                                                    variant={broker.is_active ? "filled" : "outlined"}
                                                    sx={{
                                                        fontWeight: 'medium',
                                                        minWidth: '70px'
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[3], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal', minWidth: columnConfigs[3].minWidth,
                                                width: expandedView ? 'auto' : columnConfigs[3].minWidth
                                            }}>                                                <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>                                                    {(() => {
                                                if (!broker.created_at) return 'N/A';
                                                try {
                                                    // Parse UTC date and convert to GMT+7
                                                    const utcDate = parseISO(broker.created_at);
                                                    const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
                                                    return format(gmt7Date, 'dd/MM/yyyy HH:mm');
                                                } catch (error) {
                                                    return 'Ngày không hợp lệ';
                                                }
                                            })()}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{
                                                ...getResponsiveDisplayStyle(columnConfigs[4], expandedView),
                                                whiteSpace: expandedView ? 'nowrap' : 'normal', minWidth: columnConfigs[4].minWidth,
                                                width: expandedView ? 'auto' : columnConfigs[4].minWidth
                                            }}>                                                <Typography sx={{ fontSize: getResponsiveFontSize('sm') }}>                                                    {(() => {
                                                if (!broker.updated_at) return 'N/A';
                                                try {
                                                    // Parse UTC date and convert to GMT+7
                                                    const utcDate = parseISO(broker.updated_at);
                                                    const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
                                                    return format(gmt7Date, 'dd/MM/yyyy HH:mm');
                                                } catch (error) {
                                                    return 'Ngày không hợp lệ';
                                                }
                                            })()}</Typography>
                                            </TableCell>
                                            <TableCell
                                                sx={{
                                                    ...getResponsiveDisplayStyle(columnConfigs[5], expandedView),
                                                    position: 'sticky',
                                                    right: -1, // Slight negative to eliminate gap
                                                    backgroundColor: 'background.paper',
                                                    zIndex: 1,
                                                    minWidth: expandedView ? 'auto' : 100,
                                                    width: 'auto',
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
                                            >                                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                                    <Tooltip title="Đổi mã broker">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleOpenEditCodeDialog(broker)}
                                                            color="primary"
                                                            sx={{
                                                                minWidth: { xs: 32, sm: 'auto' },
                                                                width: { xs: 32, sm: 'auto' },
                                                                height: { xs: 32, sm: 'auto' },
                                                            }}
                                                        >
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    {(() => {
                                                        const brokerEmail = userEmails.get(broker.user_id) || broker.user_email || '';
                                                        const isSystemBroker = isSystemUser(brokerEmail);

                                                        if (broker.is_active) {
                                                            return (
                                                                <Tooltip title={isSystemBroker ? "Không thể thu hồi quyền môi giới hệ thống" : "Thu hồi quyền"}>
                                                                    <span>
                                                                        <IconButton
                                                                            size="small"
                                                                            onClick={() => handleOpenActionDialog(broker, 'revoke')}
                                                                            color="error"
                                                                            disabled={isSystemBroker}
                                                                            sx={{
                                                                                minWidth: { xs: 32, sm: 'auto' },
                                                                                width: { xs: 32, sm: 'auto' },
                                                                                height: { xs: 32, sm: 'auto' },
                                                                                opacity: isSystemBroker ? 0.5 : 1
                                                                            }}
                                                                        >
                                                                            <RevokeIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </span>
                                                                </Tooltip>
                                                            );
                                                        } else {
                                                            return (
                                                                <Tooltip title={isSystemBroker ? "Không thể khôi phục quyền môi giới hệ thống" : "Khôi phục quyền"}>
                                                                    <span>
                                                                        <IconButton
                                                                            size="small"
                                                                            onClick={() => handleOpenActionDialog(broker, 'grant')}
                                                                            color="warning"
                                                                            disabled={isSystemBroker}
                                                                            sx={{
                                                                                minWidth: { xs: 32, sm: 'auto' },
                                                                                width: { xs: 32, sm: 'auto' },
                                                                                height: { xs: 32, sm: 'auto' },
                                                                                opacity: isSystemBroker ? 0.5 : 1
                                                                            }}
                                                                        >
                                                                            <GrantIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </span>
                                                                </Tooltip>
                                                            );
                                                        }
                                                    })()}
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {Array.isArray(paginatedBrokers) && paginatedBrokers.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={6} align="center">
                                                <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                                                    {isFiltering ? 'Không tìm thấy môi giới nào phù hợp với bộ lọc.' : 'Không có môi giới nào.'}
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
            </Paper>            <Dialog
                open={openActionDialog}
                onClose={!actionLoading ? handleCloseActionDialog : undefined}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{
                    color: actionType === 'revoke' ? 'error.main' : 'warning.main',
                    fontWeight: 'bold'
                }}>
                    {actionType === 'revoke' ? '⚠️ Xác nhận thu hồi quyền môi giới' : '🔄 Xác nhận khôi phục quyền môi giới'}
                </DialogTitle>
                <DialogContent>
                    {/* Broker Information */}
                    <Box sx={{
                        p: 1.5,
                        bgcolor: theme.palette.component.modal.noteBackground,
                        borderRadius: 1,
                        mb: 2,
                    }}>
                        <Typography variant="body1" fontWeight="bold">
                            Mã môi giới: {brokerToAction?.broker_code}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {userEmails.get(brokerToAction?.user_id || '') || brokerToAction?.user_email || 'Đang tải...'}
                        </Typography>
                    </Box>

                    {/* Warning/Information Box */}
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
                            bgcolor: actionType === 'revoke' ? 'error.main' : 'warning.main',
                            borderRadius: borderRadiusTop('sm')
                        },
                        position: 'relative'
                    }}>
                        <Typography
                            variant="body2"
                            fontWeight="bold"
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                color: actionType === 'revoke' ? 'error.main' : 'warning.main',
                                mb: 2
                            }}
                        >
                            {actionType === 'revoke' ? '⚠️ Cảnh báo quan trọng:' : 'ℹ️ Thông tin quan trọng:'}
                        </Typography>

                        {actionType === 'revoke' ? (
                            <>

                                <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText, mb: 1 }}>
                                    • Tất cả quyền lợi và chức năng môi giới sẽ bị thu hồi
                                </Typography>
                                <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText, mb: 1 }}>
                                    • Các subscription liên quan có thể bị ảnh hưởng
                                </Typography>
                                <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText, mb: 1 }}>
                                    • Hành động này có thể được hoàn tác bằng cách khôi phục quyền
                                </Typography>
                                <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                                    • Mã môi giới sẽ được giữ lại để có thể khôi phục sau này
                                </Typography>
                            </>
                        ) : (
                            <>
                                <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText, mb: 1 }}>
                                    • Môi giới sẽ được kích hoạt lại
                                </Typography>
                                <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText, mb: 1 }}>
                                    • Tất cả quyền lợi và chức năng môi giới sẽ được khôi phục
                                </Typography>
                                <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText, mb: 1 }}>
                                    • Môi giới có thể bắt đầu hoạt động ngay lập tức
                                </Typography>
                                <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText, mb: 1 }}>
                                    • Các subscription và quyền lợi trước đó sẽ được khôi phục
                                </Typography>
                                <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                                    • Mã môi giới và dữ liệu liên quan sẽ được kích hoạt lại
                                </Typography>
                            </>)}
                    </Box>

                    {/* Email Confirmation Field - Only for revoke action */}
                    {actionType === 'revoke' && (
                        <Box sx={{ mb: 3 }}>
                            <TextField
                                fullWidth
                                label="Nhập địa chỉ email để xác nhận"
                                variant="outlined"
                                value={confirmEmail}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmEmail(e.target.value)}
                                placeholder={userEmails.get(brokerToAction?.user_id || '') || brokerToAction?.user_email || ''}
                                helperText="Email phải khớp chính xác với email của môi giới (không phân biệt chữ hoa thường)"
                                disabled={actionLoading}
                                error={!!error && (error.includes('email') || error.includes('Email'))}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        '&.Mui-focused fieldset': {
                                            borderColor: 'error.main'
                                        }
                                    }
                                }}
                            />
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 1 }}>
                    <Button
                        onClick={handleCloseActionDialog}
                        disabled={actionLoading}
                        variant="outlined"
                    >
                        Hủy
                    </Button>
                    <Button
                        onClick={handleConfirmAction}
                        color={actionType === 'revoke' ? 'error' : 'warning'}
                        variant="contained"
                        disabled={actionLoading}
                        startIcon={actionLoading ? <CircularProgress size={20} /> : null}
                    >
                        {actionLoading
                            ? (actionType === 'revoke' ? 'Đang thu hồi...' : 'Đang khôi phục...')
                            : (actionType === 'revoke' ? 'Xác nhận thu hồi quyền' : 'Xác nhận khôi phục quyền')
                        }
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Broker Code Dialog */}
            <Dialog
                open={openEditCodeDialog}
                onClose={editCodeLoading ? undefined : handleCloseEditCodeDialog}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: 2 } }}
            >
                <DialogTitle>
                    <Typography variant="h5" component="div" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EditIcon color="primary" />
                        Đổi mã broker
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {userEmails.get(brokerToEditCode?.user_id || '') || brokerToEditCode?.user_id}
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    {editCodeError && (
                        <Alert severity="error" onClose={() => setEditCodeError(null)} sx={{ mb: 3 }}>
                            {editCodeError}
                        </Alert>
                    )}
                    <Box sx={{ mt: 1 }}>
                        <TextField
                            autoFocus
                            fullWidth
                            label="Mã broker mới *"
                            placeholder="VD: PARTNER01"
                            value={newBrokerCode}
                            onChange={(e) => setNewBrokerCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4))}
                            onKeyUp={(e) => { if (e.key === 'Enter') handleConfirmEditCode(); }}
                            inputProps={{ maxLength: 4 }}
                            helperText={`Chữ cái và số, đúng 4 ký tự · Hiện tại: ${brokerToEditCode?.broker_code} · ${newBrokerCode.length}/4`}
                            error={newBrokerCode.length > 0 && newBrokerCode.length < 4}
                            disabled={editCodeLoading}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <BrokerIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Box>
                    <Box sx={{
                        mt: 3, p: 2,
                        bgcolor: theme.palette.component.modal.noteBackground,
                        borderRadius: 1,
                        border: `1px solid ${theme.palette.component.modal.noteBorder}`,
                        position: 'relative',
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0, left: 0, right: 0,
                            height: '3px',
                            bgcolor: 'warning.main',
                            borderRadius: borderRadiusTop('sm'),
                        },
                    }}>
                        <Typography variant="body2" fontWeight="bold" sx={{ color: 'warning.main', mb: 1 }}>
                            ⚠️ Lưu ý:
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText, mb: 0.5 }}>
                            • Mã broker mới sẽ được đồng bộ với mã giới thiệu của tài khoản
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.component.modal.noteText }}>
                            • Mã cũ sẽ không còn hoạt động sau khi thay đổi
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 1 }}>
                    <Button
                        onClick={handleCloseEditCodeDialog}
                        disabled={editCodeLoading}
                        variant="outlined"
                        startIcon={<CloseIcon />}
                        sx={{
                            minWidth: { xs: 'auto', sm: 100 },
                            '& .MuiButton-startIcon': { margin: { xs: 0, sm: '0 8px 0 -4px' } },
                            px: { xs: 1, sm: 2 },
                        }}
                    >
                        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>Hủy</Box>
                    </Button>
                    <Button
                        onClick={handleConfirmEditCode}
                        variant="contained"
                        disabled={editCodeLoading || newBrokerCode.length !== 4 || newBrokerCode === brokerToEditCode?.broker_code}
                        startIcon={editCodeLoading ? <CircularProgress size={20} /> : <EditIcon />}
                        sx={{
                            minWidth: { xs: 'auto', sm: 140 },
                            '& .MuiButton-startIcon': { margin: { xs: 0, sm: '0 8px 0 -4px' } },
                            px: { xs: 1, sm: 2 },
                        }}
                    >
                        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                            {editCodeLoading ? 'Đang cập nhật...' : 'Cập nhật'}
                        </Box>
                    </Button>
                </DialogActions>
            </Dialog>

            <AddBrokerModal
                open={openAddBrokerModal}
                onClose={handleCloseAddBrokerModal}
                onBrokerAdded={handleBrokerAdded}
                allUsers={allUsers}
            />
        </Box>
    );
}