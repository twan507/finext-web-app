// finext-nextjs/app/(dashboard)/roles/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from 'services/apiClient';
import {
    Box, Typography, Container, Paper, Button, Link as MuiLink,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Alert, CircularProgress, TablePagination, Chip
} from '@mui/material';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import { Home as HomeIcon, VpnKey as VpnKeyIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { format } from 'date-fns'; // Để định dạng ngày tháng

// Định nghĩa kiểu dữ liệu cho Role (phải khớp với RolePublic từ FastAPI)
interface RolePublic {
    id: string; // Hoặc PyObjectId nếu bạn có type đó ở frontend
    name: string;
    description?: string;
    permission_ids: string[]; // Danh sách các ID của permission
    created_at: string;
    updated_at: string;
}

const RolesPage: React.FC = () => {
    const [roles, setRoles] = useState<RolePublic[]>([]);
    const [loadingRoles, setLoadingRoles] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    useEffect(() => {
        const fetchRoles = async () => {
            setLoadingRoles(true);
            setError(null);
            try {
                const response = await apiClient<RolePublic[]>({
                    url: '/api/v1/roles/', // Endpoint lấy danh sách roles
                    method: 'GET',
                });
                if (response.status === 200 && response.data) {
                    setRoles(response.data);
                } else {
                    setError(response.message || 'Không thể tải danh sách vai trò.');
                }
            } catch (err: any) {
                setError(err.message || 'Lỗi kết nối hoặc không có quyền truy cập.');
            } finally {
                setLoadingRoles(false);
            }
        };

        fetchRoles();
    }, []);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const paginatedRoles = roles.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const handleEditRole = (roleId: string) => {
        // TODO: Implement edit role functionality (e.g., navigate to edit page or open modal)
        console.log("Edit role:", roleId);
    };

    const handleDeleteRole = async (roleId: string) => {
        // TODO: Implement delete role functionality (with confirmation)
        // Ví dụ:
        // if (window.confirm('Bạn có chắc muốn xóa vai trò này?')) {
        //   try {
        //     await apiClient({
        //       url: `/api/v1/roles/${roleId}`,
        //       method: 'DELETE',
        //     });
        //     setRoles(prevRoles => prevRoles.filter(role => role.id !== roleId));
        //   } catch (delError: any) {
        //     setError(delError.message || 'Không thể xóa vai trò.');
        //   }
        // }
        console.log("Delete role:", roleId);
    };


    return (
        <Container maxWidth={false} sx={{ p: '0 !important' }}>
            <Box sx={{ mb: 3 }}>
                <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 1 }}>
                    <MuiLink underline="hover" color="inherit" href="/" sx={{ display: 'flex', alignItems: 'center' }}>
                        <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                        Dashboard
                    </MuiLink>
                    <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
                        <VpnKeyIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                        Roles
                    </Typography>
                </Breadcrumbs>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Role Management</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Manage user roles and their permissions.
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        sx={{ textTransform: 'none', borderRadius: '8px' }}
                    // onClick={() => router.push('/roles/create')} // Ví dụ
                    >
                        Add Role
                    </Button>
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ m: 2, borderRadius: '12px' }}>{error}</Alert>}

            {loadingRoles && !error && (
                <Paper sx={{ width: '100%', p: 3, borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                    <CircularProgress />
                </Paper>
            )}

            {!loadingRoles && !error && (
                <Paper sx={{ width: '100%', mb: 2, borderRadius: '12px', overflow: 'hidden' }}>
                    <TableContainer>
                        <Table sx={{ minWidth: 650 }} aria-label="roles table">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }} align="center">Permissions Count</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Created At</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Updated At</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedRoles.map((role) => (
                                    <TableRow
                                        hover
                                        key={role.id}
                                        sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                    >
                                        <TableCell component="th" scope="row">
                                            <Typography variant="body1" fontWeight="medium">{role.name}</Typography>
                                        </TableCell>
                                        <TableCell>{role.description || 'N/A'}</TableCell>
                                        <TableCell align="center">
                                            <Chip label={role.permission_ids?.length || 0} size="small" />
                                        </TableCell>
                                        <TableCell>{format(new Date(role.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                                        <TableCell>{format(new Date(role.updated_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                                        <TableCell align="right">
                                            <IconButton size="small" onClick={() => handleEditRole(role.id)} color="primary" aria-label="edit role">
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton size="small" onClick={() => handleDeleteRole(role.id)} color="error" aria-label="delete role">
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {paginatedRoles.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                                            No roles found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        rowsPerPageOptions={[5, 10, 25, 50]}
                        component="div"
                        count={roles.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                    />
                </Paper>
            )}
        </Container>
    );
};

export default RolesPage;