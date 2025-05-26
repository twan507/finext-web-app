// finext-nextjs/app/(dashboard)/users/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from 'app/services/apiClient';

// MUI Components
import {
  Box, Typography, Container, Paper, TableContainer,
  Table, TableHead, TableRow, TableCell, TableBody, Chip, IconButton,
  Alert, Button, Breadcrumbs, Link as MuiLink,
  TablePagination,
  Avatar
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon, Home as HomeIcon, People as PeopleIcon
} from '@mui/icons-material';

// Kiểu dữ liệu cho User
interface UserPublic {
  id: string;
  role_ids: string[];
  full_name: string;
  email: string;
  phone_number: string;
  is_active?: boolean;
  created_at?: string;
}

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      setError(null);
      try {
        const response = await apiClient<UserPublic[]>({
          url: '/api/v1/users/',
          method: 'GET',
        });
        if (response.status === 200 && response.data) {
          setUsers(response.data);
        } else {
          setError(response.message || 'Không thể tải danh sách người dùng.');
        }
      } catch (err: any) {
        setError(err.message || 'Lỗi kết nối hoặc không có quyền truy cập.');
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedUsers = users.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Container maxWidth={false} sx={{ p: '0 !important' }}>
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 1 }}>
          <MuiLink underline="hover" color="inherit" href="/" sx={{ display: 'flex', alignItems: 'center' }}>
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Dashboard
          </MuiLink>
          <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
            <PeopleIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Users
          </Typography>
        </Breadcrumbs>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>User Management</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage your users and view their details.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ textTransform: 'none', borderRadius: '8px' }}
            // onClick={() => router.push('/users/create')} // Ví dụ
          >
            Add User
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ m: 2, borderRadius: '12px' }}>{error}</Alert>}

      {!error && !loadingUsers && (
        <Paper sx={{ width: '100%', mb: 2, borderRadius: '12px', overflow: 'hidden' }}>
          <TableContainer>
            <Table sx={{ minWidth: 750 }} aria-labelledby="tableTitle">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Phone Number</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>ID</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedUsers.map((user) => (
                  <TableRow
                    hover
                    key={user.id}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell component="th" scope="row">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ mr: 2, width: 40, height: 40, bgcolor: 'primary.light' }}>
                          {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body1">{user.full_name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {user.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{user.phone_number}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.is_active !== false ? 'Active' : 'Inactive'}
                        color={user.is_active !== false ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        ...{user.id ? user.id.slice(-6) : 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton aria-label="actions">
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={users.length}
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

export default UsersPage;