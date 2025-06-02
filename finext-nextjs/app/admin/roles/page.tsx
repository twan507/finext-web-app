// finext-nextjs/app/admin/roles/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from 'services/apiClient';
import {
    Box, Typography, Paper, Button,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Alert, CircularProgress, TablePagination, Chip, Tooltip,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle
} from '@mui/material';
import { Security as RolesIcon, Add as AddIcon, Edit as EditIcon, DeleteOutline as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material'; // RolesIcon, AddIcon, EditIcon, DeleteIcon
import { format, parseISO } from 'date-fns';

interface RolePublic {
    id: string;
    name: string;
    description?: string | null;
    permission_ids: string[];
    created_at: string;
    updated_at: string;
}

// Assuming backend returns StandardApiResponse<RolePublic[]>
// For proper pagination, backend should return total count.

const RolesPage: React.FC = () => {
    const [roles, setRoles] = useState<RolePublic[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [roleToDelete, setRoleToDelete] = useState<RolePublic | null>(null);

    const fetchRoles = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // API returns StandardApiResponse<RolePublic[]>
            const response = await apiClient<RolePublic[]>({
                url: `/api/v1/roles/?skip=${page * rowsPerPage}&limit=${rowsPerPage}`,
                method: 'GET',
            });
            if (response.status === 200 && Array.isArray(response.data)) {
                setRoles(response.data);
                const currentDataLength = response.data.length;
                if (page === 0) {
                    setTotalCount(currentDataLength < rowsPerPage ? currentDataLength : currentDataLength + (currentDataLength === rowsPerPage ? rowsPerPage : 0));
                } else if (currentDataLength < rowsPerPage) {
                    setTotalCount(page * rowsPerPage + currentDataLength);
                } else {
                    setTotalCount(page * rowsPerPage + currentDataLength + rowsPerPage);
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
    }, [page, rowsPerPage]);

    useEffect(() => {
        fetchRoles();
    }, [fetchRoles]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleOpenDeleteDialog = (role: RolePublic) => {
        setRoleToDelete(role);
        setOpenDeleteDialog(true);
    };

    const handleCloseDeleteDialog = () => {
        setRoleToDelete(null);
        setOpenDeleteDialog(false);
    };

    const handleDeleteRole = async () => {
        if (!roleToDelete) return;
        // setLoading(true); // Consider more specific loading
        try {
            await apiClient({
                url: `/api/v1/roles/${roleToDelete.id}`,
                method: 'DELETE',
            });
            fetchRoles(); // Refresh list
            handleCloseDeleteDialog();
        } catch (delError: any) {
            setError(delError.message || 'Failed to delete role. It might be protected or in use.');
            handleCloseDeleteDialog();
        } finally {
            // setLoading(false);
        }
    };

    const handleAddRole = () => console.log("Add role action (not implemented)");
    const handleEditRole = (roleId: string) => console.log("Edit role action (not implemented):", roleId);

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <RolesIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h4" component="h1">Role Management</Typography>
                </Box>
                <Box>
                    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchRoles} disabled={loading} sx={{mr: 1}}>
                        Refresh
                    </Button>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddRole}>
                        Add Role
                    </Button>
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                {loading && roles.length === 0 ? (
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
                                        <TableCell>Description</TableCell>
                                        <TableCell align="center">Permissions Count</TableCell>
                                        <TableCell>Created At</TableCell>
                                        <TableCell>Updated At</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Array.isArray(roles) && roles.map((role) => (
                                        <TableRow hover key={role.id}>
                                            <TableCell>
                                                <Typography variant="body1" fontWeight="medium">{role.name}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Tooltip title={role.description || ''}>
                                                     <Typography variant="body2" sx={{maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                                                        {role.description || 'N/A'}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Chip label={role.permission_ids?.length || 0} size="small" />
                                            </TableCell>
                                            <TableCell>{format(parseISO(role.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                                            <TableCell>{format(parseISO(role.updated_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Edit Role">
                                                    <IconButton size="small" onClick={() => handleEditRole(role.id)}><EditIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete Role">
                                                    <IconButton size="small" onClick={() => handleOpenDeleteDialog(role)}><DeleteIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {Array.isArray(roles) && roles.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={6} align="center">No roles found.</TableCell>
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
                <DialogTitle>Confirm Delete Role</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete role <strong>{roleToDelete?.name}</strong>?
                        This action cannot be undone and might affect users assigned to this role.
                        Protected roles (admin, user, broker) cannot be deleted.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
                    <Button onClick={handleDeleteRole} color="error" disabled={loading}>
                        {loading ? <CircularProgress size={20} /> : "Delete"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default RolesPage;