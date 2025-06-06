// finext-nextjs/app/admin/users/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from 'services/apiClient';
import {
  Box, Typography, Paper, TableContainer,
  Table, TableHead, TableRow, TableCell, TableBody, Chip, IconButton,
  Alert, Button, TablePagination, Avatar, Tooltip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  UnfoldMore as ExpandIcon, UnfoldLess as CollapseIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import UserSearch from './components/UserSearch';
import AddUserModal from './components/AddUserModal';

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
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserPublic[]>([]);
  const [isFiltering, setIsFiltering] = useState(false); const [roles, setRoles] = useState<RolePublic[]>([]);
  const [subscriptions, setSubscriptions] = useState<Map<string, SubscriptionPublic>>(new Map());
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0); const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserPublic | null>(null);
  const [expandedView, setExpandedView] = useState(false);
  const [openAddUserModal, setOpenAddUserModal] = useState(false); const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Expecting StandardApiResponse<PaginatedUsersResponse>
      const response = await apiClient<PaginatedUsersResponse>({
        url: `/api/v1/users/?skip=${page * rowsPerPage}&limit=${rowsPerPage}`,
        method: 'GET',
      }); if (response.status === 200 && response.data &&
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
  }, [page, rowsPerPage]); const fetchRoles = useCallback(async () => {
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
  }, []); const fetchSubscriptions = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return;

    setSubscriptionsLoading(true);
    const subscriptionsMap = new Map<string, SubscriptionPublic>();

    try {
      // Process all requests in parallel for fastest loading
      const subscriptionPromises = userIds.map(async (userId) => {
        try {
          const response = await apiClient<SubscriptionPublic[]>({
            url: `/api/v1/subscriptions/user/${userId}?skip=0&limit=1`,
            method: 'GET',
          });

          if (response.status === 200 && response.data && Array.isArray(response.data) && response.data.length > 0) {
            const activeSubscription = response.data.find(sub => sub.is_active) || response.data[0];
            return { userId, subscription: activeSubscription };
          }
        } catch (err) {
          console.warn(`Failed to load subscription for user ${userId}`);
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
  }, []); useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);
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
  }; const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    setRowsPerPage(value);
    setPage(0);
  }; const handleFilteredUsers = (filtered: UserPublic[], isActivelyFiltering: boolean) => {
    setFilteredUsers(filtered);
    setIsFiltering(isActivelyFiltering);
    // Only reset page when actively switching between filtering states
    if (isActivelyFiltering !== isFiltering) {
      setPage(0);
    }
  };

  const handleOpenDeleteDialog = (user: UserPublic) => {
    setUserToDelete(user);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setUserToDelete(null);
    setOpenDeleteDialog(false);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    // setLoading(true); // Consider a more specific loading state for this action
    try {
      await apiClient({
        url: `/api/v1/users/${userToDelete.id}`,
        method: 'DELETE',
      });
      fetchUsers(); // Refresh list
      handleCloseDeleteDialog();
    } catch (delError: any) {
      setError(delError.message || 'Failed to delete user.');
      handleCloseDeleteDialog();
    } finally {
      // setLoading(false); // Reset specific loading state
    }
  }; const handleAddUser = () => {
    setOpenAddUserModal(true);
  };

  const handleCloseAddUserModal = () => {
    setOpenAddUserModal(false);
  };

  const handleUserAdded = () => {
    fetchUsers(); // Refresh the users list
  };
  const handleEditUser = (userId: string) => console.log("Edit user action triggered for:", userId, " (not implemented)");

  // Helper function to get role names from role IDs
  const getRoleNames = (roleIds: string[]): string[] => {
    return roleIds.map(roleId => {
      const role = roles.find(r => r.id === roleId);
      return role ? role.name : roleId;
    });
  };  // Helper function to get subscription info
  const getSubscriptionInfo = (userId: string): { status: string; color: 'success' | 'default' | 'primary'; details?: SubscriptionPublic; loading?: boolean } => {
    // If subscriptions are still loading, show loading state
    if (subscriptionsLoading) {
      return { status: '...', color: 'primary', loading: true };
    }

    const subscription = subscriptions.get(userId);
    if (!subscription) {
      return { status: 'Free', color: 'default' };
    }

    const isActive = subscription.is_active && new Date(subscription.expiry_date) > new Date();
    return {
      status: isActive ? subscription.license_key : 'Expired',
      color: isActive ? 'success' : 'default',
      details: subscription
    };
  };  // Calculate paginated users - use server pagination when not filtering, client pagination when filtering
  const paginatedUsers = React.useMemo(() => {
    if (isFiltering) {
      // Client-side pagination for filtered results
      if (rowsPerPage === 99999) {
        // Show all filtered results
        return filteredUsers;
      }
      const startIndex = page * rowsPerPage;
      const endIndex = startIndex + rowsPerPage;
      return filteredUsers.slice(startIndex, endIndex);
    } else {
      // Server-side pagination - use users directly as they are already paginated
      return users;
    }
  }, [users, filteredUsers, isFiltering, page, rowsPerPage]);

  // Calculate total count for pagination
  const displayTotalCount = isFiltering ? filteredUsers.length : totalCount;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">Users Management</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={expandedView ? <CollapseIcon /> : <ExpandIcon />}
            onClick={() => setExpandedView(!expandedView)}
            sx={{ mr: 1 }}
          >
            {expandedView ? 'Compact View' : 'Detailed View'}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddUser}>
            Add User
          </Button>
        </Box>
      </Box>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}      <UserSearch
        users={users}
        roles={roles}
        subscriptions={subscriptions}
        subscriptionsLoading={subscriptionsLoading}
        onFilteredUsers={handleFilteredUsers}
        loading={loading}
      />

      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
        {loading && users.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3, minHeight: 300 }}>
            <CircularProgress />
          </Box>) : (<>
            <TableContainer sx={{ overflowX: expandedView ? 'auto' : 'hidden' }}>
              <Table sx={{ minWidth: expandedView ? 1400 : 'auto' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: expandedView ? 250 : 200 }}>Name</TableCell>
                    <TableCell sx={{ minWidth: expandedView ? 150 : 120 }}>Contact</TableCell>
                    <TableCell sx={{ minWidth: expandedView ? 120 : 100 }}>Subscription</TableCell>
                    <TableCell sx={{ minWidth: expandedView ? 100 : 80 }}>Status</TableCell>
                    {expandedView && <TableCell sx={{ minWidth: 120 }}>Roles</TableCell>}
                    {expandedView && <TableCell sx={{ minWidth: 120 }}>Joined</TableCell>}
                    {expandedView && <TableCell sx={{ minWidth: 120 }}>Updated</TableCell>}
                    {expandedView && <TableCell sx={{ minWidth: 140 }}>Referral Code</TableCell>}
                    {expandedView && <TableCell sx={{ minWidth: 120 }}>Login Method</TableCell>}
                    <TableCell align="right" sx={{ minWidth: expandedView ? 120 : 100 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.isArray(paginatedUsers) && paginatedUsers.map((user) => (
                    <TableRow hover key={user.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar src={user.avatar_url || undefined} sx={{ mr: 2, width: 25, height: 25 }}>
                            {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="body1" fontWeight="medium">{user.full_name}</Typography>
                            <Typography variant="body2" color="text.secondary">{user.email}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>{user.phone_number || 'N/A'}</TableCell>
                      <TableCell>
                        {(() => {
                          const subscriptionInfo = getSubscriptionInfo(user.id);
                          return (
                            <Tooltip title={
                              subscriptionInfo.loading ?
                                'Loading subscription info...' :
                                subscriptionInfo.details ?
                                  `Expires: ${format(parseISO(subscriptionInfo.details.expiry_date), 'dd/MM/yyyy')}` :
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
                                    <span style={{ fontSize: '0.75rem' }}>Loading...</span>
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
                            </Tooltip>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.is_active ? 'Active' : 'Inactive'}
                          color={user.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      {expandedView && (
                        <TableCell>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {user.role_ids?.length > 0 ? (
                              getRoleNames(user.role_ids).map((roleName, index) => (
                                <Chip key={index} label={roleName} size="small" variant="outlined" />
                              ))
                            ) : (
                              <Typography variant="body2" color="text.secondary">N/A</Typography>
                            )}
                          </Box>
                        </TableCell>
                      )}
                      {expandedView && (
                        <TableCell>
                          {(() => {
                            if (!user.created_at) {
                              return 'N/A';
                            }
                            try {
                              const formatted = format(parseISO(user.created_at), 'dd/MM/yyyy');
                              return formatted;
                            } catch (error) {
                              return 'Invalid Date';
                            }
                          })()}
                        </TableCell>
                      )}{expandedView && (
                        <TableCell>
                          {(() => {
                            if (!user.updated_at) {
                              return 'N/A';
                            }
                            try {
                              const formatted = format(parseISO(user.updated_at), 'dd/MM/yyyy');
                              return formatted;
                            } catch (error) {
                              return 'Invalid Date';
                            }
                          })()}
                        </TableCell>
                      )}
                      {expandedView && (
                        <TableCell>
                          {user.referral_code ? (
                            <Chip
                              label={user.referral_code}
                              size="small"
                              variant="outlined"
                              color="primary"
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">N/A</Typography>
                          )}
                        </TableCell>)}
                      {expandedView && (
                        <TableCell>
                          <Chip
                            label={user.google_id ? 'Google' : 'Credentials'}
                            color={user.google_id ? 'info' : 'default'}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                      )}
                      <TableCell align="right">
                        <Tooltip title="Edit User">
                          <IconButton size="small" onClick={() => handleEditUser(user.id)}><EditIcon fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Delete User">
                          <IconButton size="small" onClick={() => handleOpenDeleteDialog(user)}><DeleteIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {Array.isArray(users) && users.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={expandedView ? 9 : 5} align="center">No users found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>            <TablePagination
              rowsPerPageOptions={[5, 10, 50, { label: 'All', value: 99999 }]}
              component="div"
              count={displayTotalCount}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </>
        )}
      </Paper>

      <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete user {userToDelete?.full_name} ({userToDelete?.email})? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button onClick={handleDeleteUser} color="error" /* disabled={specificDeleteLoading} */ >
            {/* {specificDeleteLoading ? <CircularProgress size={20} /> : "Delete"} */}
            Delete
          </Button>
        </DialogActions>      </Dialog>

      <AddUserModal
        open={openAddUserModal}
        onClose={handleCloseAddUserModal}
        onUserAdded={handleUserAdded}
        roles={roles}
      />
    </Box>
  );
};

export default UsersPage;