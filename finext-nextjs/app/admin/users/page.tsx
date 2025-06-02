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
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';

// Interface for User data (matching UserPublic from backend)
interface UserPublic {
    id: string;
    role_ids: string[];
    full_name: string;
    email: string;
    phone_number?: string | null;
    is_active?: boolean;
    created_at: string; // Assuming ISO string from backend
    avatar_url?: string | null;
    referral_code?: string | null;
    google_id?: string | null;
    subscription_id?: string | null;
}

// API directly returns StandardApiResponse<UserPublic[]>
// So, response.data will be UserPublic[]

const UsersPage: React.FC = () => {
    const [users, setUsers] = useState<UserPublic[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0); // This will be based on fetched data length for now

    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [userToDelete, setUserToDelete] = useState<UserPublic | null>(null);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Backend endpoint /api/v1/users/ returns StandardApiResponse<UserPublic[]>
            // So, response.data is UserPublic[]
            const response = await apiClient<UserPublic[]>({
                url: `/api/v1/users/?skip=${page * rowsPerPage}&limit=${rowsPerPage}`,
                method: 'GET',
            });

            if (response.status === 200 && Array.isArray(response.data)) {
                setUsers(response.data);
                // For client-side pagination count or if API doesn't send total:
                // This is NOT the true total if API paginates without sending total.
                // Ideally, backend should send total count for server-side pagination.
                // If API sends total, e.g. in headers, update setTotalCount accordingly.
                // For now, assuming we need to ask backend to return total for accurate pagination.
                // Let's simulate for now, if API provided total, it'd be set here.
                // As a fallback for current backend:
                if (response.data.length < rowsPerPage && page === 0) {
                    setTotalCount(response.data.length);
                } else if (response.data.length === rowsPerPage) {
                    // We can't be sure of total, might be more pages.
                    // This makes TablePagination inaccurate for subsequent pages unless API sends total.
                    // A better approach: API sends { items: [], total: number }
                    // For now, we'll set totalCount to a higher number if more data might exist.
                    // This part requires backend to return total for accurate pagination.
                    // Fallback: if you want to show pagination controls even without knowing true total:
                    setTotalCount(page * rowsPerPage + response.data.length + (response.data.length === rowsPerPage ? rowsPerPage : 0) );

                } else {
                     setTotalCount(page * rowsPerPage + response.data.length);
                }

            } else {
                setError(response.message || 'Failed to load users.');
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

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
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
        setLoading(true); // Can use a more specific loading state for the delete action
        try {
            await apiClient({
                url: `/api/v1/users/${userToDelete.id}`,
                method: 'DELETE',
            });
            // Optimistically update or refetch
            setUsers(prevUsers => prevUsers.filter(u => u.id !== userToDelete.id));
            setTotalCount(prevTotal => prevTotal -1); // Adjust total count
            handleCloseDeleteDialog();
        } catch (delError: any) {
            setError(delError.message || 'Failed to delete user.');
            handleCloseDeleteDialog();
        } finally {
            setLoading(false); // Reset specific loading state
        }
    };
    
    const handleAddUser = () => console.log("Add user action triggered (not implemented)");
    const handleEditUser = (userId: string) => console.log("Edit user action triggered for:", userId, " (not implemented)");

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4" component="h1">Users Management</Typography>
                <Box>
                    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchUsers} disabled={loading} sx={{ mr: 1 }}>
                        Refresh
                    </Button>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddUser}>
                        Add User
                    </Button>
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                {loading && users.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3, minHeight: 300 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <TableContainer sx={{ maxHeight: 600 }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Contact</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Roles</TableCell>
                                        <TableCell>Joined</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {users.map((user) => (
                                        <TableRow hover key={user.id}>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    <Avatar src={user.avatar_url || undefined} sx={{ mr: 2, width: 40, height: 40 }}>
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
                                                <Chip
                                                    label={user.is_active ? 'Active' : 'Inactive'}
                                                    color={user.is_active ? 'success' : 'default'}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>{user.role_ids?.join(', ') || 'N/A'}</TableCell>
                                            <TableCell>{user.created_at ? format(parseISO(user.created_at), 'dd/MM/yyyy') : 'N/A'}</TableCell>
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
                                    {users.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={6} align="center">No users found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination
                            rowsPerPageOptions={[5, 10, 25, 50]}
                            component="div"
                            count={totalCount}
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
                    <Button onClick={handleDeleteUser} color="error" disabled={loading}>
                        {loading ? <CircularProgress size={20} /> : "Delete"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default UsersPage;