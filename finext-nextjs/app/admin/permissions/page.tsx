// finext-nextjs/app/(dashboard)/permissions/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from 'services/apiClient';
import {
    Box, Typography, Container, Paper, Link as MuiLink,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Alert, CircularProgress, TablePagination, Tooltip, Button, Switch
} from '@mui/material';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import { Home as HomeIcon, Security as SecurityIcon, InfoOutlined as InfoIcon, Gavel as PermissionIcon, Add as AddIcon } from '@mui/icons-material';
// Bỏ AddIcon nếu không có chức năng thêm permission từ UI

// Định nghĩa kiểu dữ liệu cho Permission (phải khớp với PermissionPublic từ FastAPI)
interface PermissionPublic {
    name: string;
    description?: string;
    // FastAPI endpoint /permissions/ trả về PermissionPublic không có id, created_at, updated_at
    // Nếu bạn có một endpoint khác (vd: /permissions/all cho admin) trả về nhiều thông tin hơn (PermissionInDB),
    // thì bạn cần một interface khác và gọi đúng endpoint.
    // Hiện tại, dựa theo router, /permissions/ là "Lấy danh sách các quyền mà người dùng hiện tại đang sở hữu"
    // và schema là PermissionPublic.
}

const PermissionsPage: React.FC = () => {
    const [permissions, setPermissions] = useState<PermissionPublic[]>([]);
    const [loadingPermissions, setLoadingPermissions] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    useEffect(() => {
        const fetchPermissions = async () => {
            setLoadingPermissions(true);
            setError(null);
            try {
                // Endpoint này lấy quyền của user hiện tại, không phải tất cả permission hệ thống
                const response = await apiClient<PermissionPublic[]>({
                    url: '/api/v1/permissions/', // Endpoint lấy danh sách permissions của user hiện tại
                    method: 'GET',
                });
                if (response.status === 200 && response.data) {
                    setPermissions(response.data);
                } else {
                    setError(response.message || 'Không thể tải danh sách quyền.');
                }
            } catch (err: any) {
                setError(err.message || 'Lỗi kết nối hoặc không có quyền truy cập.');
            } finally {
                setLoadingPermissions(false);
            }
        };

        fetchPermissions();
    }, []);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const paginatedPermissions = permissions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    return (
        <Container maxWidth={false} sx={{ p: '0 !important' }}>
            <Box sx={{ mb: 3 }}>
                <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 1 }}>
                    <MuiLink underline="hover" color="inherit" href="/" sx={{ display: 'flex', alignItems: 'center' }}>
                        <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                        Dashboard
                    </MuiLink>
                    <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
                        <SecurityIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                        My Permissions
                    </Typography>
                </Breadcrumbs>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>My Assigned Permissions</Typography>
                        <Typography variant="body2" color="text.secondary">
                            List of permissions currently assigned to your account via roles.
                        </Typography>
                    </Box>
                    {/* Thông thường không có nút "Add Permission" ở đây, vì permission thường được định nghĩa sẵn trong hệ thống. */}
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ m: 2, borderRadius: '12px' }}>{error}</Alert>}

            {loadingPermissions && !error && (
                <Paper sx={{ width: '100%', p: 3, borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                    <CircularProgress />
                </Paper>
            )}

            {!loadingPermissions && !error && (
                <Paper sx={{ width: '100%', mb: 2, borderRadius: '12px', overflow: 'hidden' }}>
                    <TableContainer>
                        <Table sx={{ minWidth: 650 }} aria-label="permissions table">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Permission Name</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedPermissions.map((permission, index) => (
                                    <TableRow
                                        hover
                                        key={`${permission.name}-${index}`} // Sử dụng index nếu name không đủ duy nhất (dù nên là duy nhất)
                                        sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                    >
                                        <TableCell component="th" scope="row">
                                            <Typography variant="body1" fontWeight="medium">{permission.name}</Typography>
                                        </TableCell>
                                        <TableCell>{permission.description || 'N/A'}</TableCell>
                                    </TableRow>
                                ))}
                                {paginatedPermissions.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={2} align="center" sx={{ py: 3 }}>
                                            You have no permissions assigned or no permissions found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        rowsPerPageOptions={[5, 10, 25, 50]}
                        component="div"
                        count={permissions.length}
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

export default PermissionsPage;