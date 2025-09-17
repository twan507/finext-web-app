// finext-nextjs/app/admin/users/page.tsx
'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiClient } from 'services/apiClient';
import AdminBreadcrumb from '../components/AdminBreadcrumb';
import {
  Box, Typography, Paper, TableContainer, TextField,
  Table, TableHead, TableRow, TableCell, TableBody, Chip, IconButton,
  Alert, Button, TablePagination, Avatar, Tooltip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  useTheme
} from '@mui/material';
import {
  Add as AddIcon, EditSquare as EditIcon, Delete as DeleteIcon,
  UnfoldMore as ExpandIcon, UnfoldLess as CollapseIcon,
  People
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { colorTokens, responsiveTypographyTokens } from 'theme/tokens';
import UserSearch from './components/UserSearch';
import AddUserModal from './components/AddUserModal';
import EditUserModal from './components/EditUserModal';
import SortableTableHead from '../components/SortableTableHead';
import {
  SortConfig,
  ColumnConfig,
  sortData,
  getNextSortDirection,
  getResponsiveDisplayStyle
} from '../components/TableSortUtils';
import { isSystemUser } from 'utils/systemProtection';

// Interface for User data (matching UserPublic from backend)
interface UserPublic {
  id: string;
  role_ids: string[];
  full_name: string;
  email: string;
  phone_number?: string | null;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
  avatar_url?: string | null;
  referral_code?: string | null;
  google_id?: string | null;
  subscription_id?: string | null;
}

// Interface for Role data
interface RolePublic {
  id: string;
  name: string;
  description?: string;
  permission_ids: string[];
  created_at: string;
  updated_at: string;
}

// Interface for Subscription data
interface SubscriptionPublic {
  id: string;
  user_id: string;
  user_email: string;
  license_id: string;
  license_key: string;
  is_active: boolean;
  start_date: string;
  expiry_date: string;
  created_at: string;
  updated_at: string;
}

// Expected structure for paginated API response within StandardApiResponse.data
interface PaginatedUsersResponse {
  items: UserPublic[];
  total: number;
}

const UsersPage: React.FC = () => {
  const theme = useTheme();
  const componentColors = theme.palette.mode === 'light'
    ? colorTokens.lightComponentColors
    : colorTokens.darkComponentColors;

  const [users, setUsers] = useState<UserPublic[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserPublic[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);
  const [roles, setRoles] = useState<RolePublic[]>([]);
  const [subscriptions, setSubscriptions] = useState<Map<string, SubscriptionPublic>>(new Map());
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [protectedEmails, setProtectedEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserPublic | null>(null);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false); const [expandedView, setExpandedView] = useState(false);
  const [openAddUserModal, setOpenAddUserModal] = useState(false);
  const [openEditUserModal, setOpenEditUserModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserPublic | null>(null);
  // Sorting state
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);  // Column configuration for sortable table - using useMemo to include latest subscriptions state
  const columnConfigs: ColumnConfig[] = useMemo(() => [
    {
      id: 'full_name',
      label: 'Họ tên và Email',
      sortable: true,
      sortType: 'string',
      accessor: (user: UserPublic) => user.full_name || user.email,
      minWidth: expandedView ? 'auto' : 200
      // No responsive config - always show in both compact and expanded view
    }, {
      id: 'phone_number',
      label: 'Số điện thoại',
      sortable: true,
      sortType: 'string',
      accessor: (user: UserPublic) => user.phone_number || '',
      minWidth: expandedView ? 'auto' : 120,
      responsive: { xs: 'none', sm: 'none' } // Hide from sm breakpoint down in compact view
    }, {
      id: 'subscription',
      label: 'Gói đăng ký',
      sortable: true,
      sortType: 'string',
      accessor: (user: UserPublic) => {
        const subscription = subscriptions.get(user.id);
        if (!subscription) return 'Basic';
        const isActive = subscription.is_active && new Date(subscription.expiry_date) > new Date(); return isActive ? subscription.license_key || 'Premium' : 'Expired';
      },
      minWidth: expandedView ? 'auto' : 140,
      responsive: { xs: 'none' } // Hide only at xs breakpoint in compact view
    }, {
      id: 'is_active',
      label: 'Trạng thái',
      sortable: true,
      sortType: 'boolean',
      accessor: (user: UserPublic) => user.is_active,
      minWidth: expandedView ? 'auto' : 100,
      responsive: { xs: 'none', sm: 'none' } // Hide from sm breakpoint down in compact view
    },
    {
      id: 'roles',
      label: 'Vai trò',
      sortable: true,
      sortType: 'string',
      accessor: (user: UserPublic) => {
        const roleNames = (user.role_ids || []).map(roleId => {
          const role = roles.find(r => r.id === roleId);
          return role ? role.name : roleId;
        });
        return roleNames.join(', ');
      },
      minWidth: expandedView ? 'auto' : 120,
      responsive: { xs: 'none', sm: 'none', md: 'none', lg: 'none' } // Only show in expanded view
    },
    {
      id: 'created_at',
      label: 'Ngày tham gia',
      sortable: true,
      sortType: 'date',
      accessor: (user: UserPublic) => user.created_at,
      minWidth: expandedView ? 'auto' : 100,
      responsive: { xs: 'none', sm: 'none', md: 'none', lg: 'none' }, // Only show in expanded view
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
      id: 'updated_at',
      label: 'Ngày cập nhật',
      sortable: true,
      sortType: 'date',
      accessor: (user: UserPublic) => user.updated_at,
      minWidth: expandedView ? 'auto' : 100,
      responsive: { xs: 'none', sm: 'none', md: 'none', lg: 'none' }, // Only show in expanded view
    },
    {
      id: 'referral_code',
      label: 'Mã giới thiệu',
      sortable: true,
      sortType: 'string',
      accessor: (user: UserPublic) => user.referral_code || '',
      minWidth: expandedView ? 'auto' : 120,
      responsive: { xs: 'none', sm: 'none', md: 'none', lg: 'none' } // Only show in expanded view
    },
    {
      id: 'login_method',
      label: 'Phương thức',
      sortable: true,
      sortType: 'string',
      accessor: (user: UserPublic) => user.google_id ? 'Google' : 'Credentials',
      minWidth: expandedView ? 'auto' : 100,
      responsive: { xs: 'none', sm: 'none', md: 'none', lg: 'none' } // Only show in expanded view
    }, {
      id: 'actions',
      label: '',
      sortable: false,
      sortType: 'string',
      accessor: () => '',
      minWidth: expandedView ? 'auto' : 80,
      align: 'center' as const
    }
  ], [subscriptions, roles, expandedView]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Expecting StandardApiResponse<PaginatedUsersResponse>
      const response = await apiClient<PaginatedUsersResponse>({
        url: `/api/v1/users/?skip=${page * rowsPerPage}&limit=${rowsPerPage}`,
        method: 'GET',
      });

      if (response.status === 200 && response.data &&
        Array.isArray(response.data.items) && typeof response.data.total === 'number') {
        setUsers(response.data.items);
        setTotalCount(response.data.total);
      } else {
        // Fallback or error if structure is not as expected
        setError(response.message || 'Failed to load users or unexpected data structure.');
        setUsers([]);
        setTotalCount(0);
      }
    } catch (err: any) {
      setError(err.message || 'Connection error or unauthorized access.');
      setUsers([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage]);

  const fetchRoles = useCallback(async () => {
    try {
      const response = await apiClient<{ items: RolePublic[]; total: number }>({
        url: `/api/v1/roles/?skip=0&limit=200`,
        method: 'GET',
      });

      if (response.status === 200 && response.data && Array.isArray(response.data.items)) {
        setRoles(response.data.items);
      }
    } catch (err: any) {
      console.error('Failed to load roles:', err.message);
    }
  }, []);

  const fetchProtectedEmails = useCallback(async () => {
    try {
      const response = await apiClient<string[]>({
        url: `/api/v1/users/protected-emails`,
        method: 'GET',
      });

      if (response.status === 200 && response.data && Array.isArray(response.data)) {
        setProtectedEmails(response.data);
      }
    } catch (err: any) {
      console.error('Failed to load protected emails:', err.message);
    }
  }, []);

  const fetchSubscriptions = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return;

    setSubscriptionsLoading(true);
    const subscriptionsMap = new Map<string, SubscriptionPublic>();

    try {
      // Get user details to access subscription_id
      const usersWithSubscriptionIds = users.filter(user => user.subscription_id);

      // Process all requests in parallel for fastest loading
      const subscriptionPromises = usersWithSubscriptionIds.map(async (user) => {
        try {
          // Use subscription_id to directly fetch the assigned subscription
          const response = await apiClient<SubscriptionPublic>({
            url: `/api/v1/subscriptions/${user.subscription_id}`,
            method: 'GET',
          });

          if (response.status === 200 && response.data) {
            return { userId: user.id, subscription: response.data };
          }
        } catch (err) {
          console.warn(`Failed to load subscription for user ${user.id}`);
        }
        return null;
      });

      const results = await Promise.all(subscriptionPromises);

      results.forEach(result => {
        if (result) {
          subscriptionsMap.set(result.userId, result.subscription);
        }
      });

      setSubscriptions(subscriptionsMap);
    } catch (err: any) {
      console.error('Failed to load subscriptions:', err.message);
    } finally {
      setSubscriptionsLoading(false);
    }
  }, [users]);

  useEffect(() => {
    fetchRoles();
    fetchProtectedEmails();
  }, [fetchRoles, fetchProtectedEmails]);
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Update filtered users when users change and not actively filtering
  useEffect(() => {
    if (!isFiltering) {
      setFilteredUsers(users);
    }
  }, [users, isFiltering]);
  useEffect(() => {
    if (users.length > 0) {
      const userIds = users.map(user => user.id);
      fetchSubscriptions(userIds);
    }
  }, [users, fetchSubscriptions]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    setRowsPerPage(value);
    setPage(0);
  };
  const handleFilteredUsers = (filtered: UserPublic[], isActivelyFiltering: boolean) => {
    setFilteredUsers(filtered);
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
  const sortedUsers = useMemo(() => {
    const dataToSort = isFiltering ? filteredUsers : users;

    if (!sortConfig || !sortConfig.direction) {
      return dataToSort;
    }

    const column = columnConfigs.find(col => col.id === sortConfig.key);
    if (!column) return dataToSort;

    return sortData(dataToSort, sortConfig, column);
  }, [users, filteredUsers, isFiltering, sortConfig, columnConfigs, subscriptions, roles]);
  const handleOpenDeleteDialog = (user: UserPublic) => {
    // Check if user is protected
    if (isUserProtected(user.email)) {
      setError('Không thể xóa tài khoản người dùng được bảo vệ.');
      return;
    }

    // Check if user has roles other than just "user" (frontend validation for better UX)
    const userRoleNames = getRoleNames(user.role_ids || []);
    const hasNonUserRoles = userRoleNames.some(roleName =>
      roleName.toLowerCase() !== 'user'
    );

    if (hasNonUserRoles) {
      const nonUserRoles = userRoleNames.filter(roleName =>
        roleName.toLowerCase() !== 'user'
      );
      setError(`Không thể xóa người dùng '${user.email}' vì họ có thêm các vai trò: ${nonUserRoles.join(', ')}. Vui lòng thu hồi các vai trò này trước khi xóa người dùng.`);
      return;
    }

    setUserToDelete(user);
    setDeleteConfirmEmail('');
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setUserToDelete(null);
    setDeleteConfirmEmail('');
    setDeleteLoading(false);
    setOpenDeleteDialog(false);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;    // Validate email confirmation
    if (deleteConfirmEmail.trim().toLowerCase() !== userToDelete.email.toLowerCase()) {
      setError('Xác nhận email không khớp. Vui lòng nhập chính xác địa chỉ email.');
      return;
    }    // Double check if user is protected
    if (isUserProtected(userToDelete.email)) {
      setError('Không thể xóa tài khoản người dùng được bảo vệ.');
      return;
    }

    setDeleteLoading(true);
    setError(null);

    try {
      const response = await apiClient({
        url: `/api/v1/users/${userToDelete.id}`,
        method: 'DELETE',
      });

      if (response.status === 200) {
        fetchUsers(); // Refresh list
        handleCloseDeleteDialog();
        // Optional: show success message
        // setSuccess(`User ${userToDelete.full_name} has been deleted successfully.`);      } else {
        setError(response.message || 'Không thể xóa người dùng.');
      }
    } catch (delError: any) {
      console.error('Delete user error:', delError);      // Handle specific role-based validation errors with more user-friendly messages
      let errorMessage = delError.message || 'Đã xảy ra lỗi khi xóa người dùng.';

      // Check if it's a role-based validation error (HTTP 400)
      if (delError.status === 400 && delError.message) {
        if (delError.message.includes('vai trò') || delError.message.includes('roles')) {
          // This is likely our role-based validation error - display it as-is since it's already user-friendly
          errorMessage = delError.message;
        } else if (delError.message.includes('Đối tác') || delError.message.includes('broker')) {
          // This is likely a broker-related validation error
          errorMessage = delError.message;
        }
      }

      setError(errorMessage);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleAddUser = () => {
    setOpenAddUserModal(true);
  };

  const handleCloseAddUserModal = () => {
    setOpenAddUserModal(false);
  };
  const handleUserAdded = () => {
    fetchUsers(); // Refresh the users list
  };

  const handleEditUser = (user: UserPublic) => {
    setUserToEdit(user);
    setOpenEditUserModal(true);
  };

  const handleCloseEditUserModal = () => {
    setUserToEdit(null);
    setOpenEditUserModal(false);
  };

  const handleUserUpdated = () => {
    fetchUsers(); // Refresh the users list
  };

  // Helper function to get role names from role IDs
  const getRoleNames = (roleIds: string[]): string[] => {
    return roleIds.map(roleId => {
      const role = roles.find(r => r.id === roleId);
      return role ? role.name : roleId;
    });
  };
  // Helper function to get subscription info
  const getSubscriptionInfo = (userId: string): { status: string; color: 'success' | 'default' | 'primary'; details?: SubscriptionPublic; loading?: boolean } => {
    // If subscriptions are still loading, show loading state
    if (subscriptionsLoading) {
      return { status: '...', color: 'primary', loading: true };
    }

    // Check if user has subscription_id assigned
    const user = users.find(u => u.id === userId);
    if (!user?.subscription_id) {
      return { status: 'Basic', color: 'default' };
    }

    const subscription = subscriptions.get(userId);
    if (!subscription) {
      // User has subscription_id but we couldn't fetch the subscription details
      // This might indicate an issue or the subscription is still loading
      return { status: 'Loading...', color: 'primary' };
    }

    const isActive = subscription.is_active && new Date(subscription.expiry_date) > new Date();

    // For better display, show the actual license key for active subscriptions
    // or "Expired" with the license key for inactive ones
    let displayStatus = subscription.license_key;
    if (!isActive) {
      displayStatus = `${subscription.license_key} (Expired)`;
    }

    return {
      status: displayStatus,
      color: isActive ? 'success' : 'default',
      details: subscription
    };
  };
  // Helper function to check if a user is protected
  const isUserProtected = (userEmail: string): boolean => {
    return protectedEmails.includes(userEmail) || isSystemUser(userEmail);
  };
  // Calculate paginated users - use server pagination when not filtering/sorting, client pagination when filtering/sorting
  const paginatedUsers = React.useMemo(() => {
    if (isFiltering || sortConfig) {
      // Client-side pagination for filtered/sorted results
      if (rowsPerPage === 99999) {
        // Show all results
        return sortedUsers;
      }
      const startIndex = page * rowsPerPage;
      const endIndex = startIndex + rowsPerPage;
      return sortedUsers.slice(startIndex, endIndex);
    } else {
      // Server-side pagination - use users directly as they are already paginated
      return users;
    }
  }, [users, sortedUsers, isFiltering, sortConfig, page, rowsPerPage]);
  // Calculate total count for pagination
  const displayTotalCount = (isFiltering || sortConfig) ? sortedUsers.length : totalCount;

  return (
    <Box sx={{
      maxWidth: '100%',
      overflow: 'hidden'
    }}>
      {/* Breadcrumb */}
      <AdminBreadcrumb />

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <People sx={{ mr: 1 }} />
          <Typography
            variant="h3"
            component="h1"
          >
            Quản lý Users
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
            onClick={handleAddUser}
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
              Tạo User
            </Box>
          </Button>
        </Box>
      </Box>
      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 2,
            ...responsiveTypographyTokens.body2,
            '& .MuiAlert-message': {
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }
          }}
        >
          {error}
        </Alert>
      )}
      <UserSearch
        users={users}
        roles={roles}
        subscriptions={subscriptions}
        subscriptionsLoading={subscriptionsLoading}
        protectedEmails={protectedEmails}
        onFilteredUsers={handleFilteredUsers}
        loading={loading}
      />
      <Paper sx={{
        width: '100%',
        overflow: 'hidden',
        borderRadius: 2,
      }}>
        {loading && users.length === 0 ? (
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
                  {Array.isArray(paginatedUsers) && paginatedUsers.map((user) => (
                    <TableRow
                      hover
                      key={user.id}
                      sx={{
                        '&:hover': {
                          backgroundColor: componentColors.tableRow.hover
                        }
                      }}
                    >
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[0], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[0].minWidth,
                        width: expandedView ? 'auto' : columnConfigs[0].minWidth
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar src={user.avatar_url || undefined} sx={{ mr: 2, width: 25, height: 25 }}>
                            {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography
                              variant="body1"
                              fontWeight="medium"
                              sx={{
                                mb: 0.5,
                                ...responsiveTypographyTokens.body1,
                                lineHeight: 1.2
                              }}
                            >
                              {user.full_name}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                ...responsiveTypographyTokens.body2,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {user.email}
                            </Typography>
                          </Box>                    </Box>
                      </TableCell>
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[1], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[1].minWidth,
                        width: expandedView ? 'auto' : columnConfigs[1].minWidth
                      }}>                    <Typography sx={responsiveTypographyTokens.tableCell}>
                          {user.phone_number || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[2], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[2].minWidth,
                        width: expandedView ? 'auto' : columnConfigs[2].minWidth
                      }}>
                        {(() => {
                          const subscriptionInfo = getSubscriptionInfo(user.id);
                          return (<Tooltip title={
                            subscriptionInfo.loading ?
                              'Loading subscription info...' :
                              subscriptionInfo.details ?
                                (() => {
                                  try {
                                    // Parse UTC date and convert to GMT+7
                                    const utcDate = parseISO(subscriptionInfo.details.expiry_date);
                                    const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
                                    return `Expires: ${format(gmt7Date, 'dd/MM/yyyy HH:mm')}`;
                                  } catch (error) {
                                    return 'Expires: Invalid date';
                                  }
                                })() :
                                'No active subscription'
                          }>
                            <Chip
                              label={subscriptionInfo.loading ?
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <CircularProgress
                                    size={12}
                                    sx={{
                                      color: 'inherit',
                                      '& .MuiCircularProgress-svg': {
                                        filter: (theme) => theme.palette.mode === 'dark' ? 'brightness(1.2)' : 'brightness(0.8)'
                                      }
                                    }}
                                  />
                                  <Typography variant="caption">Loading...</Typography>
                                </Box> :
                                subscriptionInfo.status
                              }
                              color={subscriptionInfo.color}
                              size="small"
                              sx={subscriptionInfo.loading ? {
                                '& .MuiChip-label': {
                                  color: (theme) => theme.palette.mode === 'dark' ? '#003768' : '#e6f7ff'
                                }
                              } : {}}
                            />
                          </Tooltip>);
                        })()}
                      </TableCell>
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[3], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[3].minWidth,
                        width: expandedView ? 'auto' : columnConfigs[3].minWidth
                      }}>                    <Chip
                          label={user.is_active ? 'Active' : 'Inactive'}
                          color={user.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[4], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[4].minWidth,
                        width: expandedView ? 'auto' : columnConfigs[4].minWidth
                      }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {user.role_ids?.length > 0 ? (
                            getRoleNames(user.role_ids).map((roleName, index) => (
                              <Chip key={index} label={roleName} size="small" variant="outlined" />
                            ))
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={responsiveTypographyTokens.tableCell}>N/A</Typography>)}
                        </Box>
                      </TableCell>
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[5], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[5].minWidth,
                        width: expandedView ? 'auto' : columnConfigs[5].minWidth
                      }}>                        <Typography sx={responsiveTypographyTokens.tableCell}>
                          {(() => {
                            if (!user.created_at) {
                              return 'N/A';
                            }
                            try {
                              // Parse UTC date and convert to GMT+7
                              const utcDate = parseISO(user.created_at);
                              const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
                              const formatted = format(gmt7Date, 'dd/MM/yyyy HH:mm');
                              return formatted;
                            } catch (error) {
                              return 'Ngày không hợp lệ';
                            }
                          })()}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[6], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[6].minWidth,
                        width: expandedView ? 'auto' : columnConfigs[6].minWidth
                      }}>                        <Typography sx={responsiveTypographyTokens.tableCell}>
                          {(() => {
                            if (!user.updated_at) {
                              return 'N/A';
                            }
                            try {
                              // Parse UTC date and convert to GMT+7
                              const utcDate = parseISO(user.updated_at);
                              const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
                              const formatted = format(gmt7Date, 'dd/MM/yyyy HH:mm');
                              return formatted;
                            } catch (error) {
                              return 'Ngày không hợp lệ';
                            }
                          })()}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[7], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[7].minWidth,
                        width: expandedView ? 'auto' : columnConfigs[7].minWidth
                      }}>
                        {user.referral_code ? (
                          <Chip
                            label={user.referral_code}
                            size="small"
                            variant="outlined"
                            color="primary"
                          />
                        ) : (<Typography variant="body2" color="text.secondary" sx={responsiveTypographyTokens.tableCell}>N/A</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{
                        ...getResponsiveDisplayStyle(columnConfigs[8], expandedView),
                        whiteSpace: expandedView ? 'nowrap' : 'normal',
                        minWidth: columnConfigs[8].minWidth,
                        width: expandedView ? 'auto' : columnConfigs[8].minWidth
                      }}>                    <Chip
                          label={user.google_id ? 'Google' : 'Credentials'}
                          color={user.google_id ? 'info' : 'default'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right" sx={{
                        position: 'sticky',
                        right: -1,
                        backgroundColor: 'background.paper',
                        zIndex: 1,
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
                          backgroundColor: componentColors.tableRow.hover
                        }
                      }}>                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <Tooltip title="Chỉnh sửa người dùng">
                            <IconButton
                              size="small"
                              onClick={() => handleEditUser(user)}
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
                          <Tooltip title={isSystemUser(user.email) ? "Không thể xóa người dùng hệ thống" : "Xóa người dùng"}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleOpenDeleteDialog(user)}
                                color="error"
                                disabled={isSystemUser(user.email)}
                                sx={{
                                  minWidth: { xs: 32, sm: 'auto' },
                                  width: { xs: 32, sm: 'auto' },
                                  height: { xs: 32, sm: 'auto' },
                                  opacity: isSystemUser(user.email) ? 0.5 : 1
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
                  {Array.isArray(users) && users.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={expandedView ? 10 : 5} align="center">No users found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 50, { label: 'All', value: 99999 }]}
              component="div"
              count={displayTotalCount}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelRowsPerPage={
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  Rows per page:
                </Box>
              }
              sx={{
                '& .MuiTablePagination-toolbar': {
                  minHeight: { xs: 48, sm: 52 },
                  px: { xs: 1, sm: 2 }
                },
                '& .MuiTablePagination-selectLabel': {
                  ...responsiveTypographyTokens.tableCellSmall,
                  margin: 0
                },
                '& .MuiTablePagination-displayedRows': {
                  ...responsiveTypographyTokens.tableCellSmall,
                  margin: 0
                },
                '& .MuiTablePagination-select': {
                  ...responsiveTypographyTokens.tableCellSmall
                },
                '& .MuiTablePagination-actions': {
                  '& .MuiIconButton-root': {
                    padding: { xs: '4px', sm: '8px' }
                  }
                }
              }}
            />
          </>
        )}
      </Paper>
      <Dialog
        open={openDeleteDialog}
        onClose={!deleteLoading ? handleCloseDeleteDialog : undefined}
        maxWidth="sm"
        fullWidth
      >        <DialogTitle sx={{ color: 'error.main', fontWeight: 'bold' }}>
          ⚠️ Xác nhận xóa người dùng
        </DialogTitle>
        <DialogContent>
          <Box sx={{
            p: 1.5,
            bgcolor: componentColors.modal.noteBackground,
            borderRadius: 1,
            mb: 2,
          }}>
            <Typography variant="body1" fontWeight="bold">
              {userToDelete?.full_name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {userToDelete?.email}
            </Typography>
            {userToDelete?.phone_number && (
              <Typography variant="body2" color="text.secondary">
                {userToDelete.phone_number}
              </Typography>
            )}
          </Box>
          <Box sx={{
            mb: 3,
            p: 2,
            bgcolor: componentColors.modal.noteBackground,
            borderRadius: 1,
            border: `1px solid ${componentColors.modal.noteBorder}`,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              bgcolor: 'error.main',
              borderRadius: '4px 4px 0 0'
            },
            position: 'relative'
          }}>
            <Typography
              variant="body2"
              fontWeight="bold"
              sx={{
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: 'error.main',
                mb: 2
              }}            >
              ⚠️ Cảnh báo quan trọng:
            </Typography>            <Typography variant="body2" sx={{ color: componentColors.modal.noteText }}>
              • Hành động này không thể hoàn tác
            </Typography>
            <Typography variant="body2" sx={{ color: componentColors.modal.noteText }}>
              • Tất cả dữ liệu và lịch sử người dùng sẽ bị mất vĩnh viễn
            </Typography>
            <Typography variant="body2" sx={{ color: componentColors.modal.noteText }}>
              • Subscription của người dùng sẽ bị chấm dứt ngay lập tức
            </Typography>
            <Typography variant="body2" sx={{ color: componentColors.modal.noteText }}>
              • Chỉ người dùng với vai trò "user" (hoặc không có vai trò) mới có thể xóa
            </Typography>
            <Typography variant="body2" sx={{ color: componentColors.modal.noteText }}>
              • Người dùng có vai trò admin, broker hoặc vai trò khác phải được thu hồi vai trò trước khi xóa
            </Typography>
          </Box>
          <TextField
            autoFocus
            fullWidth
            label="Nhập địa chỉ email để xác nhận"
            placeholder={userToDelete?.email}
            value={deleteConfirmEmail}
            onChange={(e) => setDeleteConfirmEmail(e.target.value)}
            disabled={deleteLoading}
            variant="outlined"
            size="small"
            sx={{ mt: 1 }}
            helperText="Email phải khớp chính xác (không phân biệt chữ hoa thường)"
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button
            onClick={handleCloseDeleteDialog}
            disabled={deleteLoading}
            variant="outlined"          >
            Hủy
          </Button>
          <Button
            onClick={handleDeleteUser}
            color="error"
            variant="contained"
            disabled={
              deleteLoading ||
              !deleteConfirmEmail.trim() ||
              deleteConfirmEmail.trim().toLowerCase() !== userToDelete?.email.toLowerCase()
            }
            startIcon={deleteLoading ? <CircularProgress size={20} /> : null}
          >
            {deleteLoading ? 'Đang xóa...' : 'Xóa người dùng'}
          </Button>
        </DialogActions>
      </Dialog>
      <AddUserModal
        open={openAddUserModal}
        onClose={handleCloseAddUserModal}
        onUserAdded={handleUserAdded}
        roles={roles}
      />
      <EditUserModal
        open={openEditUserModal}
        user={userToEdit}
        roles={roles}
        protectedEmails={protectedEmails}
        onClose={handleCloseEditUserModal}
        onUserUpdated={handleUserUpdated}
      />
    </Box >
  );
};

export default UsersPage;
