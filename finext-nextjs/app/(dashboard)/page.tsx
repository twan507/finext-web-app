// finext-nextjs/app/(dashboard)/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from 'components/AuthProvider';
import { apiClient } from 'lib/apiClient';

// MUI Components
import {
  AppBar, Box, CssBaseline, Drawer, Toolbar, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Typography, Container, Paper, TableContainer,
  Table, TableHead, TableRow, TableCell, TableBody, Chip, IconButton,
  CircularProgress, Alert, TextField, Button, InputAdornment, Breadcrumbs, Link as MuiLink,
  TablePagination,
  Avatar
} from '@mui/material';
import {
  Dashboard as DashboardIcon, People as PeopleIcon, BarChart as BarChartIcon,
  Layers as LayersIcon, Search as SearchIcon, Add as AddIcon,
  MoreVert as MoreVertIcon, Home as HomeIcon
} from '@mui/icons-material';
import UserMenu from './_components/UserMenu';
import ThemeToggleButton from 'components/ThemeToggleButton';

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

const drawerWidth = 240;

const DashboardPage: React.FC = () => {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.push('/login');
      return;
    }

    const fetchUsers = async () => {
      setLoading(true);
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
        setLoading(false);
      }
    };

    fetchUsers();
  }, [session, router, authLoading]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  if (authLoading || !session) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const paginatedUsers = users.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
        }}
        elevation={0}
      >
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <TextField
            variant="outlined"
            size="small"
            placeholder="Search..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              sx: { borderRadius: '8px' }
            }}
            sx={{ width: '300px' }}
          />
          {/* Nhóm các nút ở bên phải AppBar */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ThemeToggleButton /> {/* <<--- THÊM ThemeToggleButton vào đây */}
            <UserMenu />
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            Finext Admin
          </Typography>
        </Toolbar>
        <List>
          {['Dashboard', 'Users', 'Reports', 'Integrations'].map((text, index) => (
            <ListItem key={text} disablePadding sx={{ px: 2, mb: 1 }}>
              <ListItemButton selected={index === 1} sx={{ borderRadius: '8px' }}>
                <ListItemIcon>
                  {index === 0 && <DashboardIcon />}
                  {index === 1 && <PeopleIcon />}
                  {index === 2 && <BarChartIcon />}
                  {index === 3 && <LayersIcon />}
                </ListItemIcon>
                <ListItemText primary={text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Box sx={{ flexGrow: 1 }} />
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          p: 3,
          minHeight: '100vh'
        }}
      >
        <Toolbar />
        <Container maxWidth={false} sx={{ p: '0 !important' }}>
          <Box sx={{ mb: 3 }}>
            <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 1 }}>
              <MuiLink underline="hover" color="inherit" href="/" sx={{ display: 'flex', alignItems: 'center' }}>
                <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                Dashboard
              </MuiLink>
              <Typography color="text.primary">All Users</Typography>
            </Breadcrumbs>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Users</Typography>
                <Typography variant="body2" color="text.secondary">
                  Manage your users and view their details.
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                sx={{ textTransform: 'none', borderRadius: '8px' }}
              >
                Add User
              </Button>
            </Box>
          </Box>

          <Paper sx={{ width: '100%', mb: 2, borderRadius: '12px', overflow: 'hidden' }}>
            <TableContainer>
              {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
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
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedUsers.map((user) => (
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
                            ...{user.id.slice(-6)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <IconButton aria-label="actions">
                            <MoreVertIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {!loading && paginatedUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
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
        </Container>
      </Box>
    </Box>
  );
};

export default DashboardPage;
