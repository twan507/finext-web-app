// finext-nextjs/app/(dashboard)/sessions/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Container, Paper, Link as MuiLink,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Alert, CircularProgress, TablePagination, Tooltip, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle
} from '@mui/material';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import {
  Home as HomeIcon,
  VpnLockOutlined as SessionsIcon, // Hoặc một icon khác phù hợp cho sessions
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  InfoOutlined as InfoIcon
} from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { useAuth } from 'components/AuthProvider'; // Để lấy thông tin user hiện tại nếu cần
import { apiClient } from 'services/apiClient';

// Định nghĩa kiểu dữ liệu cho Session (khớp với backend hoặc đã được điều chỉnh)
interface SessionPublicFE {
  id: string;
  user_id: string;
  jti: string;
  device_info?: string;
  created_at: string;
  last_active_at: string;
  // Giả sử chúng ta sẽ fetch thêm thông tin user nếu cần
  user_email?: string; // Sẽ được thêm vào sau nếu có
}

const SessionsPage: React.FC = () => {
  const [sessions, setSessions] = useState<SessionPublicFE[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalSessions, setTotalSessions] = useState(0); // Nếu API trả về total

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<SessionPublicFE | null>(null);
  const { session: currentUserSession } = useAuth();


  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    setError(null);
    try {
      // API endpoint cho admin lấy tất cả sessions
      const response = await apiClient<SessionPublicFE[]>({
        url: `/api/v1/sessions/all?skip=${page * rowsPerPage}&limit=${rowsPerPage}`,
        method: 'GET',
      });
      if (response.status === 200 && response.data) {
        setSessions(response.data);
        // Giả sử API không trả về total, chúng ta sẽ không setTotalSessions ở đây
        // Nếu API có trả về total (ví dụ trong một trường khác của response.data), bạn cần cập nhật
        // setTotalSessions(response.data.total_count); // Ví dụ
      } else {
        setError(response.message || 'Không thể tải danh sách sessions.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối hoặc không có quyền truy cập.');
    } finally {
      setLoadingSessions(false);
    }
  }, [page, rowsPerPage]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Nếu API không trả về tổng số lượng, chúng ta sẽ dùng sessions.length
  // Điều này chỉ đúng nếu API trả về *tất cả* session một lúc,
  // nhưng vì có phân trang, nên cách này không chính xác hoàn toàn
  // Tốt nhất là API nên trả về tổng số lượng.
  // Tạm thời, nếu không có total, TablePagination có thể không hiển thị đúng tổng số trang.

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0); // Reset về trang đầu khi thay đổi số dòng mỗi trang
  };

  const handleOpenDeleteDialog = (session: SessionPublicFE) => {
    setSessionToDelete(session);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setSessionToDelete(null);
    setOpenDeleteDialog(false);
  };

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    try {
      // API endpoint cho admin xóa session
      await apiClient({
        url: `/api/v1/sessions/${sessionToDelete.id}`,
        method: 'DELETE',
      });
      // Tải lại danh sách sessions sau khi xóa
      fetchSessions();
      handleCloseDeleteDialog();
    } catch (delError: any) {
      setError(delError.message || 'Không thể xóa session.');
      handleCloseDeleteDialog();
    }
  };

  const isCurrentSession = (jti: string): boolean => {
    return currentUserSession?.accessToken ? JSON.parse(atob(currentUserSession.accessToken.split('.')[1])).jti === jti : false;
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
            <SessionsIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Sessions Management
          </Typography>
        </Breadcrumbs>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>Active Sessions</Typography>
            <Typography variant="body2" color="text.secondary">
              View and manage all active user sessions in the system.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchSessions}
            disabled={loadingSessions}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ m: 2, borderRadius: '12px' }}>{error}</Alert>}

      {loadingSessions && !error && (
        <Paper sx={{ width: '100%', p: 3, borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <CircularProgress />
        </Paper>
      )}

      {!loadingSessions && !error && (
        <Paper sx={{ width: '100%', mb: 2, borderRadius: '12px', overflow: 'hidden' }}>
          <TableContainer>
            <Table sx={{ minWidth: 750 }} aria-label="sessions table">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>User ID</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Device Info</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Created At</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Last Active At</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>JTI (Session ID)</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow
                    hover
                    key={session.id}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell>
                      <Tooltip title={session.user_id}>
                         <Typography variant="body2" sx={{
                           maxWidth: '150px',
                           overflow: 'hidden',
                           textOverflow: 'ellipsis',
                           whiteSpace: 'nowrap'
                         }}>
                           {session.user_id}
                         </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                       <Tooltip title={session.device_info || 'N/A'}>
                         <Typography variant="body2" sx={{
                           maxWidth: '200px',
                           overflow: 'hidden',
                           textOverflow: 'ellipsis',
                           whiteSpace: 'nowrap'
                         }}>
                           {session.device_info || 'N/A'}
                         </Typography>
                       </Tooltip>
                    </TableCell>
                    <TableCell>{format(parseISO(session.created_at), 'dd/MM/yyyy HH:mm:ss')}</TableCell>
                    <TableCell>{format(parseISO(session.last_active_at), 'dd/MM/yyyy HH:mm:ss')}</TableCell>
                    <TableCell>
                      <Tooltip title={session.jti}>
                         <Typography variant="body2" sx={{
                           maxWidth: '150px',
                           overflow: 'hidden',
                           textOverflow: 'ellipsis',
                           whiteSpace: 'nowrap',
                           fontWeight: isCurrentSession(session.jti) ? 'bold' : 'normal',
                           color: isCurrentSession(session.jti) ? 'primary.main' : 'inherit'
                         }}>
                           {session.jti}
                           {isCurrentSession(session.jti) && " (Current)"}
                         </Typography>
                       </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDeleteDialog(session)}
                        color="error"
                        aria-label="delete session"
                        disabled={isCurrentSession(session.jti)} // Không cho xóa session hiện tại của admin
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {sessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      No active sessions found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {/* Để TablePagination hoạt động chính xác với phân trang server-side,
            API `/api/v1/sessions/all` cần trả về tổng số lượng session.
            Nếu không, `count` ở đây sẽ chỉ là số lượng session trên trang hiện tại.
            Tạm thời ẩn đi nếu API không hỗ trợ:
          */}
          {/* <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={totalSessions > 0 ? totalSessions : sessions.length} // Ưu tiên totalSessions từ API
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          /> */}
        </Paper>
      )}

      <Dialog
        open={openDeleteDialog}
        onClose={handleCloseDeleteDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{"Confirm Delete Session"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to terminate this session? This will log the user out from the device/browser associated with this session.
            <br/>
            User ID: {sessionToDelete?.user_id}
            <br/>
            Device: {sessionToDelete?.device_info || 'N/A'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button onClick={handleDeleteSession} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

    </Container>
  );
};

export default SessionsPage;