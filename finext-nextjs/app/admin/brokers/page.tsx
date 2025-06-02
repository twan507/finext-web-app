// finext-nextjs/app/admin/brokers/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from 'services/apiClient';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Button, Chip, IconButton, Alert, CircularProgress,
    TablePagination, Tooltip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Switch
} from '@mui/material';
import { AccountBalanceWallet as BrokerIcon, Add as AddIcon, Edit as EditIcon, DeleteOutline as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';

interface BrokerPublic {
    id: string;
    user_id: string;
    broker_code: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export default function BrokersPage() {
    const [brokers, setBrokers] = useState<BrokerPublic[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    const [openActionDialog, setOpenActionDialog] = useState(false);
    const [brokerToAction, setBrokerToAction] = useState<BrokerPublic | null>(null);
    const [actionType, setActionType] = useState<'deactivate' | 'delete' | ''>('');

    const fetchBrokers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient<BrokerPublic[]>({
                url: `/api/v1/brokers/?skip=${page * rowsPerPage}&limit=${rowsPerPage}`,
                method: 'GET',
            });

            if (response.status === 200 && Array.isArray(response.data)) {
                setBrokers(response.data);
                const currentDataLength = response.data.length;
                // This estimation is a fallback if backend doesn't provide total.
                // For accurate pagination, backend should return total count.
                if (page === 0) {
                    setTotalCount(currentDataLength < rowsPerPage ? currentDataLength : currentDataLength + (currentDataLength === rowsPerPage ? rowsPerPage : 0));
                } else if (currentDataLength < rowsPerPage) {
                    setTotalCount(page * rowsPerPage + currentDataLength);
                } else {
                    setTotalCount(page * rowsPerPage + currentDataLength + rowsPerPage); // Estimate more pages exist
                }
            } else {
                setError(response.message || 'Failed to load brokers or unexpected data format.');
                setBrokers([]); // Ensure it's an array
                setTotalCount(0);
            }
        } catch (err: any) {
            setError(err.message || 'Connection error or unauthorized access.');
            setBrokers([]); // Ensure it's an array
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [page, rowsPerPage]);

    useEffect(() => {
        fetchBrokers();
    }, [fetchBrokers]);

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleToggleBrokerStatus = async (broker: BrokerPublic) => {
        const newStatus = !broker.is_active;
        const originalStatus = broker.is_active;
        setBrokers(prev => prev.map(b => b.id === broker.id ? { ...b, is_active: newStatus, updated_at: new Date().toISOString() } : b));
        try {
            await apiClient<BrokerPublic>({
                url: `/api/v1/brokers/${broker.id}`,
                method: 'PUT',
                body: { is_active: newStatus }
            });
            // Optionally re-fetch or rely on optimistic update if API returns updated object
            // fetchBrokers();
        } catch (err: any) {
            setError(err.message || `Failed to update broker ${broker.broker_code} status.`);
            setBrokers(prev => prev.map(b => b.id === broker.id ? { ...b, is_active: originalStatus, updated_at: broker.updated_at } : b));
        }
    };
    
    const handleOpenActionDialog = (broker: BrokerPublic, type: 'deactivate' | 'delete') => {
        setBrokerToAction(broker);
        setActionType(type);
        setOpenActionDialog(true);
    };

    const handleCloseActionDialog = () => {
        setBrokerToAction(null);
        setOpenActionDialog(false);
        setActionType('');
    };

    const handleConfirmAction = async () => {
        if (!brokerToAction || !actionType) return;
        setLoading(true); 
        try {
            await apiClient({
                url: `/api/v1/brokers/${brokerToAction.id}`,
                method: 'PUT', 
                body: { is_active: false } 
            });
            fetchBrokers(); 
            handleCloseActionDialog();
        } catch (delError: any) {
            setError(delError.message || `Failed to ${actionType} broker.`);
            handleCloseActionDialog();
        } finally {
            setLoading(false);
        }
    };

    const handleAddBroker = () => console.log("Add broker action triggered (not implemented)");
    const handleEditBroker = (brokerId: string) => console.log("Edit broker action triggered for:", brokerId, " (not implemented)");

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                 <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <BrokerIcon sx={{ mr: 1, fontSize: '24px' }} />
                    <Typography variant="h4" component="h1">Brokers Management</Typography>
                </Box>
                <Box>
                    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchBrokers} disabled={loading} sx={{ mr: 1 }}>
                        Refresh
                    </Button>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddBroker}>
                        Add Broker
                    </Button>
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                 {loading && brokers.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3, minHeight: 300 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <TableContainer sx={{ maxHeight: 600 }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Broker Code</TableCell>
                                        <TableCell>User ID</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Created At</TableCell>
                                        <TableCell>Updated At</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Array.isArray(brokers) && brokers.map((broker) => (
                                        <TableRow hover key={broker.id}>
                                            <TableCell>
                                                <Chip label={broker.broker_code} size="small" variant="outlined" />
                                            </TableCell>
                                            <TableCell>
                                                <Tooltip title={broker.user_id}>
                                                    <Typography variant="body2" sx={{maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                                        {broker.user_id}
                                                    </Typography>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell>
                                                <Switch
                                                    checked={broker.is_active}
                                                    onChange={() => handleToggleBrokerStatus(broker)}
                                                    size="small"
                                                    color={broker.is_active ? "success" : "default"}
                                                    disabled={loading}
                                                />
                                                <Typography variant="caption" sx={{ ml: 1 }}>
                                                    {broker.is_active ? 'Active' : 'Inactive'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>{format(parseISO(broker.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                                            <TableCell>{format(parseISO(broker.updated_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Edit Broker (Not Implemented)">
                                                    <IconButton size="small" onClick={() => handleEditBroker(broker.id)} disabled><EditIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                                <Tooltip title={broker.is_active ? "Deactivate Broker" : "Delete (Deactivates)"}>
                                                    <IconButton size="small" onClick={() => handleOpenActionDialog(broker, broker.is_active ? 'deactivate' : 'delete')}><DeleteIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {Array.isArray(brokers) && brokers.length === 0 && !loading && (
                                        <TableRow>
                                            <TableCell colSpan={6} align="center">No brokers found.</TableCell>
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
             <Dialog open={openActionDialog} onClose={handleCloseActionDialog}>
                <DialogTitle>Confirm {actionType === 'deactivate' ? 'Deactivation' : (actionType === 'delete' ? 'Deletion (Deactivation)' : 'Action')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to proceed with this action for broker <strong>{brokerToAction?.broker_code}</strong> (User ID: {brokerToAction?.user_id})?
                        {actionType === 'deactivate' && " This will set the broker to inactive."}
                        {actionType === 'delete' && " This will mark the broker as inactive and revoke associated privileges."}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseActionDialog}>Cancel</Button>
                    <Button onClick={handleConfirmAction} color="error" disabled={loading}>
                         {loading ? <CircularProgress size={20} /> : (actionType === 'deactivate' ? "Deactivate" : "Confirm Delete (Deactivate)")}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}