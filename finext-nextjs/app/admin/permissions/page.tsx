// finext-nextjs/app/admin/permissions/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from 'services/apiClient';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Alert, CircularProgress, TablePagination, Tooltip, Button
} from '@mui/material';
import { Gavel as PermissionIcon, Refresh as RefreshIcon, Add as AddIcon } from '@mui/icons-material'; // Changed from SecurityIcon
import { format, parseISO } from 'date-fns';

// Interface matching PermissionInDB from backend (assuming id, created_at, updated_at are included)
interface PermissionSystemPublic {
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    const fetchPermissions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Assumed admin endpoint to list ALL system permissions
            const response = await apiClient<PaginatedPermissionsResponse | PermissionSystemPublic[]>({
                url: `/api/v1/permissions?skip=${page * rowsPerPage}&limit=${rowsPerPage}`, // ADJUST URL AS NEEDED
                method: 'GET',
            });

            if (response.status === 200 && response.data) {
                if ('items' in response.data && Array.isArray(response.data.items) && typeof response.data.total === 'number') {
                    setPermissions(response.data.items);
                    setTotalCount(response.data.total);
                } else if (Array.isArray(response.data)) {
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
    }, [page, rowsPerPage]);

    useEffect(() => {
        fetchPermissions();
    }, [fetchPermissions]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Permissions are usually system-defined, UI for Add/Edit/Delete might not be common
    // unless you allow dynamic permission creation through admin panel.
    const handleAddPermission = () => console.log("Add permission (not implemented - usually system defined)");


    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PermissionIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h4" component="h1">System Permissions</Typography>
                </Box>
                <Box>
                    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchPermissions} disabled={loading} sx={{ mr: 1 }}>
                        Refresh
                    </Button>
                    {/* Typically, permissions are not added via UI but defined in code/seeding */}
                    {/* <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddPermission} disabled> 
                        Add Permission
                    </Button> */}
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                {loading && permissions.length === 0 ? (
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
                                        <TableCell>Created At</TableCell>
                                        {/* <TableCell align="right">Actions</TableCell> */}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Array.isArray(permissions) && permissions.map((permission) => (
                                        <TableRow hover key={permission.id || permission.name}>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="medium">{permission.name}</Typography>
                                            </TableCell>                                            <TableCell>{permission.description || 'N/A'}</TableCell>
                                            <TableCell>
                                                {permission.created_at ? (() => {
                                                    try {
                                                        // Parse UTC date and convert to GMT+7
                                                        const utcDate = parseISO(permission.created_at);
                                                        const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
                                                        return format(gmt7Date, 'dd/MM/yyyy HH:mm');
                                                    } catch (error) {
                                                        return 'Invalid date';
                                                    }
                                                })() : 'N/A'}
                                            </TableCell>
                                            {/* Actions like Edit/Delete for system permissions are rare */}
                                            {/* <TableCell align="right"></TableCell> */}
                                        </TableRow>
                                    ))}
                                    {Array.isArray(permissions) && permissions.length === 0 && !loading && (
                                        <TableRow><TableCell colSpan={3} align="center">No permissions found.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination
                            rowsPerPageOptions={[10, 25, 50, 100]}
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
        </Box>
    );
};

export default PermissionsPage;