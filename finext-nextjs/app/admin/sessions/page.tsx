// finext-nextjs/app/admin/sessions/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Alert, CircularProgress, TablePagination, Tooltip, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle
} from '@mui/material';
import {
  Devices as SessionsIcon, // Changed Icon
  DeleteOutline as DeleteIcon, // Changed Icon
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { vi } from 'date-fns/locale'; // For Vietnamese "time ago"
import { useAuth } from 'components/AuthProvider';
import { apiClient } from 'services/apiClient';

interface SessionPublicFE {
  id: string;
  user_id: string;
  jti: string;
  device_info?: string | null;
  created_at: string;
  last_active_at: string;
  user_email?: string; // Optional: if backend populates this
}

// Assuming backend returns StandardApiResponse<SessionPublicFE[]>
// For proper pagination, backend should return total count.

const SessionsPage: React.FC = () => {
  const [sessions, setSessions] = useState<SessionPublicFE[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<SessionPublicFE | null>(null);
  const { session: currentUserSessionInfo } = useAuth();


  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient<SessionPublicFE[]>({
        url: `/api/v1/sessions/all?skip=${page * rowsPerPage}&limit=${rowsPerPage}`,
        method: 'GET',
      });
      if (response.status === 200 && Array.isArray(response.data)) {
        setSessions(response.data);
        const currentDataLength = response.data.length;
        if (page === 0) {
          setTotalCount(currentDataLength < rowsPerPage ? currentDataLength : currentDataLength + (currentDataLength === rowsPerPage ? rowsPerPage : 0));
        } else if (currentDataLength < rowsPerPage) {
          setTotalCount(page * rowsPerPage + currentDataLength);
        } else {
          setTotalCount(page * rowsPerPage + currentDataLength + rowsPerPage);
        }
      } else {
        setError(response.message || 'Failed to load sessions.');
        setSessions([]);
        setTotalCount(0);
      }
    } catch (err: any) {
      setError(err.message || 'Connection error or unauthorized access.');
      setSessions([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
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
    // setLoading(true); // Use a more specific loading state if needed for this action
    try {
      await apiClient({
        url: `/api/v1/sessions/${sessionToDelete.id}`, // Admin delete specific session
        method: 'DELETE',
      });
      fetchSessions();
      handleCloseDeleteDialog();
    } catch (delError: any) {
      setError(delError.message || 'Failed to delete session.');
      handleCloseDeleteDialog();
    } finally {
      // setLoading(false);
    }
  };

  const isCurrentAdminSession = (jti: string): boolean => {
    if (!currentUserSessionInfo || !currentUserSessionInfo.accessToken) return false;
    try {
      const tokenPayload = JSON.parse(atob(currentUserSessionInfo.accessToken.split('.')[1]));
      return tokenPayload.jti === jti;
    } catch (e) {
      return false;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <SessionsIcon sx={{ mr: 1, fontSize: '24px' }} />
          <Typography variant="h4" component="h1">Active Sessions</Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchSessions} disabled={loading}>
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
        {loading && sessions.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3, minHeight: 300 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Session ID (JTI)</TableCell>
                    <TableCell>User ID</TableCell>
                    <TableCell>Device Info</TableCell>
                    <TableCell>Created At</TableCell>
                    <TableCell>Last Active</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.isArray(sessions) && sessions.map((session) => (
                    <TableRow hover key={session.id}>
                      <TableCell>
                        <Tooltip title={session.jti}>
                          <Typography
                            variant="body2"
                            component="span"
                            sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {session.jti}
                            {isCurrentAdminSession(session.jti) && <Chip label="Current" size="small" color="primary" sx={{ ml: 1 }} />}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={session.user_id}>
                          <Typography variant="body2" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {session.user_id}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={session.device_info || 'N/A'}>
                          <Typography variant="body2" sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {session.device_info || 'N/A'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{format(parseISO(session.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell>
                        {formatDistanceToNow(parseISO(session.last_active_at), { addSuffix: true, locale: vi })}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Terminate Session">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDeleteDialog(session)}
                            color="error"
                            disabled={isCurrentAdminSession(session.jti)} // Admin cannot terminate their own current session via this list
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {Array.isArray(sessions) && sessions.length === 0 && !loading && (
                    <TableRow><TableCell colSpan={6} align="center">No active sessions found.</TableCell></TableRow>
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
        <DialogTitle>Confirm Session Termination</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to terminate this session?
            <br />
            User ID: <strong>{sessionToDelete?.user_id.slice(-8)}</strong>
            <br />
            Session JTI: <strong>...{sessionToDelete?.jti.slice(-12)}</strong>
            <br />
            This will log the user out from the associated device/browser.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button onClick={handleDeleteSession} color="error" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : "Terminate"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SessionsPage;